import { spawnSync } from "node:child_process";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("DATABASE_URL is required");

function run(script: string) {
  const result = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["run", script], {
    cwd: process.cwd(), env: process.env, stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

async function main() {
  const pool = new Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 5_000 });
  let script: "db:bootstrap" | "db:upgrade";
  try {
    const tables = await pool.query<{ n: string }>("select count(*)::text n from information_schema.tables where table_schema='public'");
    if (Number(tables.rows[0]?.n ?? 0) === 0) {
      script = "db:bootstrap";
    } else {
      const meta = await pool.query("select to_regclass('public.runeforge_schema_meta') existing");
      if (!meta.rows[0]?.existing) throw new Error("Migration refused: non-empty schema has no RuneForge provenance metadata");
      script = "db:upgrade";
    }
  } finally {
    await pool.end();
  }
  console.log(`DATABASE MIGRATE: routing to ${script}`);
  run(script);

  // Portal CMS is an additive, idempotent control-plane extension. Running it
  // after the canonical schema path keeps both fresh and upgraded databases in
  // parity without rewriting historical 2.97 migrations.
  const siteCms = spawnSync(process.execPath, ["--import", "tsx", "scripts/database-site-cms-migrate.ts"], {
    cwd: process.cwd(), env: process.env, stdio: "inherit",
  });
  if (siteCms.error) throw siteCms.error;
  if (siteCms.status !== 0) process.exit(siteCms.status ?? 1);
}
main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
