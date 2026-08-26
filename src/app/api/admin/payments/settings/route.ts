import { NextRequest } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { adminAuditLogs, paymentGatewaySettings } from "@/db/schema";
import { getAdminSessionContext, unauthorized } from "@/lib/admin-auth";
import { encryptPaymentSecret, paymentSecretFingerprint } from "@/lib/payment-crypto";

export const dynamic = "force-dynamic";

async function admin(req: NextRequest) {
  const actor = await getAdminSessionContext(req);
  return actor?.role === "admin" ? actor : null;
}
function publicRow(row: any) {
  return row ? { provider: row.provider, enabled: row.enabled, environment: row.environment, publicKey: row.publicKey, statementDescriptor: row.statementDescriptor, revision: row.revision, accessTokenConfigured: Boolean(row.accessTokenEncrypted), webhookSecretConfigured: Boolean(row.webhookSecretEncrypted), accessTokenFingerprint: paymentSecretFingerprint(row.accessTokenEncrypted), webhookSecretFingerprint: paymentSecretFingerprint(row.webhookSecretEncrypted), updatedAt: row.updatedAt } : null;
}
export async function GET(req: NextRequest) {
  const actor = await admin(req); if (!actor) return unauthorized();
  const [row] = await db.select().from(paymentGatewaySettings).where(eq(paymentGatewaySettings.provider, "mercadopago")).limit(1);
  return Response.json({ ok: true, settings: publicRow(row) || { provider: "mercadopago", enabled: false, environment: "sandbox", publicKey: "", statementDescriptor: "RUNEFORGE", revision: 0, accessTokenConfigured: false, webhookSecretConfigured: false } });
}
export async function PATCH(req: NextRequest) {
  const actor = await admin(req); if (!actor) return unauthorized();
  const body = await req.json();
  const expectedRevision = Math.trunc(Number(body.expectedRevision));
  const enabled = body.enabled === true;
  const environment = body.environment === "production" ? "production" : "sandbox";
  const publicKey = String(body.publicKey || "").trim().slice(0, 240);
  const statementDescriptor = String(body.statementDescriptor || "RUNEFORGE").trim().replace(/[^A-Z0-9 ]/gi, "").slice(0, 22).toUpperCase() || "RUNEFORGE";
  const accessToken = typeof body.accessToken === "string" ? body.accessToken.trim() : "";
  const webhookSecret = typeof body.webhookSecret === "string" ? body.webhookSecret.trim() : "";
  if (enabled && (!publicKey || (!accessToken && body.accessTokenConfigured !== true) || (!webhookSecret && body.webhookSecretConfigured !== true))) return Response.json({ ok: false, error: "Enabled Mercado Pago requires public key, access token and webhook secret" }, { status: 400 });
  const [existing] = await db.select().from(paymentGatewaySettings).where(eq(paymentGatewaySettings.provider, "mercadopago")).limit(1);
  if (!existing) {
    if (expectedRevision !== 0) return Response.json({ ok: false, error: "Revision conflict" }, { status: 409 });
    if (!accessToken || !webhookSecret) return Response.json({ ok: false, error: "Access token and webhook secret are required for first configuration" }, { status: 400 });
    const [row] = await db.insert(paymentGatewaySettings).values({ provider: "mercadopago", enabled, environment, publicKey, accessTokenEncrypted: encryptPaymentSecret(accessToken), webhookSecretEncrypted: encryptPaymentSecret(webhookSecret), statementDescriptor, updatedBy: actor.actorId }).returning();
    await db.insert(adminAuditLogs).values({ action: "payments.settings.create", resource: "mercadopago", actor: actor.actorId, details: { enabled, environment, publicKeyConfigured: Boolean(publicKey), accessTokenConfigured: true, webhookSecretConfigured: true } });
    return Response.json({ ok: true, settings: publicRow(row) });
  }
  if (!Number.isInteger(expectedRevision)) return Response.json({ ok: false, error: "expectedRevision is required" }, { status: 400 });
  if (existing.environment !== environment) {
    const pending = await db.execute(sql`SELECT count(*)::int n FROM payment_orders WHERE provider='mercadopago' AND provider_preference_id IS NOT NULL AND fulfilled_at IS NULL AND status NOT IN ('rejected','cancelled','refunded','charged_back','preference_failed')`);
    const n = Number((pending as any).rows?.[0]?.n ?? 0);
    if (n > 0) return Response.json({ ok: false, error: `Cannot switch Mercado Pago environment while ${n} payment order(s) are pending` }, { status: 409 });
    if (existing.environment === "production" && environment === "sandbox") {
      const history = await db.execute(sql`SELECT count(*)::int n FROM payment_orders WHERE provider='mercadopago' AND provider_environment='production'`);
      const productionOrders = Number((history as any).rows?.[0]?.n ?? 0);
      if (productionOrders > 0) return Response.json({ ok: false, error: "Production Mercado Pago history exists; environment downgrade to Sandbox is refused so late refunds/chargebacks remain reconcilable" }, { status: 409 });
    }
  }
  const updates: any = { enabled, environment, publicKey, statementDescriptor, updatedBy: actor.actorId, updatedAt: new Date(), revision: sql`${paymentGatewaySettings.revision} + 1` };
  if (accessToken) updates.accessTokenEncrypted = encryptPaymentSecret(accessToken);
  if (webhookSecret) updates.webhookSecretEncrypted = encryptPaymentSecret(webhookSecret);
  const [row] = await db.update(paymentGatewaySettings).set(updates).where(and(eq(paymentGatewaySettings.provider, "mercadopago"), eq(paymentGatewaySettings.revision, expectedRevision))).returning();
  if (!row) return Response.json({ ok: false, error: "Revision conflict; reload settings" }, { status: 409 });
  await db.insert(adminAuditLogs).values({ action: "payments.settings.update", resource: "mercadopago", actor: actor.actorId, details: { enabled, environment, publicKeyConfigured: Boolean(publicKey), rotatedAccessToken: Boolean(accessToken), rotatedWebhookSecret: Boolean(webhookSecret) } });
  return Response.json({ ok: true, settings: publicRow(row) });
}
