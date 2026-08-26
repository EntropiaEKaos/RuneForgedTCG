import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { runPooledWorkers } from "../src/lib/pool-workers";
import { processMercadoPagoPayment } from "../src/lib/payment-fulfillment";
import { getMercadoPagoSettings } from "../src/lib/payment-settings";

type Check = { name: string; ok: boolean; detail: string };
const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error("DATABASE_URL is required for production verification");
  process.exit(2);
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: 24,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 15_000,
  application_name: "runeforge-production-verify",
});
const checks: Check[] = [];
const add = (name: string, ok: boolean, detail = "") => checks.push({ name, ok, detail });

async function count(sql: string, values: unknown[] = []): Promise<number> {
  const result = await pool.query(sql, values);
  return Number(result.rows[0]?.n ?? 0);
}

async function schemaChecks() {
  const required = ["players", "player_cards", "player_packs", "economy_transactions", "economy_action_receipts", "matches", "match_tokens", "replays", "pvp_rooms", "pvp_action_receipts", "pvp_spectator_snapshots", "matchmaking_queue", "ranked_matches", "ranked_seasons", "api_rate_limits", "shared_decks", "shared_deck_downloads", "payment_gateway_settings", "payment_orders", "collection_reward_claims", "admin_sandbox_sessions", "telemetry_events", "runeforge_schema_meta"];
  const result = await pool.query<{ table_name: string }>(
    "select table_name from information_schema.tables where table_schema='public' and table_name = any($1::text[])",
    [required],
  );
  const present = new Set(result.rows.map((row) => row.table_name));
  const missing = required.filter((table) => !present.has(table));
  add("required schema", missing.length === 0, missing.length ? `missing=${missing.join(",")}` : `${required.length} tables`);
  if (missing.length) throw new Error(`Required schema is incomplete: ${missing.join(", ")}`);

  const provenanceTables = ["match_tokens", "matches", "replays"];
  const columns = await pool.query<{ table_name: string }>(
    "select table_name from information_schema.columns where table_schema='public' and column_name='ai_difficulty' and table_name = any($1::text[])",
    [provenanceTables],
  );
  const withDifficulty = new Set(columns.rows.map((row) => row.table_name));
  const missingDifficulty = provenanceTables.filter((table) => !withDifficulty.has(table));
  add("AI difficulty provenance", missingDifficulty.length === 0, missingDifficulty.length ? `missing=${missingDifficulty.join(",")}` : "3 tables");
  if (missingDifficulty.length) throw new Error(`Migration 0027 is incomplete: ${missingDifficulty.join(", ")}`);

  const region3 = await count("select count(*) n from information_schema.columns where table_schema='public' and table_name='shared_decks' and column_name='region3'");
  add("multi-region community schema", region3 === 1, region3 === 1 ? "shared_decks.region3" : "missing shared_decks.region3");
  if (region3 !== 1) throw new Error("Migration 0029 is incomplete: shared_decks.region3 is missing");

  const schemaVersion = await count("select count(*) n from runeforge_schema_meta where version='2.97'");
  add("schema version metadata", schemaVersion === 1, schemaVersion === 1 ? "2.97 recorded" : "missing 2.97 metadata");
  if (schemaVersion === 0) throw new Error("Schema version metadata is incomplete");

  const requiredColumns = [
    ["game_settings", "revision"], ["matches", "engine_rules"], ["matches", "ai_rules"], ["match_tokens", "engine_rules"], ["match_tokens", "ai_rules"],
    ["mode_attempts", "engine_rules"], ["mode_attempts", "ai_rules"], ["replays", "engine_rules"],
    ["replays", "ai_rules"], ["replays", "canonical_deck_snapshot"], ["replays", "match_options_snapshot"],
    ["draft_sessions", "rules_snapshot"],
    ["players", "recovery_key_hash"], ["players", "recovery_key_expires_at"], ["pvp_rooms", "ranked_config_snapshot"], ["pvp_rooms", "ranked_season_id"], ["pvp_rooms", "content_snapshot"], ["pvp_rooms", "content_hash"], ["ranked_seasons", "control_key"], ["ranked_matches", "rules_version"], ["ranked_matches", "deck_pool_version"],
    ["payment_orders", "provider_environment"], ["custom_decks", "format_id"], ["shared_decks", "format_id"],
    ["card_catalog_meta", "art_url"], ["card_catalog_meta", "art_crop"],
  ] as const;
  for (const [table, column] of requiredColumns) {
    const n = await count("select count(*) n from information_schema.columns where table_schema='public' and table_name=$1 and column_name=$2", [table, column]);
    add(`schema column ${table}.${column}`, n === 1);
  }

  const requiredIndexes = [
    "economy_reward_idempotency_idx", "admin_content_versions_unique_version", "admin_content_releases_one_active",
    "draft_sessions_expires_idx", "pvp_rooms_expires_idx", "replays_versions_idx", "mode_attempts_expiry",
    "mode_attempts_player_lookup", "admin_sessions_expires_idx", "admin_sessions_actor_idx",
    "admin_content_dependencies_resource_idx", "admin_card_lab_runs_def_id_idx", "ranked_matches_player_match_uidx", "ranked_seasons_one_active", "ranked_seasons_control_key_unique", "pvp_rooms_ranked_season_idx",
    "matches_player_created_idx", "match_tokens_expires_idx", "matchmaking_mode_mmr_created_idx",
    "pvp_rooms_state_created_idx", "economy_transactions_player_created_idx", "mode_rewards_player_mode_uidx",
    "admin_content_versions_lookup_idx", "admin_audit_logs_created_idx", "admin_audit_logs_resource_idx",
    "admin_qa_runs_resource_idx", "admin_card_tests_card_idx", "admin_card_test_runs_card_idx",
    "admin_card_test_runs_created_idx",
    "payment_orders_player_created_idx", "payment_orders_status_idx", "payment_orders_provider_payment_unique",
    "collection_reward_claims_player_idx", "admin_sandbox_sessions_expires_idx", "telemetry_events_name_created_idx", "telemetry_events_player_created_idx",
    "custom_decks_format_idx", "shared_decks_format_idx",
    "economy_action_receipts_player_operation_idx", "economy_action_receipts_created_idx",
    "approval_resource_idx", "approval_status_idx",
    "balance_experiment_created_idx", "balance_experiment_status_idx", "balance_matchup_experiment_idx",
    "balance_matchup_decks_idx", "matches_player_mode_idx", "match_tokens_player_mode_idx", "pvp_rooms_mode_state_idx",
    "replays_match_mode_idx", "matches_opponent_idx", "player_dailies_player_quest_unique",
    "mode_attempts_player_deck_lookup", "pack_openings_player_seed_idx", "admin_card_archetypes_enabled_idx", "admin_users_enabled_idx",
  ];
  const indexRows = await pool.query<{ indexname: string }>(
    "select indexname from pg_indexes where schemaname='public' and indexname = any($1::text[])", [requiredIndexes],
  );
  const indexSet = new Set(indexRows.rows.map((row) => row.indexname));
  const missingIndexes = requiredIndexes.filter((name) => !indexSet.has(name));
  add("canonical historical indexes", missingIndexes.length === 0, missingIndexes.length ? `missing=${missingIndexes.join(",")}` : `${requiredIndexes.length} indexes`);
  if (missingIndexes.length) throw new Error(`Canonical index set is incomplete: ${missingIndexes.join(", ")}`);

  const economyIndex = await pool.query<{ indexdef: string }>(
    "select indexdef from pg_indexes where schemaname='public' and indexname='economy_reward_idempotency_idx' limit 1",
  );
  const economyIndexDef = String(economyIndex.rows[0]?.indexdef || "").toLowerCase().replace(/\s+/g, " ");
  const economyRewardOnly = economyIndexDef.includes("reason")
    && economyIndexDef.includes("match_reward")
    && economyIndexDef.includes("mode_reward");
  add("economy reward-only idempotency predicate", economyRewardOnly, economyRewardOnly ? "match_reward/mode_reward only" : economyIndexDef || "missing index definition");
  if (!economyRewardOnly) throw new Error("economy_reward_idempotency_idx predicate is missing reward-only scope");

  const requiredConstraints = [
    "admin_card_archetypes_base_type_check", "card_catalog_meta_collection_fk",
    "admin_card_tests_card_fk", "admin_card_test_runs_test_fk", "admin_card_test_runs_card_fk",
    "payment_gateway_settings_environment_check", "payment_orders_amount_positive", "payment_orders_environment_check", "collection_reward_claims_milestone_bounds",
    "fk_economy_action_receipts_player", "economy_action_receipts_operation_id_length", "fk_pvp_rooms_ranked_season", "fk_ranked_matches_season",
  ];
  const constraintRows = await pool.query<{ conname: string }>(
    "select conname from pg_constraint where conname = any($1::text[])", [requiredConstraints],
  );
  const constraintSet = new Set(constraintRows.rows.map((row) => row.conname));
  const missingConstraints = requiredConstraints.filter((name) => !constraintSet.has(name));
  add("canonical certification constraints", missingConstraints.length === 0, missingConstraints.length ? `missing=${missingConstraints.join(",")}` : `${requiredConstraints.length} constraints`);
  if (missingConstraints.length) throw new Error(`Certification constraints are incomplete: ${missingConstraints.join(", ")}`);
}

async function invariantChecks() {
  add("players non-negative economy", await count("select count(*) n from players where gold<0 or dust<0 or xp<0 or mmr<0") === 0);
  const capResult = await pool.query<{ cap: number }>(
    "select coalesce((select nullif(value #>> '{advanced,economy,duplicateCap}','')::int from game_settings where key='main' limit 1), 3)::int cap",
  );
  const duplicateCap = Math.max(1, Math.min(10, Number(capResult.rows[0]?.cap ?? 3)));
  add(`card ownership <= ${duplicateCap}`, await count("select count(*) n from player_cards where count<1 or count>$1", [duplicateCap]) === 0);
  add("pack count positive", await count("select count(*) n from player_packs where count<1") === 0);
  add("one ranked season active", await count("select count(*) n from ranked_seasons where active=true") <= 1);
  if (process.env.RANKED_RELEASE_CERTIFIED === "true") {
    const openSeasons = await count("select count(*) n from ranked_seasons where active=true and start_at <= now() and end_at > now()");
    add("certified Ranked has one open season", openSeasons === 1, `open=${openSeasons}`);
    if (openSeasons !== 1) throw new Error("RANKED_RELEASE_CERTIFIED=true requires exactly one currently open Ranked season");
  }
  const invalidActiveContentRooms = await count(`select count(*) n from pvp_rooms where state='playing' and (content_snapshot is null or content_hash is null or length(content_hash) < 16)`);
  add("active PvP rooms carry immutable content snapshot", invalidActiveContentRooms === 0, `invalid=${invalidActiveContentRooms}`);
  const invalidActiveRankedRooms = await count(`select count(*) n from pvp_rooms where mode='ranked' and state='playing' and (ranked_season_id is null or ranked_config_snapshot is null or content_snapshot is null or content_hash is null or not (ranked_config_snapshot ? 'rulesVersion') or not (ranked_config_snapshot ? 'deckPoolVersion') or not (ranked_config_snapshot ? 'hostDeckFingerprint') or not (ranked_config_snapshot ? 'guestDeckFingerprint'))`);
  add("active Ranked rooms carry immutable certification + content snapshots", invalidActiveRankedRooms === 0, `invalid=${invalidActiveRankedRooms}`);
  add("no duplicate matchmaking identity", await count("select count(*) n from (select player_id,mode,count(*) c from matchmaking_queue group by player_id,mode having count(*)>1)x") === 0);
  add("no duplicate match rewards", await count("select count(*) n from (select player_id,currency,reason,reference_type,reference_id,count(*) c from economy_transactions where reason in ('match_reward','mode_reward') and reference_id is not null group by player_id,currency,reason,reference_type,reference_id having count(*)>1)x") === 0);
  add("no active pvp self-match", await count("select count(*) n from pvp_rooms where host_player_id=guest_player_id and state in ('waiting','playing')") === 0);
  add("no duplicate PvP action receipts", await count("select count(*) n from (select room_id,player_id,action_id,count(*) c from pvp_action_receipts group by room_id,player_id,action_id having count(*)>1)x") === 0);
  add("no orphan ranked match", await count("select count(*) n from ranked_matches r left join matches m on m.id=r.match_id where r.match_id is not null and m.id is null") === 0);
}

async function serializedMutation(client: PoolClient, probeId: string, delta: number) {
  try {
    await client.query("begin");
    await client.query("select balance from rf_concurrency_probe where probe_id=$1 for update", [probeId]);
    await client.query("update rf_concurrency_probe set balance=balance+$1 where probe_id=$2", [delta, probeId]);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}


async function economyIdempotencyProbe() {
  const client = await pool.connect();
  const probeName = `__rf_verify_${randomUUID()}`;
  try {
    await client.query("begin");
    const player = await client.query<{ id: number }>("insert into players(name) values($1) returning id", [probeName]);
    const playerId = Number(player.rows[0]?.id);
    const values: Array<string | number> = [playerId, "gold", -1, 99, "pack_purchase", "pack", "basic"];
    await client.query("insert into economy_transactions(player_id,currency,amount,balance_after,reason,reference_type,reference_id) values($1,$2,$3,$4,$5,$6,$7)", values);
    await client.query("insert into economy_transactions(player_id,currency,amount,balance_after,reason,reference_type,reference_id) values($1,$2,$3,$4,$5,$6,$7)", values);
    add("repeatable non-reward economy operations", true, "same pack_purchase reference accepted twice");

    await client.query("savepoint reward_duplicate_probe");
    const reward: Array<string | number> = [playerId, "gold", 10, 109, "match_reward", "match", `verify-${randomUUID()}`];
    await client.query("insert into economy_transactions(player_id,currency,amount,balance_after,reason,reference_type,reference_id) values($1,$2,$3,$4,$5,$6,$7)", reward);
    let duplicateBlocked = false;
    try {
      await client.query("insert into economy_transactions(player_id,currency,amount,balance_after,reason,reference_type,reference_id) values($1,$2,$3,$4,$5,$6,$7)", reward);
    } catch (error) {
      duplicateBlocked = (error as { code?: string }).code === "23505";
      await client.query("rollback to savepoint reward_duplicate_probe");
    }
    add("reward economy idempotency", duplicateBlocked, duplicateBlocked ? "duplicate match_reward rejected" : "duplicate reward was accepted");
  } finally {
    await client.query("rollback").catch(() => undefined);
    client.release();
  }
}



async function paymentGatewayConfigurationProbe() {
  const settings = await getMercadoPagoSettings(true);
  if (!settings || !settings.enabled) {
    add("Mercado Pago gateway configuration", true, "disabled or not configured");
    return;
  }
  const ok = Boolean(settings.accessToken && settings.webhookSecret && settings.publicKey && ["sandbox","production"].includes(settings.environment));
  add("Mercado Pago gateway configuration", ok, ok ? `${settings.environment} credentials decrypt successfully` : "enabled gateway has incomplete/decryption-failed credentials");
  if (!ok) throw new Error("Enabled Mercado Pago gateway configuration is incomplete");
}

async function paymentExactlyOnceProbe() {
  const probeName = `__rf_payment_verify_${randomUUID()}`;
  const externalReference = `rf_verify_${randomUUID()}`;
  const preferenceId = `pref_${randomUUID()}`;
  const idempotencyKey = randomUUID();
  let playerId = 0;
  try {
    const player = await pool.query<{ id:number; gold:number }>("insert into players(name) values($1) returning id,gold", [probeName]);
    playerId = Number(player.rows[0]?.id);
    const before = Number(player.rows[0]?.gold || 0);
    await pool.query(
      "insert into payment_orders(player_id,provider,provider_environment,external_reference,product_key,product_name,amount_cents,currency,status,idempotency_key,provider_preference_id,grants) values($1,'mercadopago','sandbox',$2,'verify-product','Verify Product',990,'BRL','preference_created',$3,$4,$5::jsonb)",
      [playerId, externalReference, idempotencyKey, preferenceId, JSON.stringify({ gold: 123 })],
    );
    const payment = { id: `pay_${randomUUID()}`, external_reference: externalReference, transaction_amount: 9.9, currency_id: "BRL", preference_id: preferenceId, status: "approved", live_mode: false };
    const first = await processMercadoPagoPayment(payment, { expectedPlayerId: playerId });
    const second = await processMercadoPagoPayment(payment, { expectedPlayerId: playerId });
    const afterRow = await pool.query<{ gold:number }>("select gold from players where id=$1", [playerId]);
    const ledger = await count("select count(*) n from economy_transactions where player_id=$1 and reason='payment_purchase' and reference_type='payment' and reference_id=$2", [playerId, externalReference]);
    const fulfilled = await count("select count(*) n from payment_orders where player_id=$1 and external_reference=$2 and fulfilled_at is not null and status='approved'", [playerId, externalReference]);
    const after = Number(afterRow.rows[0]?.gold || 0);
    add("Mercado Pago exactly-once fulfillment", Boolean(first.fulfilled) && Boolean(second.alreadyFulfilled) && after === before + 123 && ledger === 1 && fulfilled === 1, `gold=${before}->${after}, ledger=${ledger}, fulfilled=${fulfilled}`);
  } finally {
    if (playerId) {
      await pool.query("delete from economy_transactions where player_id=$1", [playerId]).catch(() => undefined);
      await pool.query("delete from payment_orders where player_id=$1", [playerId]).catch(() => undefined);
      await pool.query("delete from players where id=$1", [playerId]).catch(() => undefined);
    }
  }
}

async function concurrencyProbe() {
  const probeId = randomUUID();
  await pool.query("create table if not exists rf_concurrency_probe(probe_id text primary key, balance integer not null)");
  await pool.query("insert into rf_concurrency_probe(probe_id,balance) values($1,0)", [probeId]);
  try {
    // Acquire inside each worker. Acquiring every client first deadlocks when
    // worker count exceeds pool.max because no acquired client can be released
    // until the outer Promise.all resolves.
    await runPooledWorkers(100, async (index) => {
      const client = await pool.connect();
      await serializedMutation(client, probeId, index % 2 === 0 ? 1 : -1);
    });
    const result = await pool.query("select balance from rf_concurrency_probe where probe_id=$1", [probeId]);
    const balance = Number(result.rows[0]?.balance);
    add("100 serialized DB mutations", balance === 0, `final=${balance}`);
  } finally {
    await pool.query("delete from rf_concurrency_probe where probe_id=$1", [probeId]);
  }
}

async function rollbackProbe() {
  const probeId = randomUUID();
  await pool.query("create table if not exists rf_concurrency_probe(probe_id text primary key, balance integer not null)");
  await pool.query("insert into rf_concurrency_probe(probe_id,balance) values($1,7)", [probeId]);
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("update rf_concurrency_probe set balance=999 where probe_id=$1", [probeId]);
    await client.query("rollback");
    const result = await pool.query("select balance from rf_concurrency_probe where probe_id=$1", [probeId]);
    add("transaction rollback", Number(result.rows[0]?.balance) === 7, `final=${result.rows[0]?.balance}`);
  } finally {
    client.release();
    await pool.query("delete from rf_concurrency_probe where probe_id=$1", [probeId]);
  }
}

async function lockProbe() {
  const playerId = Number(process.env.PRODUCTION_VERIFY_PLAYER_ID || 0);
  const required = process.env.RUN_DB_LOCK_SMOKE === "1";
  if (!playerId) {
    add("player row lock stress", !required, required
      ? "RUN_DB_LOCK_SMOKE=1 requires PRODUCTION_VERIFY_PLAYER_ID"
      : "skipped: set RUN_DB_LOCK_SMOKE=1 and PRODUCTION_VERIFY_PLAYER_ID");
    return;
  }
  await runPooledWorkers(50, async () => {
    const client = await pool.connect();
    try {
      await client.query("begin");
      const result = await client.query("select id from players where id=$1 for update", [playerId]);
      if (!result.rowCount) throw new Error("verification player not found");
      await client.query("select pg_sleep(0.002)");
      await client.query("rollback");
    } finally {
      client.release();
    }
  });
  add("player row lock stress", true, "50 concurrent FOR UPDATE transactions");
}

async function main() {
  try {
    await schemaChecks();
    await invariantChecks();
    await economyIdempotencyProbe();
    await paymentGatewayConfigurationProbe();
    await paymentExactlyOnceProbe();
    await concurrencyProbe();
    await rollbackProbe();
    await lockProbe();
    for (const check of checks) console.log(`${check.ok ? "PASS" : "FAIL"} ${check.name}${check.detail ? ` — ${check.detail}` : ""}`);
    const failed = checks.filter((check) => !check.ok);
    if (failed.length) process.exitCode = 1;
    else console.log(`PRODUCTION VERIFY: ${checks.length}/${checks.length} PASS`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
