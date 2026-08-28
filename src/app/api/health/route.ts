import { db } from "@/db";
import { sql } from "drizzle-orm";
import { ENGINE_VERSION, RULESET_VERSION } from "@/game/version";
import { CONTENT_VERSION } from "@/game/content-version";
import { operationalLog } from "@/lib/operational-logger";
import { APP_RELEASE } from "@/lib/release";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = request.headers.get("x-request-id") || "unassigned";
  const ready = new URL(request.url).searchParams.get("ready") === "1";
  if (!ready) {
    return Response.json(
      { ok: true, status: "alive", release: APP_RELEASE, engineVersion: ENGINE_VERSION, rulesetVersion: RULESET_VERSION, contentVersion: CONTENT_VERSION },
      { headers: { "cache-control": "no-store", "x-request-id": requestId } },
    );
  }
  try {
    await db.execute(sql`select 1`);
    return Response.json(
      { ok: true, status: "ready", database: "available", release: APP_RELEASE },
      { headers: { "cache-control": "no-store", "x-request-id": requestId } },
    );
  } catch (error) {
    operationalLog("error", "health.readiness.failed", { requestId, error });
    return Response.json(
      { ok: false, status: "not_ready", database: "unavailable", requestId },
      { status: 503, headers: { "cache-control": "no-store", "retry-after": "5", "x-request-id": requestId } },
    );
  }
}
