import crypto from "node:crypto";

const BASE = "https://api.mercadopago.com";
const TIMEOUT_MS = 12_000;

async function mpFetch(path: string, token: string, init: RequestInit = {}) {
  if (!token) throw new Error("Mercado Pago access token is not configured");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init.headers || {}) },
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`Mercado Pago ${response.status}: ${String(payload?.message || payload?.error || "request failed")}`);
    return payload;
  } finally { clearTimeout(timer); }
}

export async function createMercadoPagoPreference(input: {
  accessToken: string; title: string; quantity?: number; unitPrice: number; currency: string;
  externalReference: string; notificationUrl: string; successUrl: string; failureUrl: string; pendingUrl: string; statementDescriptor?: string;
}) {
  return mpFetch("/checkout/preferences", input.accessToken, {
    method: "POST",
    body: JSON.stringify({
      items: [{ id: input.externalReference, title: input.title, quantity: input.quantity || 1, currency_id: input.currency, unit_price: input.unitPrice }],
      external_reference: input.externalReference,
      notification_url: input.notificationUrl,
      back_urls: { success: input.successUrl, failure: input.failureUrl, pending: input.pendingUrl },
      auto_return: "approved",
      statement_descriptor: input.statementDescriptor || "RUNEFORGE",
      metadata: { runeforge_order: input.externalReference },
    }),
  });
}

export async function getMercadoPagoPayment(accessToken: string, paymentId: string) {
  return mpFetch(`/v1/payments/${encodeURIComponent(paymentId)}`, accessToken, { method: "GET" });
}

export async function searchMercadoPagoPayments(accessToken: string, externalReference: string) {
  const now = new Date();
  const begin = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const q = new URLSearchParams({
    sort: "date_created",
    criteria: "desc",
    external_reference: externalReference,
    range: "date_created",
    begin_date: begin.toISOString(),
    end_date: now.toISOString(),
    limit: "10",
    offset: "0",
  });
  return mpFetch(`/v1/payments/search?${q.toString()}`, accessToken, { method: "GET" });
}

function safeHexEqual(a: string, b: string) {
  if (!/^[0-9a-f]+$/i.test(a) || !/^[0-9a-f]+$/i.test(b) || a.length !== b.length) return false;
  const ab = Buffer.from(a, "hex"), bb = Buffer.from(b, "hex");
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/** Mercado Pago Webhooks x-signature validation. */
export function verifyMercadoPagoWebhookSignature(input: { signature: string | null; requestId: string | null; dataId: string; secret: string; maxSkewSeconds?: number }) {
  if (!input.signature || !input.dataId || !input.secret) return false;
  const parts = Object.fromEntries(input.signature.split(",").map((part) => part.trim().split("=").map((x) => x.trim())).filter((x) => x.length === 2));
  const ts = String(parts.ts || ""), expected = String(parts.v1 || "");
  if (!/^\d+$/.test(ts) || !expected) return false;
  const numericTs = Number(ts);
  const timestampMs = numericTs >= 1_000_000_000_000 ? numericTs : numericTs * 1000;
  const skew = Math.abs(Date.now() - timestampMs);
  if (skew > (input.maxSkewSeconds ?? 600) * 1000) return false;
  const manifest = `id:${input.dataId.toLowerCase()};${input.requestId ? `request-id:${input.requestId};` : ""}ts:${ts};`;
  const actual = crypto.createHmac("sha256", input.secret).update(manifest).digest("hex");
  return safeHexEqual(actual, expected);
}
