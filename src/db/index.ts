import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const globalForDb = globalThis as typeof globalThis & {
  __runeforgePostgresqlPool?: Pool;
};

function intEnv(name: string, fallback: number, min: number, max: number): number {
  const parsed = Number(process.env[name]);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

/**
 * Keep one pool per Node runtime, including production. This prevents hot
 * reloads/serverless module re-evaluation from multiplying pools inside the
 * same process. A provider-side pooler is still recommended for serverless.
 */
export const pool =
  globalForDb.__runeforgePostgresqlPool ??
  new Pool({
    connectionString: databaseUrl,
    max: intEnv("DB_POOL_MAX", process.env.NODE_ENV === "production" ? 5 : 10, 1, 50),
    idleTimeoutMillis: intEnv("DB_POOL_IDLE_TIMEOUT_MS", 30_000, 1_000, 300_000),
    connectionTimeoutMillis: intEnv("DB_POOL_CONNECTION_TIMEOUT_MS", 5_000, 500, 60_000),
  });

globalForDb.__runeforgePostgresqlPool = pool;

export const db = drizzle(pool);
