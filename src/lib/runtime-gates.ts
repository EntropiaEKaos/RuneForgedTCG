import { ensureConfigLoaded, type GameConfig } from "@/game/settings";

export type RuntimeFeature = "general" | "ai" | "ranked";

export function rankedReleaseCertified(): boolean {
  return process.env.RANKED_RELEASE_CERTIFIED === "true";
}

export function rankedOperational(config: Pick<GameConfig, "rankedEnabled">): boolean {
  return config.rankedEnabled && rankedReleaseCertified();
}

export async function runtimeGate(feature: RuntimeFeature = "general"): Promise<Response | null> {
  const config = await ensureConfigLoaded();
  if (config.maintenanceMode) {
    return Response.json(
      { ok: false, error: "RuneForge is in maintenance mode. Please try again shortly.", code: "MAINTENANCE_MODE" },
      { status: 503, headers: { "retry-after": "60" } },
    );
  }
  if (feature === "ai" && !config.aiEnabled) {
    return Response.json(
      { ok: false, error: "AI gameplay is temporarily disabled.", code: "AI_DISABLED" },
      { status: 503, headers: { "retry-after": "60" } },
    );
  }
  if (feature === "ranked" && !rankedOperational(config)) {
    return Response.json(
      { ok: false, error: "Ranked is disabled until the competitive release gate is certified.", code: "RANKED_DISABLED" },
      { status: 423 },
    );
  }
  return null;
}

export async function runtimeStatus() {
  const config = await ensureConfigLoaded();
  return {
    maintenanceMode: config.maintenanceMode,
    aiEnabled: config.aiEnabled,
    rankedEnabled: rankedOperational(config),
    rankedConfigured: config.rankedEnabled,
    rankedCertified: rankedReleaseCertified(),
  };
}
