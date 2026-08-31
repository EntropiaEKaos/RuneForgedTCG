import fs from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("DATABASE_URL is required");
const files = ["database/baseline-2.31.sql", "drizzle/0017_security_matrix_integrity.sql", "drizzle/0018_ownership_integrity.sql", "drizzle/0025_production_certification.sql", "drizzle/0026_production_gameplay_2_56.sql", "drizzle/0027_gameplay_visual_2_65.sql", "drizzle/0028_total_control_plane.sql", "drizzle/0029_multiregion_identity.sql", "drizzle/0030_bugfix_integrity.sql", "drizzle/0031_certification_2_90.sql", "drizzle/0032_mvp_2_91.sql", "drizzle/0033_vanilla_collection_2_92.sql", "drizzle/0034_growth_commerce_2_93.sql", "drizzle/0035_release_hardening_2_94.sql", "drizzle/0036_sentinelas_convergence_2_96.sql", "drizzle/0037_schema_replay_hotfix_2_96_1.sql", "drizzle/0038_engineering_integrity_2_96_2.sql", "drizzle/0039_ranked_certification_2_97.sql", "drizzle/0040_pvp_content_snapshot_2_97.sql", "drizzle/0041_pvp_reaction_priority.sql"];
const pool = new Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 5_000 });

// Wrapped in an async main() — top-level await here breaks under tsx's CJS
// output ("Top-level await is currently not supported with the 'cjs' output
// format"), which meant `npm run db:bootstrap` could never actually run,
// on a fresh database, in CI, or for a first-time local/production setup.
async function main() {
  try {
    const existing = await pool.query<{ n: string }>("select count(*)::text n from information_schema.tables where table_schema='public'");
    if (Number(existing.rows[0]?.n ?? 0) > 0) throw new Error("Bootstrap refused: public schema is not empty. Use db:upgrade for an existing database.");
    const client = await pool.connect();
    try {
      await client.query("begin");
      // Migration 0029 records its own version, so the metadata table must exist
      // before any migration is applied on a fresh database.
      await client.query("create table if not exists runeforge_schema_meta(version text primary key, applied_at timestamp not null default now())");
      for (const file of files) {
        await client.query(await fs.readFile(path.join(process.cwd(), file), "utf8"));
        console.log(`APPLIED ${file}`);
      }
      await client.query("insert into runeforge_schema_meta(version) values($1) on conflict(version) do nothing", ["2.97"]);
      await client.query("commit");
      console.log("DATABASE BOOTSTRAP 2.97: PASS");
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
