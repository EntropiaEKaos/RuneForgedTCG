import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { paymentOrders } from "@/db/schema";
import { applyGameGrants } from "@/lib/game-grants";
import { decideFulfilledPaymentEvent } from "@/lib/payment-financial-state";
import { canBindApprovedProviderPayment } from "@/lib/payment-provider-link";

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
  if (!providerPreferenceId) throw new Error("Mercado Pago payment has no preference id");
  const recoveredPreferenceBinding = !order.providerPreferenceId && order.status === "preference_ambiguous";
  if (!order.providerPreferenceId && !recoveredPreferenceBinding) throw new Error("Local order has no Mercado Pago preference");
  if (order.providerPreferenceId && providerPreferenceId !== order.providerPreferenceId) throw new Error("Payment preference does not belong to this order");
  return { paymentId, providerPreferenceId, recoveredPreferenceBinding };
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

    // Once grants have been delivered the original approved provider payment is
    // canonical. Later provider events may raise a sticky financial-review flag,
    // but they must never cause another grant or let an unrelated retry downgrade
    // the canonical purchase status.
    if (fresh.fulfilledAt) {
      const previousRequiresReview = Boolean((fresh.providerPayload as Record<string, unknown> | null)?.requiresReview);
      const decision = decideFulfilledPaymentEvent({
        providerStatus,
        eventPaymentId: bound.paymentId,
        canonicalPaymentId: fresh.providerPaymentId,
        previousRequiresReview,
      });
      const nextPayload = {
        status: providerStatus,
        statusDetail: payment.status_detail || null,
        preferenceId: bound.providerPreferenceId,
        eventPaymentId: bound.paymentId,
        canonicalPaymentId: fresh.providerPaymentId,
        duplicateProviderPayment: decision.duplicateProviderPayment,
        requiresReview: decision.requiresReview,
        lastEventAt: new Date().toISOString(),
      };

      if (decision.preserveOrderStatus) {
        await tx.update(paymentOrders).set({ providerPayload: nextPayload, updatedAt: new Date() }).where(eq(paymentOrders.id, fresh.id));
      } else {
        // Only an adverse event from the canonical approved payment may change
        // the authoritative order status to refunded/charged_back.
        await tx.update(paymentOrders).set({ status: providerStatus, providerPayload: nextPayload, updatedAt: new Date() }).where(eq(paymentOrders.id, fresh.id));
      }
      return {
        already: true,
        fulfilled: true,
        requiresReview: decision.requiresReview,
        duplicateProviderPayment: decision.duplicateProviderPayment,
      };
    }

    if (providerStatus !== "approved") {
      const nextPayload = {
        status: providerStatus,
        statusDetail: payment.status_detail || null,
        preferenceId: bound.providerPreferenceId,
        eventPaymentId: bound.paymentId,
        recoveredPreferenceBinding: bound.recoveredPreferenceBinding,
        requiresReview: bound.recoveredPreferenceBinding || Boolean((fresh.providerPayload as Record<string, unknown> | null)?.requiresReview),
        lastEventAt: new Date().toISOString(),
      };
      // Non-approved attempts are observations, not canonical payment bindings.
      // A customer can legitimately retry the same preference and receive a new
      // payment id. Keep the approved providerPaymentId untouched so a pending or
      // rejected attempt can never block a later valid approval.
      await tx.update(paymentOrders).set({
        status: providerStatus,
        providerPreferenceId: bound.providerPreferenceId,
        providerPayload: nextPayload,
        updatedAt: new Date(),
      }).where(eq(paymentOrders.id, fresh.id));
      return { already: false, fulfilled: false, requiresReview: nextPayload.requiresReview, duplicateProviderPayment: false };
    }

    if (!canBindApprovedProviderPayment(fresh, bound.paymentId)) throw new Error("Order already linked to another approved provider payment");

    await applyGameGrants(tx, { playerId: fresh.playerId, grants: fresh.grants as any, reason: "payment_purchase", referenceType: "payment", referenceId: fresh.externalReference });
    await tx.update(paymentOrders).set({
      status: "approved",
      providerPreferenceId: bound.providerPreferenceId,
      providerPaymentId: bound.paymentId,
      providerPayload: {
        status: "approved",
        statusDetail: payment.status_detail || null,
        preferenceId: bound.providerPreferenceId,
        eventPaymentId: bound.paymentId,
        recoveredPreferenceBinding: bound.recoveredPreferenceBinding,
        requiresReview: bound.recoveredPreferenceBinding || Boolean((fresh.providerPayload as Record<string, unknown> | null)?.requiresReview),
      },
      approvedAt: new Date(),
      fulfilledAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(paymentOrders.id, fresh.id));
    return { already: false, fulfilled: true, requiresReview: bound.recoveredPreferenceBinding || Boolean((fresh.providerPayload as Record<string, unknown> | null)?.requiresReview), duplicateProviderPayment: false };
  });

  return {
    ignored: false,
    status: providerStatus,
    fulfilled: result.fulfilled,
    alreadyFulfilled: result.already,
    requiresReview: result.requiresReview,
    duplicateProviderPayment: result.duplicateProviderPayment,
    externalReference,
  };
}
