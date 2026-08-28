import { copyFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import dotenv from "dotenv";
import pg from "pg";

const { Pool } = pg;
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const docker = process.platform === "win32" ? "docker.exe" : "docker";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", env: process.env, ...options });
  if (result.error) {
    if (result.error.code === "ENOENT") {
      throw new Error(`${command} was not found. Install Docker Desktop and make sure it is available in PATH.`);
    }
    throw result.error;
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForPostgres(databaseUrl) {
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    const pool = new Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 1_000 });
    try {
      await pool.query("select 1");
      return;
    } catch {
      if (attempt === 60) throw new Error("PostgreSQL did not become ready within 60 seconds.");
    } finally {
      await pool.end().catch(() => {});
    }
    await delay(1_000);
  }
}

async function databaseState(databaseUrl) {
  const pool = new Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 5_000 });
  try {
    const tables = await pool.query("select count(*)::int as count from information_schema.tables where table_schema='public'");
    const count = Number(tables.rows[0]?.count ?? 0);
    if (count === 0) return { kind: "empty" };
    const meta = await pool.query("select to_regclass('public.runeforge_schema_meta')::text as name");
    if (!meta.rows[0]?.name) return { kind: "unknown", count };
    const versions = await pool.query("select version from runeforge_schema_meta order by applied_at desc limit 1");
    return { kind: "runeforge", version: String(versions.rows[0]?.version ?? "unknown") };
  } finally {
    await pool.end();
  }
}

async function main() {
  if (!existsSync(".env.local")) {
    copyFileSync(".env.example", ".env.local");
    console.log("Created .env.local from the local-alpha template.");
  }
  dotenv.config({ path: ".env.local", quiet: true });
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL is missing from .env.local");

  run(docker, ["compose", "up", "-d", "postgres"]);
  await waitForPostgres(databaseUrl);

  const state = await databaseState(databaseUrl);
  if (state.kind === "empty") {
    run(npm, ["run", "db:bootstrap"]);
  } else if (state.kind === "unknown") {
    throw new Error(`The alpha database contains ${state.count} public tables but is not a recognized RuneForge schema.`);
  } else if (state.version !== "2.97") {
    throw new Error(`RuneForge database schema ${state.version} requires an explicit upgrade before this alpha can start.`);
  } else {
    console.log(`RuneForge database schema ${state.version} is already ready.`);
  }

  console.log("\nPlayable alpha setup complete. Start it with: npm run dev");
  console.log("Open http://127.0.0.1:3000 and choose Play Now.");
}

main().catch((error) => {
  console.error(`ALPHA SETUP FAILED: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});

