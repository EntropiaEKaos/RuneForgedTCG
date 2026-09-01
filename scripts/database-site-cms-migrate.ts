import fs from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("DATABASE_URL is required");

async function main() {
  const pool = new Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 5_000 });
  try {
    const existing = await pool.query("select to_regclass('public.site_content') existing");
    if (existing.rows[0]?.existing) {
      console.log("SITE CMS MIGRATION: already current");
      return;
    }
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("select pg_advisory_xact_lock(hashtext('runeforge-site-cms-upgrade'))");
      await client.query(await fs.readFile(path.join(process.cwd(), "drizzle/0042_site_portal_cms.sql"), "utf8"));
      await client.query("commit");
      console.log("SITE CMS MIGRATION: PASS");
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

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
