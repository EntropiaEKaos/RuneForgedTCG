import { NextRequest } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { paymentOrders } from "@/db/schema";
import { requireStablePlayerIdentity } from "@/lib/player-session";
import { getMercadoPagoSettings } from "@/lib/payment-settings";
import { searchMercadoPagoPayments } from "@/lib/mercado-pago";
import { processMercadoPagoPayment } from "@/lib/payment-fulfillment";
import { consumeRateLimit } from "@/lib/rate-limit";
import { apiRequestId } from "@/lib/request-security";

export const dynamic = "force-dynamic";
const publicOrder = (r: any) => ({ externalReference: r.externalReference, productKey: r.productKey, productName: r.productName, amountCents: r.amountCents, currency: r.currency, status: r.status, approvedAt: r.approvedAt, fulfilledAt: r.fulfilledAt, createdAt: r.createdAt });
export async function GET(req: NextRequest) {
  const identity = await requireStablePlayerIdentity(req); if (!identity) return Response.json({ ok: false, error: "Player session required" }, { status: 401 });
  const ref = req.nextUrl.searchParams.get("order");
  const rows = ref ? await db.select().from(paymentOrders).where(and(eq(paymentOrders.playerId, identity.playerId), eq(paymentOrders.externalReference, ref))).limit(1) : await db.select().from(paymentOrders).where(eq(paymentOrders.playerId, identity.playerId)).orderBy(desc(paymentOrders.id)).limit(20);
  return Response.json({ ok: true, orders: rows.map(publicOrder) });
}
export async function POST(req: NextRequest) {
  const requestId = apiRequestId(req);
  const identity = await requireStablePlayerIdentity(req); if (!identity) return Response.json({ ok: false, error: "Player session required" }, { status: 401 });
  const rate = await consumeRateLimit(`payment-reconcile:${identity.playerId}`, 12, 60_000); if (!rate.allowed) return Response.json({ ok:false, error:"Payment reconciliation rate limit exceeded" }, { status:429, headers:{"retry-after":String(rate.retryAfterSeconds)} });
  const body = await req.json().catch(() => ({})); const ref = String(body.order || "").trim(); if (!ref) return Response.json({ ok: false, error: "order is required" }, { status: 400 });
  const [order] = await db.select().from(paymentOrders).where(and(eq(paymentOrders.playerId, identity.playerId), eq(paymentOrders.externalReference, ref))).limit(1);
  if (!order) return Response.json({ ok: false, error: "Order not found" }, { status: 404 });
  if (order.fulfilledAt) return Response.json({ ok: true, order: publicOrder(order), reconciled: false });
  const settings = await getMercadoPagoSettings(true); if (!settings?.accessToken) return Response.json({ ok: false, error: "Payment gateway unavailable" }, { status: 503 });
  try {
    const search = await searchMercadoPagoPayments(settings.accessToken, ref);
    const results = Array.isArray(search?.results) ? search.results : [];
    const payment = results.find((p: any) => String(p.status) === "approved") || results[0];
    if (payment?.id) await processMercadoPagoPayment(payment, { expectedPlayerId: identity.playerId });
    const [fresh] = await db.select().from(paymentOrders).where(eq(paymentOrders.id, order.id)).limit(1);
    return Response.json({ ok: true, order: publicOrder(fresh || order), reconciled: Boolean(payment?.id) });
  } catch (error) { console.error(`[payments.orders][${requestId}] reconciliation failed`, error); return Response.json({ ok: false, error: "Payment provider temporarily unavailable", code: "PAYMENT_PROVIDER_ERROR", requestId }, { status: 502 }); }
}
