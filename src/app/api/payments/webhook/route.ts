import { NextRequest } from "next/server";
import { getMercadoPagoSettings } from "@/lib/payment-settings";
import { getMercadoPagoPayment, verifyMercadoPagoWebhookSignature } from "@/lib/mercado-pago";
import { processMercadoPagoPayment } from "@/lib/payment-fulfillment";
import { apiRequestId, readBoundedJson, RequestBodyTooLargeError } from "@/lib/request-security";

export const dynamic = "force-dynamic";
const MAX_WEBHOOK_BODY_BYTES = 64 * 1024;
function paymentIdFrom(req: NextRequest, body: any) { return String(req.nextUrl.searchParams.get("data.id") || req.nextUrl.searchParams.get("data_id") || body?.data?.id || body?.id || "").trim(); }
export async function POST(req: NextRequest) {
  const requestId = apiRequestId(req);
  let body: any = {};
  try {
    body = await readBoundedJson(req, MAX_WEBHOOK_BODY_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return Response.json({ ok: false, error: "Payload too large" }, { status: 413 });
    // Mercado Pago may deliver identifying query parameters with an empty or
    // non-JSON body. Preserve that supported path while still bounding bytes.
    body = {};
  }
  const topic=String(body?.type || req.nextUrl.searchParams.get("type") || "").toLowerCase(); if(topic && topic!=="payment") return Response.json({ok:true,ignored:true});
  const paymentId = paymentIdFrom(req, body); if (!paymentId) return Response.json({ ok: true, ignored: true });
  const settings = await getMercadoPagoSettings(true); if (!settings?.accessToken || !settings.webhookSecret) return Response.json({ ok: false, error: "Payment gateway unavailable" }, { status: 503 });
  const valid = verifyMercadoPagoWebhookSignature({ signature: req.headers.get("x-signature"), requestId: req.headers.get("x-request-id"), dataId: paymentId, secret: settings.webhookSecret });
  if (!valid) return Response.json({ ok: false, error: "Invalid webhook signature" }, { status: 401 });
  try {
    const payment = await getMercadoPagoPayment(settings.accessToken, paymentId);
    const result = await processMercadoPagoPayment(payment);
    return Response.json({ ok: true, ...result });
  } catch (error) { console.error(`[payments.webhook][${requestId}] processing failed`, error); return Response.json({ ok: false, error: "Payment provider temporarily unavailable", code: "PAYMENT_PROVIDER_ERROR", requestId }, { status: 502 }); }
}
