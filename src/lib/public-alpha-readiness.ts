export type PublicAlphaRuntimeStatus = {
  maintenanceMode: boolean;
  aiEnabled: boolean;
  rankedEnabled: boolean;
  rankedConfigured: boolean;
  rankedCertified: boolean;
};

export type PublicAlphaVersions = {
  release: string;
  engineVersion: string;
  rulesetVersion: string;
  contentVersion: string;
};

export type PublicAlphaCapability = {
  key: "onboarding" | "deck-selection" | "mulligan" | "pve" | "forge" | "rewards-progression" | "casual-pvp";
  label: string;
  status: "available" | "temporarily-unavailable";
  route: string;
};

export type PublicAlphaReadinessDto = {
  alpha: "playable";
  state: "ready" | "limited" | "maintenance";
  release: PublicAlphaVersions;
  entryRoute: "/play";
  capabilities: PublicAlphaCapability[];
  boundaries: {
    rankedPublicLaunchRequirement: false;
    realMoneyPaymentsLaunchRequirement: false;
    largeScaleLiveOpsLaunchRequirement: false;
    rankedOperational: boolean;
  };
};

export function buildPublicAlphaReadiness(
  runtime: PublicAlphaRuntimeStatus,
  versions: PublicAlphaVersions,
): PublicAlphaReadinessDto {
  const generalAvailable = !runtime.maintenanceMode;
  const aiAvailable = generalAvailable && runtime.aiEnabled;
  const state: PublicAlphaReadinessDto["state"] = runtime.maintenanceMode
    ? "maintenance"
    : runtime.aiEnabled
      ? "ready"
      : "limited";

  const capability = (
    key: PublicAlphaCapability["key"],
    label: string,
    route: string,
    available: boolean,
  ): PublicAlphaCapability => ({
    key,
    label,
    status: available ? "available" : "temporarily-unavailable",
    route,
  });

  return {
    alpha: "playable",
    state,
    release: versions,
    entryRoute: "/play",
    capabilities: [
      capability("onboarding", "Primeiro acesso guiado", "/play", generalAvailable),
      capability("deck-selection", "Seleção de deck", "/play", generalAvailable),
      capability("mulligan", "Mulligan", "/play", generalAvailable),
      capability("pve", "Partida PvE autoritativa", "/play", aiAvailable),
      capability("forge", "Forge e decks persistidos", "/forge", generalAvailable),
      capability("rewards-progression", "Recompensas e progressão persistida", "/profile", generalAvailable),
      capability("casual-pvp", "PvP Casual autoritativo", "/pvp", generalAvailable),
    ],
    boundaries: {
      rankedPublicLaunchRequirement: false,
      realMoneyPaymentsLaunchRequirement: false,
      largeScaleLiveOpsLaunchRequirement: false,
      rankedOperational: runtime.rankedEnabled,
    },
  };
}
