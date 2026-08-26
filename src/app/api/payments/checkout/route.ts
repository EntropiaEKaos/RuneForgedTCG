import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { paymentOrders } from "@/db/schema";
import { requireStablePlayerIdentity } from "@/lib/player-session";
import { runtimeGate } from "@/lib/runtime-gates";
import { getRuntimePaymentProducts, getRuntimePacks } from "@/lib/control-plane";
import { getMercadoPagoSettings } from "@/lib/payment-settings";
import { createMercadoPagoPreference } from "@/lib/mercado-pago";
import { sanitizeGameGrants, validateGrantPackIds } from "@/lib/game-grants";
import { consumeRateLimit } from "@/lib/rate-limit";
import { apiRequestId } from "@/lib/request-security";

export const dynamic = "force-dynamic";

const CLIENT_KEY = /^[A-Za-z0-9._:-]{16,128}$/;
const CREATING_STALE_MS = 90_000;
function checkoutIdempotencyKey(playerId: number, raw: string | null) {
  const clientKey = raw && CLIENT_KEY.test(raw) ? raw : crypto.randomUUID();
  return crypto.createHash("sha256").update(`mercadopago:${playerId}:${clientKey}`).digest("hex");
}

function checkoutUrlFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const value = (payload as Record<string, unknown>).checkoutUrl;
  return typeof value === "string" && /^https:\/\//i.test(value) ? value : null;
}

export async function POST(req: NextRequest) {
  const requestId = apiRequestId(req);
  const blocked = await runtimeGate("general");
  if (blocked) return blocked;
  const identity = await requireStablePlayerIdentity(req);
  if (!identity) return Response.json({ ok: false, error: "Player session required" }, { status: 401 });
  const rate = await consumeRateLimit(`payment-checkout:${identity.playerId}`, 6, 60_000);
  if (!rate.allowed) return Response.json({ ok: false, error: "Too many checkout attempts" }, { status: 429, headers: { "retry-after": String(rate.retryAfterSeconds) } });

  try {
    const body = await req.json();
    const productKey = String(body.productKey || "").trim();
    const idempotencyKey = checkoutIdempotencyKey(identity.playerId, req.headers.get("x-idempotency-key"));
    const [products, settings, packDefs] = await Promise.all([getRuntimePaymentProducts(), getMercadoPagoSettings(true), getRuntimePacks()]);
    const product = products.find((p) => p.key === productKey && p.active !== false);
    if (!product) return Response.json({ ok: false, error: "Payment product not found" }, { status: 404 });
    const amountCents = Math.trunc(Number(product.priceCents));
    const currency = String(product.currency || "BRL");
    if (!Number.isInteger(amountCents) || amountCents < 100 || amountCents > 10_000_000 || currency !== "BRL") return Response.json({ ok: false, error: "Payment product has an invalid price/currency" }, { status: 409 });
    if (!settings?.enabled || !settings.accessToken || !settings.webhookSecret) return Response.json({ ok: false, error: "Mercado Pago is not configured" }, { status: 503 });
    const grants = sanitizeGameGrants(product.grants);
    const invalidPacks = validateGrantPackIds(grants, packDefs.map((p) => p.id));
    if (invalidPacks.length) return Response.json({ ok: false, error: `Payment product is misconfigured: unknown pack(s) ${invalidPacks.join(", ")}` }, { status: 409 });
    const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
    if (!base || !/^https:\/\//i.test(base)) throw new Error("NEXT_PUBLIC_APP_URL must be an HTTPS origin for Mercado Pago webhooks");

    let [order] = await db.select().from(paymentOrders).where(eq(paymentOrders.idempotencyKey, idempotencyKey)).limit(1);
    if (order) {
      if (order.playerId !== identity.playerId || order.productKey !== productKey) return Response.json({ ok: false, error: "Idempotency key already belongs to a different checkout" }, { status: 409 });
      const existingUrl = checkoutUrlFromPayload(order.providerPayload);
      if (existingUrl && order.status === "preference_created") return Response.json({ ok: true, order: order.externalReference, checkoutUrl: existingUrl, reused: true });
      if (order.status === "creating") {
        const stale = Date.now() - new Date(order.updatedAt).getTime() > CREATING_STALE_MS;
        if (stale) {
          await db.update(paymentOrders).set({ status: "preference_failed", providerPayload: { errorCode: "STALE_CREATING" }, updatedAt: new Date() }).where(and(eq(paymentOrders.id, order.id), eq(paymentOrders.status, "creating")));
          return Response.json({ ok: false, error: "The previous checkout attempt expired before it could be confirmed. Start a new checkout.", code: "CHECKOUT_RESTART_REQUIRED" }, { status: 409 });
        }
        return Response.json({ ok: false, error: "Checkout is already being created", code: "CHECKOUT_IN_PROGRESS" }, { status: 409, headers: { "retry-after": "1" } });
      }
      if (order.status === "preference_failed") return Response.json({ ok: false, error: "The provider preference result was ambiguous. Start a new checkout instead of replaying it.", code: "CHECKOUT_RESTART_REQUIRED" }, { status: 409 });
      return Response.json({ ok: false, error: `Checkout cannot be recreated from status ${order.status}` }, { status: 409 });
    } else {
      const externalReference = `rf_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
      const inserted = await db.insert(paymentOrders).values({
        playerId: identity.playerId,
        provider: "mercadopago",
        providerEnvironment: settings.environment === "production" ? "production" : "sandbox",
        externalReference,
        productKey: product.key,
        productName: product.name,
        amountCents,
        currency,
        status: "creating",
        idempotencyKey,
        grants,
      }).onConflictDoNothing({ target: paymentOrders.idempotencyKey }).returning();
      if (inserted[0]) order = inserted[0];
      else [order] = await db.select().from(paymentOrders).where(and(eq(paymentOrders.idempotencyKey, idempotencyKey), eq(paymentOrders.playerId, identity.playerId))).limit(1);
      if (!order) return Response.json({ ok: false, error: "Checkout collision; retry safely with the same request key" }, { status: 409, headers: { "retry-after": "1" } });
      if (order.productKey !== productKey) return Response.json({ ok: false, error: "Idempotency key already belongs to a different product" }, { status: 409 });
      const racedUrl = checkoutUrlFromPayload(order.providerPayload);
      if (racedUrl && order.status === "preference_created") return Response.json({ ok: true, order: order.externalReference, checkoutUrl: racedUrl, reused: true });
      if (!inserted[0] && order.status === "creating") {
        const stale = Date.now() - new Date(order.updatedAt).getTime() > CREATING_STALE_MS;
        if (stale) {
          await db.update(paymentOrders).set({ status: "preference_failed", providerPayload: { errorCode: "STALE_CREATING" }, updatedAt: new Date() }).where(and(eq(paymentOrders.id, order.id), eq(paymentOrders.status, "creating")));
          return Response.json({ ok: false, error: "The previous checkout attempt expired before it could be confirmed. Start a new checkout.", code: "CHECKOUT_RESTART_REQUIRED" }, { status: 409 });
        }
        return Response.json({ ok: false, error: "Checkout is already being created", code: "CHECKOUT_IN_PROGRESS" }, { status: 409, headers: { "retry-after": "1" } });
      }
      if (!inserted[0] && order.status === "preference_failed") return Response.json({ ok: false, error: "The provider preference result was ambiguous. Start a new checkout instead of replaying it.", code: "CHECKOUT_RESTART_REQUIRED" }, { status: 409 });
      if (!inserted[0]) return Response.json({ ok: false, error: `Checkout cannot be recreated from status ${order.status}` }, { status: 409 });
    }

    try {
      const preference = await createMercadoPagoPreference({
        accessToken: settings.accessToken,
        title: `RuneForge · ${order.productName}`,
        unitPrice: order.amountCents / 100,
        currency: order.currency,
        externalReference: order.externalReference,
        notificationUrl: `${base}/api/payments/webhook`,
        successUrl: `${base}/store?payment=success&order=${encodeURIComponent(order.externalReference)}`,
        failureUrl: `${base}/store?payment=failure&order=${encodeURIComponent(order.externalReference)}`,
        pendingUrl: `${base}/store?payment=pending&order=${encodeURIComponent(order.externalReference)}`,
        statementDescriptor: settings.statementDescriptor,
      });
      const preferenceId = String(preference.id || "").trim();
      if (!preferenceId) throw new Error("Mercado Pago preference returned no id");
      const url = settings.environment === "sandbox" ? (preference.sandbox_init_point || preference.init_point) : preference.init_point;
      if (!url || !/^https:\/\//i.test(String(url))) throw new Error("Mercado Pago preference returned no secure checkout URL");
      await db.update(paymentOrders).set({ status: "preference_created", providerPreferenceId: preferenceId, providerPayload: { preferenceId, checkoutUrl: String(url) }, updatedAt: new Date() }).where(eq(paymentOrders.id, order.id));
      return Response.json({ ok: true, order: order.externalReference, checkoutUrl: String(url), reused: false });
    } catch (error) {
      console.error(`[payments.checkout][${requestId}] Mercado Pago preference failed`, error);
      await db.update(paymentOrders).set({ status: "preference_failed", providerPayload: { errorCode: "PREFERENCE_CREATE_FAILED", requestId }, updatedAt: new Date() }).where(eq(paymentOrders.id, order.id));
      throw error;
    }
  } catch (error) {
    console.error(`[payments.checkout][${requestId}] checkout failed`, error);
    return Response.json({ ok: false, error: "Payment provider temporarily unavailable", code: "PAYMENT_PROVIDER_ERROR", requestId }, { status: 502 });
  }
}
