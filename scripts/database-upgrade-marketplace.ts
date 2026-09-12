import fs from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("DATABASE_URL is required");

async function main() {
  const pool = new Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 5_000 });
  try {
    const core = await pool.query("select to_regclass('public.players') players, to_regclass('public.player_cards') player_cards, to_regclass('public.runeforge_schema_meta') meta");
    if (!core.rows[0]?.players || !core.rows[0]?.player_cards || !core.rows[0]?.meta) {
      throw new Error("Marketplace upgrade refused: certified RuneForge core schema is missing");
    }
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("select pg_advisory_xact_lock(hashtext('runeforge-schema-upgrade'))");
      const sql = await fs.readFile(path.join(process.cwd(), "drizzle/0043_p2p_marketplace.sql"), "utf8");
      await client.query(sql);
      await client.query("commit");
      console.log("DATABASE UPGRADE — P2P MARKETPLACE 1.0: PASS");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
