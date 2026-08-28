/**
 * Production-oriented DB smoke harness.
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/postgres-concurrency-smoke.ts <playerId>
 *
 * This intentionally exercises the database primitives directly rather than
 * pretending that static source checks are equivalent to a real concurrency test.
 * It never mutates balances. It runs read-only invariant checks plus concurrent
 * lock probes against a real PostgreSQL instance.
 */
import pg from "pg";

const { Pool } = pg;
const url = process.env.DATABASE_URL;
const playerId = Number(process.argv[2]);
if (!url) throw new Error("DATABASE_URL is required");
if (!Number.isInteger(playerId) || playerId <= 0) throw new Error("Usage: ... <playerId>");

const pool = new Pool({ connectionString: url, max: 20 });
try {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: players } = await client.query(
      `SELECT id, gold, dust, xp, mmr, "rankedWins", "rankedLosses" FROM players WHERE id = $1`,
      [playerId],
    );
    if (!players[0]) throw new Error("Player not found");
    const p = players[0];
    for (const key of ["gold", "dust", "xp", "mmr", "rankedWins", "rankedLosses"]) {
      if (Number(p[key]) < 0) throw new Error(`Negative player invariant: ${key}`);
    }
    const { rows: activeSeasons } = await client.query(`SELECT count(*)::int AS count FROM ranked_seasons WHERE active = true`);
    if (Number(activeSeasons[0].count) > 1) throw new Error("More than one active ranked season exists");
    const { rows: overCap } = await client.query(`SELECT count(*)::int AS count FROM player_cards WHERE count < 1 OR count > 3`);
    if (Number(overCap[0].count) > 0) throw new Error("Card collection cap invariant violated");
    const { rows: badPacks } = await client.query(`SELECT count(*)::int AS count FROM player_packs WHERE count < 1`);
    if (Number(badPacks[0].count) > 0) throw new Error("Pack count invariant violated");
    await client.query("ROLLBACK");
  } finally {
    client.release();
  }

  // Lock-order smoke test: all workers lock the same player row, which should
  // serialize rather than deadlock. No mutation is performed.
  const started = Date.now();
  await Promise.all(Array.from({ length: 20 }, async () => {
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      await c.query("SELECT id FROM players WHERE id = $1 FOR UPDATE", [playerId]);
      await c.query("SELECT id FROM players WHERE id = $1", [playerId]);
      await c.query("ROLLBACK");
    } finally {
      c.release();
    }
  }));
  console.log(`PASS: invariants + 20 concurrent player-lock probes (${Date.now() - started}ms)`);
} finally {
  await pool.end();
}
