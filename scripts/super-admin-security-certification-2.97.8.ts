import assert from "node:assert/strict";
import fs from "node:fs";
import { NextRequest } from "next/server";
import { eq, inArray } from "drizzle-orm";

import { db, pool } from "@/db";
import { adminSessions, adminUsers, paymentGatewaySettings } from "@/db/schema";
import { createAdminSession } from "@/lib/admin-auth";
import { hashAdminPassword } from "@/lib/admin-credentials";
import { POST as rollbackVersion } from "@/app/api/admin/studio/versions/rollback/route";
import { PATCH as patchPaymentSettings } from "@/app/api/admin/payments/settings/route";

const ORIGIN = "http://localhost:3000";
type Json = Record<string, any>;

function req(path: string, token: string, body: unknown): NextRequest {
  return new NextRequest(`${ORIGIN}${path}`, {
    method: "POST",
    headers: {
      host: "localhost:3000",
      origin: ORIGIN,
      "sec-fetch-site": "same-origin",
      "content-type": "application/json",
      cookie: `rf_admin_session=${token}`,
    },
    body: JSON.stringify(body),
  });
}

function paymentReq(token: string, body: unknown): NextRequest {
  return new NextRequest(`${ORIGIN}/api/admin/payments/settings`, {
    method: "PATCH",
    headers: {
      host: "localhost:3000",
      origin: ORIGIN,
      "sec-fetch-site": "same-origin",
      "content-type": "application/json",
      cookie: `rf_admin_session=${token}`,
    },
    body: JSON.stringify(body),
  });
}

async function json(response: Response): Promise<Json> {
  return response.json() as Promise<Json>;
}

async function expectStepUpRequired(response: Response, label: string) {
  const body = await json(response);
  assert.equal(response.status, 403, `${label}: expected 403, got ${response.status}: ${JSON.stringify(body)}`);
  assert.equal(body.ok, false, `${label}: failure must be explicit`);
  assert.equal(body.code, "ADMIN_STEP_UP_REQUIRED", `${label}: stable step-up code is required`);
}

function stable(value: unknown) {
  return JSON.stringify(value, (_key, item) => item instanceof Date ? item.toISOString() : item);
}

async function main() {
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL is required");
  assert.ok(process.env.ADMIN_SESSION_SECRET, "ADMIN_SESSION_SECRET is required");

  const suffix = `${Date.now().toString(36)}_${process.pid.toString(36)}`;
  const password = `CI-${suffix}-admin-step-up-42!`;
  const hashed = hashAdminPassword(password);
  const actorIds: number[] = [];

  try {
    const [actor] = await db.insert(adminUsers).values({
      username: `cert2978_${suffix}`.slice(0, 70),
      passwordSalt: hashed.salt,
      passwordHash: hashed.hash,
      role: "admin",
      enabled: true,
    }).returning();
    actorIds.push(actor.id);
    const token = await createAdminSession({ id: actor.id, username: actor.username, role: "admin" });

    const rollbackBase = {
      resource: "collections",
      resourceId: 2_147_483_000,
      version: 1,
      expectedLatestVersion: 1,
    };

    await expectStepUpRequired(
      await rollbackVersion(req("/api/admin/studio/versions/rollback", token, rollbackBase)),
      "rollback without current credentials",
    );
    await expectStepUpRequired(
      await rollbackVersion(req("/api/admin/studio/versions/rollback", token, { ...rollbackBase, currentPassword: "wrong-password" })),
      "rollback with wrong current credentials",
    );
    const rollbackPassedGate = await rollbackVersion(req("/api/admin/studio/versions/rollback", token, {
      ...rollbackBase,
      currentPassword: password,
    }));
    const rollbackPassedBody = await json(rollbackPassedGate);
    assert.equal(rollbackPassedGate.status, 404, `valid rollback step-up must reach target lookup: ${JSON.stringify(rollbackPassedBody)}`);
    assert.match(String(rollbackPassedBody.error || ""), /not found/i, "valid rollback step-up must pass the re-authentication boundary");

    const paymentBefore = (await db.select().from(paymentGatewaySettings)
      .where(eq(paymentGatewaySettings.provider, "mercadopago")).limit(1))[0] ?? null;
    const paymentBase = {
      enabled: paymentBefore?.enabled ?? false,
      environment: paymentBefore?.environment ?? "sandbox",
      publicKey: paymentBefore?.publicKey ?? "",
      statementDescriptor: paymentBefore?.statementDescriptor ?? "RUNEFORGE",
      accessTokenConfigured: Boolean(paymentBefore?.accessTokenEncrypted),
      webhookSecretConfigured: Boolean(paymentBefore?.webhookSecretEncrypted),
      expectedRevision: -1,
    };

    await expectStepUpRequired(
      await patchPaymentSettings(paymentReq(token, paymentBase)),
      "payment settings without current credentials",
    );
    await expectStepUpRequired(
      await patchPaymentSettings(paymentReq(token, { ...paymentBase, currentPassword: "wrong-password" })),
      "payment settings with wrong current credentials",
    );
    const paymentPassedGate = await patchPaymentSettings(paymentReq(token, { ...paymentBase, currentPassword: password }));
    const paymentPassedBody = await json(paymentPassedGate);
    assert.equal(paymentPassedGate.status, 409, `valid payment step-up must reach revision guard without mutating settings: ${JSON.stringify(paymentPassedBody)}`);
    assert.match(String(paymentPassedBody.error || ""), /revision conflict/i, "valid payment step-up must pass re-authentication and reach CAS guard");

    const paymentAfter = (await db.select().from(paymentGatewaySettings)
      .where(eq(paymentGatewaySettings.provider, "mercadopago")).limit(1))[0] ?? null;
    assert.equal(stable(paymentAfter), stable(paymentBefore), "step-up certification must not mutate payment gateway settings");

    const helperSource = fs.readFileSync("src/lib/admin-step-up.ts", "utf8");
    assert.match(helperSource, /consumeRequestRateLimit/, "step-up gate must retain request-scoped brute-force protection");
    assert.match(helperSource, /consumeRateLimit/, "step-up gate must retain actor-scoped brute-force protection");
    assert.match(helperSource, /verifyAdminStepUp/, "step-up gate must re-verify current password and MFA state");

    const rollbackUi = fs.readFileSync("src/app/admin/studio/production/VersionsPanel.tsx", "utf8");
    assert.match(rollbackUi, /type="password"/, "rollback UI must collect current password using a masked input");
    assert.match(rollbackUi, /currentPassword/, "rollback UI must send step-up password only with the sensitive request");
    assert.match(rollbackUi, /currentTotp/, "rollback UI must support MFA/TOTP step-up");

    const paymentUi = fs.readFileSync("src/app/admin/studio/payments/PaymentSettingsClient.tsx", "utf8");
    assert.match(paymentUi, /autoComplete="current-password"/, "payment UI must use current-password semantics for step-up");
    assert.match(paymentUi, /currentTotp/, "payment UI must support MFA/TOTP step-up");

    console.log("SUPER ADMIN SECURITY 2.97.8: PASS");
    console.log("  rollback: missing/wrong step-up blocked; valid credentials reach immutable-history guard");
    console.log("  payments: missing/wrong step-up blocked; valid credentials reach revision CAS without side effects");
    console.log("  brute force: request + actor rate limits remain mandatory");
    console.log("  UI: password is masked; MFA/TOTP is wired for both sensitive surfaces");
  } finally {
    if (actorIds.length) {
      await db.delete(adminSessions).where(inArray(adminSessions.actorId, actorIds.map(String)));
      await db.delete(adminUsers).where(inArray(adminUsers.id, actorIds));
    }
  }
}

main()
  .then(async () => { await pool.end(); })
  .catch(async (error) => {
    console.error("SUPER ADMIN SECURITY 2.97.8: FAIL", error);
    await pool.end().catch(() => undefined);
    process.exitCode = 1;
  });
