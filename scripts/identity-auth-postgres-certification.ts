import assert from "node:assert/strict";
import crypto from "node:crypto";
import { Pool } from "pg";
import { authSecretFingerprint, decryptAuthSecret, encryptAuthSecret } from "../src/lib/auth-secret-vault";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("DATABASE_URL is required");

async function main() {
  const originalDedicated = process.env.AUTH_SECRETS_ENCRYPTION_KEY;
  delete process.env.AUTH_SECRETS_ENCRYPTION_KEY;
  const transitional = encryptAuthSecret("identity-auth-cert-value");
  assert.ok(transitional.startsWith("auth:v2:p:"), "CI fallback must record PAYMENT root slot in the envelope");
  assert.equal(decryptAuthSecret(transitional), "identity-auth-cert-value");
  assert.ok(authSecretFingerprint(transitional), "encrypted provider secret must expose only a fingerprint");
  process.env.AUTH_SECRETS_ENCRYPTION_KEY = "ci-dedicated-identity-auth-root-key-0000000000000001";
  assert.equal(decryptAuthSecret(transitional), "identity-auth-cert-value", "payment-root ciphertext must survive adding the dedicated Auth root");
  const dedicated = encryptAuthSecret("identity-auth-dedicated-value");
  assert.ok(dedicated.startsWith("auth:v2:d:"), "dedicated Auth root must be selected for new writes");
  assert.equal(decryptAuthSecret(dedicated), "identity-auth-dedicated-value");
  if (originalDedicated === undefined) delete process.env.AUTH_SECRETS_ENCRYPTION_KEY;
  else process.env.AUTH_SECRETS_ENCRYPTION_KEY = originalDedicated;

  const pool = new Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 5_000 });
  const client = await pool.connect();
  try {
    const tables = await client.query<{ name: string | null }>(`
      select unnest(array[
        to_regclass('public.auth_provider_settings')::text,
        to_regclass('public.player_identities')::text,
        to_regclass('public.auth_login_tokens')::text
      ]) name
    `);
    assert.deepEqual(tables.rows.map((row) => row.name).sort(), ["auth_login_tokens","auth_provider_settings","player_identities"], "Identity/Auth tables must exist after certified upgrade/bootstrap");

    const indexes = await client.query<{ indexname: string }>(`
      select indexname from pg_indexes where schemaname='public' and indexname in (
        'player_identities_provider_subject_unique',
        'player_identities_player_idx',
        'auth_login_tokens_subject_idx',
        'auth_login_tokens_expiry_idx'
      ) order by indexname
    `);
    assert.equal(indexes.rows.length, 4, "Identity/Auth indexes must exist");

    await client.query("begin");
    const suffix = crypto.randomBytes(8).toString("hex");
    const player = await client.query<{ id: number }>("insert into players(name) values($1) returning id", [`Identity Cert ${suffix}`]);
    const playerId = player.rows[0].id;
    const subject = `cert-${suffix}`;
    await client.query("insert into player_identities(player_id,provider,provider_subject,email,email_verified) values($1,'google',$2,$3,true)", [playerId, subject, `${suffix}@example.invalid`]);

    await client.query("savepoint duplicate_identity");
    let duplicateRejected = false;
    try {
      await client.query("insert into player_identities(player_id,provider,provider_subject) values($1,'google',$2)", [playerId, subject]);
    } catch (error) {
      duplicateRejected = (error as { code?: string }).code === "23505";
      await client.query("rollback to savepoint duplicate_identity");
    }
    assert.equal(duplicateRejected, true, "provider + subject identity binding must be unique");
    await client.query("release savepoint duplicate_identity");

    await client.query("savepoint invalid_provider");
    let invalidProviderRejected = false;
    try {
      await client.query("insert into player_identities(player_id,provider,provider_subject) values($1,'unknown',$2)", [playerId, `invalid-${suffix}`]);
    } catch (error) {
      invalidProviderRejected = (error as { code?: string }).code === "23514";
      await client.query("rollback to savepoint invalid_provider");
    }
    assert.equal(invalidProviderRejected, true, "Identity/Auth provider allowlist must be enforced by PostgreSQL");
    await client.query("release savepoint invalid_provider");

    const tokenHash = crypto.createHash("sha256").update(`token-${suffix}`).digest("hex");
    await client.query("insert into auth_login_tokens(token_hash,provider,subject,expires_at) values($1,'email',$2,now()+interval '15 minutes')", [tokenHash, `${suffix}@example.invalid`]);
    const consumed = await client.query<{ n: number }>("update auth_login_tokens set consumed_at=now() where token_hash=$1 and consumed_at is null and expires_at>now() returning 1 n", [tokenHash]);
    assert.equal(consumed.rowCount, 1, "one-time login token must transition from unused to consumed exactly once");
    const replay = await client.query("update auth_login_tokens set consumed_at=now() where token_hash=$1 and consumed_at is null and expires_at>now() returning 1", [tokenHash]);
    assert.equal(replay.rowCount, 0, "consumed login token must be replay-proof at the database predicate");

    await client.query("delete from players where id=$1", [playerId]);
    const remaining = await client.query<{ n: number }>("select count(*)::int n from player_identities where player_id=$1", [playerId]);
    assert.equal(remaining.rows[0].n, 0, "external identities must cascade when their player is deleted");
    await client.query("rollback");

    console.log("IDENTITY AUTH POSTGRES CERT: PASS — vault root transition + schema + unique identity + one-time token + cascade certified");
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("IDENTITY AUTH POSTGRES CERT: FAIL", error);
  process.exit(1);
});
