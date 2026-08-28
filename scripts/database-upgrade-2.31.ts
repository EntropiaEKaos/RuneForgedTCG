import fs from "node:fs/promises";
import path from "node:path";
import { Pool, type PoolClient } from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const upgradePlans: Array<{ when: (versions: Set<string>) => boolean; files: string[] }> = [
  { when: (v) => v.has("2.96.2"), files: ["drizzle/0039_ranked_certification_2_97.sql", "drizzle/0040_pvp_content_snapshot_2_97.sql"] },
  { when: (v) => v.has("2.96.1"), files: ["drizzle/0038_engineering_integrity_2_96_2.sql", "drizzle/0039_ranked_certification_2_97.sql", "drizzle/0040_pvp_content_snapshot_2_97.sql"] },
  { when: (v) => v.has("2.96"), files: ["drizzle/0037_schema_replay_hotfix_2_96_1.sql", "drizzle/0038_engineering_integrity_2_96_2.sql", "drizzle/0039_ranked_certification_2_97.sql", "drizzle/0040_pvp_content_snapshot_2_97.sql"] },
  { when: (v) => v.has("2.94") || v.has("2.95"), files: ["drizzle/0036_sentinelas_convergence_2_96.sql", "drizzle/0037_schema_replay_hotfix_2_96_1.sql", "drizzle/0038_engineering_integrity_2_96_2.sql", "drizzle/0039_ranked_certification_2_97.sql", "drizzle/0040_pvp_content_snapshot_2_97.sql"] },
  { when: (v) => v.has("2.93"), files: ["drizzle/0035_release_hardening_2_94.sql", "drizzle/0036_sentinelas_convergence_2_96.sql", "drizzle/0037_schema_replay_hotfix_2_96_1.sql", "drizzle/0038_engineering_integrity_2_96_2.sql", "drizzle/0039_ranked_certification_2_97.sql", "drizzle/0040_pvp_content_snapshot_2_97.sql"] },
  { when: (v) => v.has("2.92"), files: ["drizzle/0034_growth_commerce_2_93.sql", "drizzle/0035_release_hardening_2_94.sql", "drizzle/0036_sentinelas_convergence_2_96.sql", "drizzle/0037_schema_replay_hotfix_2_96_1.sql", "drizzle/0038_engineering_integrity_2_96_2.sql", "drizzle/0039_ranked_certification_2_97.sql", "drizzle/0040_pvp_content_snapshot_2_97.sql"] },
  { when: (v) => v.has("2.91"), files: ["drizzle/0033_vanilla_collection_2_92.sql", "drizzle/0034_growth_commerce_2_93.sql", "drizzle/0035_release_hardening_2_94.sql", "drizzle/0036_sentinelas_convergence_2_96.sql", "drizzle/0037_schema_replay_hotfix_2_96_1.sql", "drizzle/0038_engineering_integrity_2_96_2.sql", "drizzle/0039_ranked_certification_2_97.sql", "drizzle/0040_pvp_content_snapshot_2_97.sql"] },
  { when: (v) => v.has("2.90"), files: ["drizzle/0032_mvp_2_91.sql", "drizzle/0033_vanilla_collection_2_92.sql", "drizzle/0034_growth_commerce_2_93.sql", "drizzle/0035_release_hardening_2_94.sql", "drizzle/0036_sentinelas_convergence_2_96.sql", "drizzle/0037_schema_replay_hotfix_2_96_1.sql", "drizzle/0038_engineering_integrity_2_96_2.sql", "drizzle/0039_ranked_certification_2_97.sql", "drizzle/0040_pvp_content_snapshot_2_97.sql"] },
  { when: (v) => v.has("2.89") || v.has("2.88"), files: ["drizzle/0031_certification_2_90.sql", "drizzle/0032_mvp_2_91.sql", "drizzle/0033_vanilla_collection_2_92.sql", "drizzle/0034_growth_commerce_2_93.sql", "drizzle/0035_release_hardening_2_94.sql", "drizzle/0036_sentinelas_convergence_2_96.sql", "drizzle/0037_schema_replay_hotfix_2_96_1.sql", "drizzle/0038_engineering_integrity_2_96_2.sql", "drizzle/0039_ranked_certification_2_97.sql", "drizzle/0040_pvp_content_snapshot_2_97.sql"] },
  { when: (v) => v.has("2.87"), files: ["drizzle/0030_bugfix_integrity.sql", "drizzle/0031_certification_2_90.sql", "drizzle/0032_mvp_2_91.sql", "drizzle/0033_vanilla_collection_2_92.sql", "drizzle/0034_growth_commerce_2_93.sql", "drizzle/0035_release_hardening_2_94.sql", "drizzle/0036_sentinelas_convergence_2_96.sql", "drizzle/0037_schema_replay_hotfix_2_96_1.sql", "drizzle/0038_engineering_integrity_2_96_2.sql", "drizzle/0039_ranked_certification_2_97.sql", "drizzle/0040_pvp_content_snapshot_2_97.sql"] },
  { when: (v) => v.has("2.31"), files: [
    "drizzle/0025_production_certification.sql",
    "drizzle/0026_production_gameplay_2_56.sql",
    "drizzle/0027_gameplay_visual_2_65.sql",
    "drizzle/0028_total_control_plane.sql",
    "drizzle/0029_multiregion_identity.sql",
    "drizzle/0030_bugfix_integrity.sql",
    "drizzle/0031_certification_2_90.sql",
    "drizzle/0032_mvp_2_91.sql",
    "drizzle/0033_vanilla_collection_2_92.sql",
    "drizzle/0034_growth_commerce_2_93.sql",
    "drizzle/0035_release_hardening_2_94.sql",
    "drizzle/0036_sentinelas_convergence_2_96.sql",
    "drizzle/0037_schema_replay_hotfix_2_96_1.sql",
    "drizzle/0038_engineering_integrity_2_96_2.sql",
    "drizzle/0039_ranked_certification_2_97.sql",
    "drizzle/0040_pvp_content_snapshot_2_97.sql",
  ] },
];

async function applyFiles(client: PoolClient, files: string[]) {
  for (const file of files) {
    await client.query(await fs.readFile(path.join(process.cwd(), file), "utf8"));
    console.log(`APPLIED ${file}`);
  }
}

async function main() {
  const pool = new Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 5_000 });
  try {
    const players = await pool.query("select to_regclass('public.players') existing");
    if (!players.rows[0]?.existing) throw new Error("Upgrade refused: players table is missing; use db:bootstrap for an empty database");
    const meta = await pool.query("select to_regclass('public.runeforge_schema_meta') existing");
    if (!meta.rows[0]?.existing) throw new Error("Upgrade refused: existing database has no runeforge_schema_meta provenance; audit it manually before migration");
    const versionRows = await pool.query<{ version: string }>("select version from runeforge_schema_meta");
    const versions = new Set<string>(versionRows.rows.map((row) => row.version));
    if (versions.has("2.97")) {
      const requiredColumns = await pool.query<{ table_name: string; column_name: string }>(
        "select table_name,column_name from information_schema.columns where table_schema='public' and ((table_name='pvp_rooms' and column_name = any($1::text[])) or (table_name='ranked_matches' and column_name = any($2::text[])))",
        [["ranked_season_id", "content_snapshot", "content_hash"], ["rules_version", "deck_pool_version"]],
      );
      const columnKeys = new Set(requiredColumns.rows.map((row) => `${row.table_name}.${row.column_name}`));
      const requiredColumnKeys = [
        "pvp_rooms.ranked_season_id", "pvp_rooms.content_snapshot", "pvp_rooms.content_hash",
        "ranked_matches.rules_version", "ranked_matches.deck_pool_version",
      ];
      const constraintRows = await pool.query<{ conname: string }>(
        "select conname from pg_constraint where conname = any($1::text[])",
        [["fk_pvp_rooms_ranked_season", "fk_ranked_matches_season"]],
      );
      const constraints = new Set(constraintRows.rows.map((row) => row.conname));
      const indexRows = await pool.query<{ indexname: string }>(
        "select indexname from pg_indexes where schemaname='public' and indexname='pvp_rooms_ranked_season_idx'",
      );
      const complete = requiredColumnKeys.every((key) => columnKeys.has(key))
        && constraints.has("fk_pvp_rooms_ranked_season")
        && constraints.has("fk_ranked_matches_season")
        && indexRows.rows.length === 1;
      if (complete) {
        console.log("DATABASE UPGRADE 2.97: already current");
        return;
      }
      const repairClient = await pool.connect();
      try {
        await repairClient.query("begin");
        await repairClient.query("select pg_advisory_xact_lock(hashtext('runeforge-schema-upgrade'))");
        await applyFiles(repairClient, ["drizzle/0039_ranked_certification_2_97.sql", "drizzle/0040_pvp_content_snapshot_2_97.sql"]);
        await repairClient.query("commit");
        console.log("DATABASE UPGRADE 2.97: repaired Ranked/content certification schema");
        return;
      } catch (error) {
        await repairClient.query("rollback");
        throw error;
      } finally {
        repairClient.release();
      }
    }
    const plan = upgradePlans.find((candidate) => candidate.when(versions));
    if (!plan) throw new Error(`Upgrade refused: unsupported schema provenance [${[...versions].sort().join(", ") || "empty"}]`);

    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("select pg_advisory_xact_lock(hashtext('runeforge-schema-upgrade'))");
      await applyFiles(client, plan.files);
      await client.query("insert into runeforge_schema_meta(version) values($1) on conflict(version) do nothing", ["2.97"]);
      await client.query("commit");
      console.log("DATABASE UPGRADE 2.97: PASS");
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
