import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import {
  MERCADO_PAGO_ROTATION_BLOCKERS_SQL,
  mercadoPagoRotationBlockerCount,
} from "../src/lib/payment-gateway-rotation";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error("DATABASE_URL is required for Mercado Pago rotation certification");
  process.exit(2);
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: 4,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 15_000,
  application_name: "runeforge-mercadopago-rotation-certification",
});

async function blockers() {
  return mercadoPagoRotationBlockerCount(await pool.query(MERCADO_PAGO_ROTATION_BLOCKERS_SQL));
}

async function main() {
  const playerName = `__rf_mp_rotation_${randomUUID()}`;
  const externalReference = `rf_mp_rotation_${randomUUID()}`;
  const idempotencyKey = randomUUID();
  let playerId: number | null = null;

  try {
    const baseline = await blockers();
    const player = await pool.query<{ id: number }>(
      "insert into players(name) values($1) returning id",
      [playerName],
    );
    playerId = Number(player.rows[0]?.id);
    assert.ok(Number.isInteger(playerId) && playerId > 0, "fixture player must persist");

    await pool.query(
      "insert into payment_orders(player_id,provider,provider_environment,external_reference,product_key,product_name,amount_cents,currency,status,idempotency_key,grants) values($1,'mercadopago','sandbox',$2,'rotation-cert','Rotation Certification',990,'BRL','creating',$3,'{}'::jsonb)",
      [playerId, externalReference, idempotencyKey],
    );

    assert.equal(
      await blockers(),
      baseline + 1,
      "creating order blocks credential/environment rotation before provider preference binding",
    );

    await pool.query(
      "update payment_orders set status='rejected', provider_preference_id=null where external_reference=$1",
      [externalReference],
    );
    assert.equal(
      await blockers(),
      baseline,
      "terminal attempt without a provider preference does not block rotation",
    );

    await pool.query(
      "update payment_orders set provider_preference_id=$2 where external_reference=$1",
      [externalReference, `pref_${randomUUID()}`],
    );
    assert.equal(
      await blockers(),
      baseline + 1,
      "unfulfilled provider-bound preference blocks rotation even after a rejected attempt because Checkout Pro may be retried",
    );

    await pool.query(
      "update payment_orders set fulfilled_at=now(), status='approved' where external_reference=$1",
      [externalReference],
    );
    assert.equal(
      await blockers(),
      baseline,
      "fulfilled order no longer blocks provider credential rotation",
    );

    console.log("MERCADO PAGO ROTATION CERTIFICATION: 4/4 PASS");
  } finally {
    if (playerId != null) {
      await pool.query("delete from economy_transactions where player_id=$1", [playerId]).catch(() => undefined);
      await pool.query("delete from payment_orders where player_id=$1", [playerId]).catch(() => undefined);
      await pool.query("delete from players where id=$1", [playerId]).catch(() => undefined);
    }
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
