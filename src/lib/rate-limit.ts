import crypto from "node:crypto";
import { pool } from "@/db";

function hashKey(value: string): string {
  return crypto.createHash("sha256").update(value.slice(0, 800)).digest("hex");
}

/**
 * Builds a privacy-preserving request key. When TRUST_PROXY=true we only trust
 * the explicitly configured proxy headers. Without a trusted proxy the Fetch
 * Request API does not expose the TCP peer address, so use a client fingerprint
 * instead of collapsing every visitor into the old single "direct" bucket.
 */
export function trustedClientKey(request: Request, scope: string): string {
  const trustProxy = process.env.TRUST_PROXY === "true";
  const forwarded = trustProxy ? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() : null;
  const realIp = trustProxy ? request.headers.get("x-real-ip")?.trim() : null;
  const address = forwarded || realIp;
  if (address) return `${scope}:ip:${hashKey(address)}`;

  const fingerprint = [
    request.headers.get("user-agent") || "unknown-agent",
    request.headers.get("accept-language") || "unknown-language",
    request.headers.get("sec-ch-ua") || "unknown-ua",
    request.headers.get("sec-ch-ua-platform") || "unknown-platform",
  ].join("|");
  return `${scope}:direct:${hashKey(fingerprint)}`;
}

export async function consumeRateLimit(key: string, limit: number, windowMs: number): Promise<{ allowed: boolean; remaining: number; retryAfterSeconds: number }> {
  const now = Date.now();
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs);
  const result = await pool.query<{ count: number }>(`
    INSERT INTO api_rate_limits(key, window_start, count, updated_at)
    VALUES($1, $2, 1, now())
    ON CONFLICT(key, window_start) DO UPDATE SET count = api_rate_limits.count + 1, updated_at = now()
    RETURNING count
  `, [key, windowStart]);
  const count = Number(result.rows[0]?.count ?? limit + 1);
  return { allowed: count <= limit, remaining: Math.max(0, limit - count), retryAfterSeconds: Math.max(1, Math.ceil((windowStart.getTime() + windowMs - now) / 1000)) };
}


/**
 * Request-facing limiter. Behind a trusted proxy the IP-derived bucket is
 * sufficient. Without one, combine the privacy-preserving client fingerprint
 * with a much wider global safety bucket so spoofing User-Agent headers cannot
 * turn the fingerprint fallback into an unlimited brute-force channel.
 */
export async function consumeRequestRateLimit(
  request: Request,
  scope: string,
  limit: number,
  windowMs: number,
): Promise<{ allowed: boolean; remaining: number; retryAfterSeconds: number }> {
  const client = await consumeRateLimit(trustedClientKey(request, scope), limit, windowMs);
  if (!client.allowed || process.env.TRUST_PROXY === "true") return client;

  const globalLimit = Math.max(limit * 50, limit + 1);
  const global = await consumeRateLimit(`${scope}:direct-global`, globalLimit, windowMs);
  return {
    allowed: global.allowed,
    remaining: Math.min(client.remaining, global.remaining),
    retryAfterSeconds: Math.max(client.retryAfterSeconds, global.retryAfterSeconds),
  };
}
