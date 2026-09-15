import type { Region } from "./types";
import { FLAGSHIP_ART_FORMAT } from "./flagship-art";

export interface AlphaP1ArtTarget {
  defId: string;
  region: Region;
  assetPath: string;
  brief: string;
}

export const ALPHA_P1_ART_ROOT = "/art/cards/alpha-p1";
export const ALPHA_P1_ART_FORMAT = FLAGSHIP_ART_FORMAT;

const target = (defId: string, region: Region, brief: string): AlphaP1ArtTarget => ({
  defId,
  region,
  assetPath: `${ALPHA_P1_ART_ROOT}/${region.toLowerCase()}/${defId}.webp`,
  brief,
});

/**
 * Certified physical production contract for the first Alpha P1 batch.
 * Runtime promotion stays explicit through ALPHA_P1_ACTIVE_IDS so future P1
 * batches can remain fail-closed until their own activation certification.
 */
export const ALPHA_P1_ART_TARGETS: AlphaP1ArtTarget[] = [
  target("ember_duelist", "Emberhold", "Ash Duelist: a disciplined single-combat fighter in an obsidian dueling ring, twin forge blades held in a precise asymmetric stance, furnace rim light and sparks emphasizing control rather than a generic soldier."),
  target("ember_raider", "Emberhold", "Ashfront Raider: a fast front-line skirmisher charging diagonally through forge smoke and basalt debris with a long jagged polearm, aggressive forward pressure and a low camera distinct from the Duelist."),
  target("ember_herald", "Emberhold", "Cinder Herald: an upright battlefield standard-bearer signaling an Emberhold advance beneath furnace glow, tall banner silhouette, hammered metal heraldry and organized martial authority rather than spellcasting."),
  target("ember_whelp", "Emberhold", "Cinder Whelp: a compact young forge-drake moving low across hot basalt, angular reptilian silhouette, ember-lit scales and smoke from the nostrils, clearly a dangerous juvenile creature rather than cute pet imagery."),
  target("ember_zealot", "Emberhold", "Emberfang Zealot: a broad armored devotee advancing frontally with fang-shaped pauldrons and a glowing ritual weapon, controlled fanatic intensity, ember-red scars and forged-gold details without resembling the Raider."),
];

export const ALPHA_P1_ACTIVE_IDS = [
  "ember_duelist",
  "ember_raider",
  "ember_herald",
  "ember_whelp",
  "ember_zealot",
] as const;

const activeIds = new Set<string>(ALPHA_P1_ACTIVE_IDS);

export const ALPHA_P1_ACTIVE_TARGETS = ALPHA_P1_ART_TARGETS.filter((entry) => activeIds.has(entry.defId));

export function alphaP1ArtTarget(defId: string): AlphaP1ArtTarget | undefined {
  return ALPHA_P1_ART_TARGETS.find((entry) => entry.defId === defId);
}

export function alphaP1ActiveArtTarget(defId: string): AlphaP1ArtTarget | undefined {
  return activeIds.has(defId) ? alphaP1ArtTarget(defId) : undefined;
}

export function alphaP1ArtUrl(defId: string): string | undefined {
  return alphaP1ActiveArtTarget(defId)?.assetPath;
}
