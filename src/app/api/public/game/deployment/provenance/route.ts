import { ENGINE_VERSION, RULESET_VERSION } from "@/game/version";
import { CONTENT_VERSION } from "@/game/content-version";
import { readDeploymentProvenance } from "@/lib/deployment-provenance";
import { APP_RELEASE } from "@/lib/release";

export const dynamic = "force-dynamic";

export async function GET() {
  const provenance = readDeploymentProvenance();
  if (!provenance) {
    return Response.json(
      { ok: false, error: "Deployment provenance unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "5" } },
    );
  }

  return Response.json({
    ok: true,
    deployment: {
      schemaVersion: 1,
      release: APP_RELEASE,
      engineVersion: ENGINE_VERSION,
      rulesetVersion: RULESET_VERSION,
      contentVersion: CONTENT_VERSION,
      ...provenance,
    },
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}
