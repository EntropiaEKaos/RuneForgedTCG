import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { processMercadoPagoPayment, type MercadoPagoPaymentLike } from "../src/lib/payment-fulfillment";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error("DATABASE_URL is required for Mercado Pago PostgreSQL certification");
  process.exit(2);
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: 16,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 15_000,
  application_name: "runeforge-mercadopago-certification",
});

interface Fixture {
  playerId: number;
  externalReference: string;
  preferenceId: string;
  beforeGold: number;
  amountCents: number;
}

async function createFixture(goldGrant = 137, status = "preference_created", persistPreference = true): Promise<Fixture> {
  const externalReference = `rf_mp_cert_${randomUUID()}`;
  const preferenceId = `pref_${randomUUID()}`;
  const player = await pool.query<{ id: number; gold: number }>(
    "insert into players(name) values($1) returning id,gold",
    [`__rf_mp_cert_${randomUUID()}`],
  );
  const playerId = Number(player.rows[0]?.id);
  const beforeGold = Number(player.rows[0]?.gold ?? 0);
  const amountCents = 990;
  await pool.query(
    "insert into payment_orders(player_id,provider,provider_environment,external_reference,product_key,product_name,amount_cents,currency,status,idempotency_key,provider_preference_id,grants,provider_payload) values($1,'mercadopago','sandbox',$2,'mp-cert','Mercado Pago Certification',$3,'BRL',$4,$5,$6,$7::jsonb,$8::jsonb)",
    [
      playerId,
      externalReference,
      amountCents,
      status,
      randomUUID(),
      persistPreference ? preferenceId : null,
      JSON.stringify({ gold: goldGrant }),
      JSON.stringify(status === "preference_ambiguous" ? { requiresReview: true, errorCode: "CERTIFICATION_AMBIGUOUS" } : {}),
    ],
  );
  return { playerId, externalReference, preferenceId, beforeGold, amountCents };
}

function payment(fixture: Fixture, id: string, status: string): MercadoPagoPaymentLike {
  return {
    id,
    external_reference: fixture.externalReference,
    transaction_amount: fixture.amountCents / 100,
    currency_id: "BRL",
    preference_id: fixture.preferenceId,
    status,
    live_mode: false,
  };
}

async function snapshot(fixture: Fixture) {
  const player = await pool.query<{ gold: number }>("select gold from players where id=$1", [fixture.playerId]);
  const order = await pool.query<{
    status: string;
    provider_preference_id: string | null;
    provider_payment_id: string | null;
    provider_payload: Record<string, unknown>;
    fulfilled_at: Date | null;
  }>(
    "select status,provider_preference_id,provider_payment_id,provider_payload,fulfilled_at from payment_orders where external_reference=$1",
    [fixture.externalReference],
  );
  const ledger = await pool.query<{ n: string }>(
    "select count(*)::text n from economy_transactions where player_id=$1 and reason='payment_purchase' and reference_type='payment' and reference_id=$2",
    [fixture.playerId, fixture.externalReference],
  );
  return {
    gold: Number(player.rows[0]?.gold ?? 0),
    order: order.rows[0],
    ledger: Number(ledger.rows[0]?.n ?? 0),
  };
}

async function cleanup(fixture: Fixture) {
  await pool.query("delete from economy_transactions where player_id=$1", [fixture.playerId]).catch(() => undefined);
  await pool.query("delete from payment_orders where player_id=$1", [fixture.playerId]).catch(() => undefined);
  await pool.query("delete from players where id=$1", [fixture.playerId]).catch(() => undefined);
}

async function duplicateSamePaymentProbe() {
  const fixture = await createFixture(137);
  const paymentId = `pay_${randomUUID()}`;
  try {
    const results = await Promise.all(
      Array.from({ length: 12 }, () => processMercadoPagoPayment(payment(fixture, paymentId, "approved"), { expectedPlayerId: fixture.playerId })),
    );
    const state = await snapshot(fixture);
    assert.equal(state.gold, fixture.beforeGold + 137, "concurrent duplicate approvals grant gold exactly once");
    assert.equal(state.ledger, 1, "concurrent duplicate approvals create one payment ledger entry");
    assert.equal(state.order?.status, "approved", "canonical order remains approved");
    assert.equal(state.order?.provider_payment_id, paymentId, "approved payment id is bound canonically");
    assert.ok(state.order?.fulfilled_at, "order is fulfilled");
    assert.equal(results.filter((result) => result.fulfilled && !result.alreadyFulfilled).length, 1, "exactly one worker performs fulfillment");
    console.log("PASS Mercado Pago PostgreSQL: 12 concurrent callbacks grant exactly once");
  } finally {
    await cleanup(fixture);
  }
}

async function competingApprovedPaymentsProbe() {
  const fixture = await createFixture(211);
  const firstId = `pay_${randomUUID()}`;
  const secondId = `pay_${randomUUID()}`;
  try {
    await Promise.all([
      processMercadoPagoPayment(payment(fixture, firstId, "approved"), { expectedPlayerId: fixture.playerId }),
      processMercadoPagoPayment(payment(fixture, secondId, "approved"), { expectedPlayerId: fixture.playerId }),
    ]);
    const state = await snapshot(fixture);
    assert.equal(state.gold, fixture.beforeGold + 211, "competing approved payments still grant exactly once");
    assert.equal(state.ledger, 1, "competing approved payments create one payment ledger entry");
    assert.ok([firstId, secondId].includes(String(state.order?.provider_payment_id)), "one approved payment remains canonical");
    assert.equal(state.order?.status, "approved", "duplicate approval cannot replace canonical order status");
    assert.equal(Boolean(state.order?.provider_payload?.requiresReview), true, "second approved payment raises sticky financial review");
    assert.equal(Boolean(state.order?.provider_payload?.duplicateProviderPayment), true, "second approved payment is identified as duplicate provider payment");
    console.log("PASS Mercado Pago PostgreSQL: competing approved payment ids grant once and raise review");
  } finally {
    await cleanup(fixture);
  }
}

async function ambiguousPreferencePaymentProbe() {
  const fixture = await createFixture(73, "preference_ambiguous", false);
  const paymentId = `pay_${randomUUID()}`;
  try {
    const result = await processMercadoPagoPayment(payment(fixture, paymentId, "approved"), { expectedPlayerId: fixture.playerId });
    const state = await snapshot(fixture);
    assert.equal(result.fulfilled, true, "provider-confirmed payment fulfills an ambiguous preference order");
    assert.equal(state.order?.provider_preference_id, fixture.preferenceId, "provider-confirmed payment recovers the missing preference binding");
    assert.equal(state.order?.provider_payment_id, paymentId, "recovered preference binds the canonical payment id");
    assert.equal(state.order?.status, "approved", "recovered ambiguous order becomes approved");
    assert.equal(Boolean(state.order?.provider_payload?.requiresReview), true, "recovered ambiguous order remains visible for financial review");
    assert.equal(state.gold, fixture.beforeGold + 73, "recovered ambiguous order grants exactly once");
    assert.equal(state.ledger, 1, "recovered ambiguous order creates exactly one ledger entry");
    console.log("PASS Mercado Pago PostgreSQL: provider-confirmed payment recovers ambiguous preference binding safely");
  } finally {
    await cleanup(fixture);
  }
}

async function adverseEventStateProbe() {
  const fixture = await createFixture(89);
  const canonicalId = `pay_${randomUUID()}`;
  const retryId = `pay_${randomUUID()}`;
  try {
    await processMercadoPagoPayment(payment(fixture, canonicalId, "approved"), { expectedPlayerId: fixture.playerId });
    await processMercadoPagoPayment(payment(fixture, retryId, "approved"), { expectedPlayerId: fixture.playerId });
    await processMercadoPagoPayment(payment(fixture, retryId, "refunded"), { expectedPlayerId: fixture.playerId });
    let state = await snapshot(fixture);
    assert.equal(state.order?.status, "approved", "refund on non-canonical payment cannot refund canonical purchase");
    assert.equal(state.order?.provider_payment_id, canonicalId, "non-canonical refund cannot rebind provider payment id");
    assert.equal(Boolean(state.order?.provider_payload?.requiresReview), true, "non-canonical refund remains reviewable");

    await processMercadoPagoPayment(payment(fixture, retryId, "pending"), { expectedPlayerId: fixture.playerId });
    state = await snapshot(fixture);
    assert.equal(state.order?.status, "approved", "delayed pending cannot downgrade fulfilled approval");
    assert.equal(Boolean(state.order?.provider_payload?.requiresReview), true, "delayed pending cannot erase financial review");

    await processMercadoPagoPayment(payment(fixture, canonicalId, "charged_back"), { expectedPlayerId: fixture.playerId });
    state = await snapshot(fixture);
    assert.equal(state.order?.status, "charged_back", "canonical chargeback is authoritative");
    assert.equal(Boolean(state.order?.provider_payload?.requiresReview), true, "canonical chargeback requires review");

    await processMercadoPagoPayment(payment(fixture, canonicalId, "rejected"), { expectedPlayerId: fixture.playerId });
    state = await snapshot(fixture);
    assert.equal(state.order?.status, "charged_back", "late rejected event cannot erase canonical chargeback status");
    assert.equal(Boolean(state.order?.provider_payload?.requiresReview), true, "late rejected event cannot erase chargeback review");
    assert.equal(state.gold, fixture.beforeGold + 89, "adverse events never repeat grants");
    assert.equal(state.ledger, 1, "adverse events never repeat payment ledger entries");
    console.log("PASS Mercado Pago PostgreSQL: canonical/adverse state is sticky and non-canonical events cannot downgrade it");
  } finally {
    await cleanup(fixture);
  }
}

async function validationRollbackProbe() {
  const fixture = await createFixture(55);
  try {
    await assert.rejects(
      processMercadoPagoPayment({ ...payment(fixture, `pay_${randomUUID()}`, "approved"), transaction_amount: 19.9 }, { expectedPlayerId: fixture.playerId }),
      /amount\/currency mismatch/i,
      "provider amount mismatch must fail closed",
    );
    const state = await snapshot(fixture);
    assert.equal(state.gold, fixture.beforeGold, "failed validation cannot grant currency");
    assert.equal(state.ledger, 0, "failed validation cannot create payment ledger entries");
    assert.equal(state.order?.fulfilled_at, null, "failed validation leaves order unfulfilled");
    console.log("PASS Mercado Pago PostgreSQL: provider mismatch rolls back without grants");
  } finally {
    await cleanup(fixture);
  }
}

async function main() {
  try {
    await duplicateSamePaymentProbe();
    await competingApprovedPaymentsProbe();
    await ambiguousPreferencePaymentProbe();
    await adverseEventStateProbe();
    await validationRollbackProbe();
    console.log("MERCADO PAGO POSTGRESQL CERTIFICATION: 5/5 PASS");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
