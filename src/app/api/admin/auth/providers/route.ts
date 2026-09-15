import { NextRequest } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { adminAuditLogs, authProviderSettings } from "@/db/schema";
import { getAdminSessionContext, unauthorized } from "@/lib/admin-auth";
import { requireAdminStepUp } from "@/lib/admin-step-up";
import { authSecretFingerprint, encryptAuthSecret } from "@/lib/auth-secret-vault";
import { AUTH_PROVIDERS, normalizeEmail, parseAuthProvider } from "@/lib/identity-auth";

export const dynamic = "force-dynamic";

async function admin(req: NextRequest) {
  const actor = await getAdminSessionContext(req);
  return actor?.role === "admin" ? actor : null;
}

function publicRow(provider: string, row: typeof authProviderSettings.$inferSelect | null) {
  return {
    provider,
    enabled: row?.enabled === true,
    clientId: row?.clientId ?? "",
    metadata: row?.metadata ?? {},
    revision: row?.revision ?? 0,
    secretConfigured: Boolean(row?.secretEncrypted),
    secretFingerprint: authSecretFingerprint(row?.secretEncrypted),
    updatedAt: row?.updatedAt ?? null,
  };
}

export async function GET(req: NextRequest) {
  const actor = await admin(req);
  if (!actor) return unauthorized();
  const rows = await db.select().from(authProviderSettings);
  const byProvider = new Map(rows.map((row) => [row.provider, row]));
  return Response.json({ ok: true, providers: AUTH_PROVIDERS.map((provider) => publicRow(provider, byProvider.get(provider) ?? null)) });
}

export async function PATCH(req: NextRequest) {
  const actor = await admin(req);
  if (!actor) return unauthorized();
  const body = await req.json();
  const stepUp = await requireAdminStepUp(req, actor, body, { scope: "admin-auth-provider-settings", actionLabel: "identity provider changes" });
  if (stepUp) return stepUp;

  const provider = parseAuthProvider(body.provider);
  if (!provider) return Response.json({ ok: false, error: "Invalid auth provider" }, { status: 400 });
  const expectedRevision = Math.trunc(Number(body.expectedRevision));
  const enabled = body.enabled === true;
  const clientId = String(body.clientId || "").trim().slice(0, 320);
  const secret = typeof body.secret === "string" ? body.secret.trim() : "";
  const metadata = body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata) ? body.metadata as Record<string, unknown> : {};
  const senderName = String(metadata.senderName || "RuneForge").trim().slice(0, 80) || "RuneForge";
  const normalizedMetadata = provider === "email" ? { senderName } : {};
  if (provider === "email" && clientId && !normalizeEmail(clientId)) return Response.json({ ok: false, error: "E-mail sender must be valid" }, { status: 400 });
  if (enabled && (!clientId || (!secret && body.secretConfigured !== true))) return Response.json({ ok: false, error: `Enabled ${provider} provider requires public identifier and secret` }, { status: 400 });

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`runeforge:auth-provider:${provider}`}))`);
    const [existing] = await tx.select().from(authProviderSettings).where(eq(authProviderSettings.provider, provider)).limit(1).for("update");
    if (!existing) {
      if (expectedRevision !== 0) return { error: "Revision conflict", status: 409 as const };
      if (enabled && !secret) return { error: "Secret is required for first enabled configuration", status: 400 as const };
      const [row] = await tx.insert(authProviderSettings).values({
        provider, enabled, clientId, secretEncrypted: secret ? encryptAuthSecret(secret) : null,
        metadata: normalizedMetadata, updatedBy: actor.actorId,
      }).returning();
      await tx.insert(adminAuditLogs).values({ action: "auth.provider.create", resource: provider, actor: actor.actorId, details: { enabled, publicIdentifierConfigured: Boolean(clientId), secretConfigured: Boolean(secret), stepUp: true } });
      return { row };
    }
    if (!Number.isInteger(expectedRevision)) return { error: "expectedRevision is required", status: 400 as const };
    const updates = {
      enabled,
      clientId,
      metadata: normalizedMetadata,
      updatedBy: actor.actorId,
      updatedAt: new Date(),
      revision: sql<number>`${authProviderSettings.revision} + 1`,
      ...(secret ? { secretEncrypted: encryptAuthSecret(secret) } : {}),
    };
    const [row] = await tx.update(authProviderSettings).set(updates).where(and(eq(authProviderSettings.provider, provider), eq(authProviderSettings.revision, expectedRevision))).returning();
    if (!row) return { error: "Revision conflict; reload settings", status: 409 as const };
    await tx.insert(adminAuditLogs).values({ action: "auth.provider.update", resource: provider, actor: actor.actorId, details: { enabled, publicIdentifierConfigured: Boolean(clientId), rotatedSecret: Boolean(secret), stepUp: true } });
    return { row };
  });

  if ("error" in result) return Response.json({ ok: false, error: result.error }, { status: result.status });
  return Response.json({ ok: true, provider: publicRow(provider, result.row) });
}
