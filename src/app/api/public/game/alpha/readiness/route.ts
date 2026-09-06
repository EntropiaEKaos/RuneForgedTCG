import { db } from "@/db";
import { sql } from "drizzle-orm";
import { ENGINE_VERSION, RULESET_VERSION } from "@/game/version";
import { CONTENT_VERSION } from "@/game/content-version";
import { APP_RELEASE } from "@/lib/release";
import { runtimeStatus } from "@/lib/runtime-gates";
import { buildPublicAlphaReadiness } from "@/lib/public-alpha-readiness";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    const runtime = await runtimeStatus();
    const readiness = buildPublicAlphaReadiness(runtime, {
      release: APP_RELEASE,
      engineVersion: ENGINE_VERSION,
      rulesetVersion: RULESET_VERSION,
      contentVersion: CONTENT_VERSION,
    });

    return Response.json({ ok: true, readiness }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      { ok: false, error: "Public Alpha readiness unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "5" } },
    );
  }
}
