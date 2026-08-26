import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { paymentOrders } from "@/db/schema";
import { applyGameGrants } from "@/lib/game-grants";

export interface MercadoPagoPaymentLike {
  id?: string | number;
  external_reference?: string;
  transaction_amount?: number | string;
  currency_id?: string;
  preference_id?: string;
  status?: string;
  status_detail?: string;
  metadata?: Record<string, unknown>;
  live_mode?: boolean;
}

function validateProviderPaymentAgainstOrder(payment: MercadoPagoPaymentLike, order: typeof paymentOrders.$inferSelect, expectedPlayerId?: number) {
  const paymentId = String(payment.id || "").trim();
  if (!paymentId) throw new Error("Mercado Pago payment id is missing");
  if (typeof payment.live_mode === "boolean") {
    const expectedLive = order.providerEnvironment === "production";
    if (payment.live_mode !== expectedLive) throw new Error("Payment environment mismatch");
  }
  if (expectedPlayerId != null && order.playerId !== expectedPlayerId) throw new Error("Payment order does not belong to this player");
  const providerCents = Math.round(Number(payment.transaction_amount || 0) * 100);
  const currency = String(payment.currency_id || "");
  if (!Number.isFinite(providerCents) || providerCents !== order.amountCents || currency !== order.currency) throw new Error("Payment amount/currency mismatch");
  const providerPreferenceId = String(payment.preference_id || "").trim();
  if (!order.providerPreferenceId) throw new Error("Local order has no Mercado Pago preference");
  if (!providerPreferenceId || providerPreferenceId !== order.providerPreferenceId) throw new Error("Payment preference does not belong to this order");
  return { paymentId, providerPreferenceId };
}

/** Provider-confirmed order processing. Safe to call repeatedly from webhook or reconciliation. */
export async function processMercadoPagoPayment(payment: MercadoPagoPaymentLike, options: { expectedPlayerId?: number } = {}) {
  const paymentId = String(payment.id || "").trim();
  const externalReference = String(payment.external_reference || payment.metadata?.runeforge_order || "").trim();
  if (!paymentId || !externalReference) return { ignored: true, status: String(payment.status || "unknown"), fulfilled: false };
  const [local] = await db.select().from(paymentOrders).where(eq(paymentOrders.externalReference, externalReference)).limit(1);
  if (!local) return { ignored: true, status: String(payment.status || "unknown"), fulfilled: false };

  const providerStatus = String(payment.status || "unknown");
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM payment_orders WHERE id=${local.id} FOR UPDATE`);
    const [fresh] = await tx.select().from(paymentOrders).where(eq(paymentOrders.id, local.id)).limit(1);
    if (!fresh) throw new Error("Order disappeared");
    const bound = validateProviderPaymentAgainstOrder(payment, fresh, options.expectedPlayerId);

    if (providerStatus !== "approved") {
      const requiresReview = Boolean(fresh.fulfilledAt && ["refunded", "charged_back"].includes(providerStatus));
      const nextPayload = {
        status: providerStatus,
        statusDetail: payment.status_detail || null,
        preferenceId: bound.providerPreferenceId,
        requiresReview,
        lastEventAt: new Date().toISOString(),
      };
      // Once items were delivered, delayed pending/rejected notifications must never
      // downgrade the authoritative local status. Refund/chargeback is kept visible
      // for manual review because blindly clawing back spent game currency is unsafe.
      if (fresh.fulfilledAt && !requiresReview) {
        await tx.update(paymentOrders).set({ providerPayload: nextPayload, updatedAt: new Date() }).where(eq(paymentOrders.id, fresh.id));
        return { already: true, fulfilled: true, requiresReview: false };
      }
      await tx.update(paymentOrders).set({ status: providerStatus, providerPaymentId: bound.paymentId, providerPayload: nextPayload, updatedAt: new Date() }).where(eq(paymentOrders.id, fresh.id));
      return { already: Boolean(fresh.fulfilledAt), fulfilled: Boolean(fresh.fulfilledAt), requiresReview };
    }

    if (fresh.fulfilledAt) {
      // A second approved payment attempt for the same preference/order must not
      // duplicate grants. Keep the original provider payment as the canonical one.
      return { already: true, fulfilled: true, duplicateProviderPayment: Boolean(fresh.providerPaymentId && fresh.providerPaymentId !== bound.paymentId) };
    }
    if (fresh.providerPaymentId && fresh.providerPaymentId !== bound.paymentId) throw new Error("Order already linked to another provider payment");

    await applyGameGrants(tx, { playerId: fresh.playerId, grants: fresh.grants as any, reason: "payment_purchase", referenceType: "payment", referenceId: fresh.externalReference });
    await tx.update(paymentOrders).set({
      status: "approved",
      providerPaymentId: bound.paymentId,
      providerPayload: { status: "approved", statusDetail: payment.status_detail || null, preferenceId: bound.providerPreferenceId, requiresReview: false },
      approvedAt: new Date(),
      fulfilledAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(paymentOrders.id, fresh.id));
    return { already: false, fulfilled: true };
  });

  return {
    ignored: false,
    status: providerStatus,
    fulfilled: result.fulfilled,
    alreadyFulfilled: result.already,
    requiresReview: "requiresReview" in result ? result.requiresReview : false,
    externalReference,
  };
}
