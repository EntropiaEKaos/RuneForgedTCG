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

export const ALPHA_P1_BATCH_1_IDS = [
  "ember_duelist",
  "ember_raider",
  "ember_herald",
  "ember_whelp",
  "ember_zealot",
] as const;

export const ALPHA_P1_BATCH_2_IDS = [
  "ember_blade",
  "ember_phantom",
  "forest_pack_shelter",
  "forest_summon_pack",
  "forest_packrunner",
] as const;

/**
 * Certified Alpha P1 physical-production registry.
 *
 * Batches remain explicit so each content slice can be certified independently.
 * Runtime resolution only considers ids in ALPHA_P1_ACTIVE_IDS.
 */
export const ALPHA_P1_ART_TARGETS: AlphaP1ArtTarget[] = [
  // Batch 1 — Emberhold teaching identities.
  target("ember_duelist", "Emberhold", "Ash Duelist: a disciplined single-combat fighter in an obsidian dueling ring, twin forge blades held in a precise asymmetric stance, furnace rim light and sparks emphasizing control rather than a generic soldier."),
  target("ember_raider", "Emberhold", "Ashfront Raider: a fast front-line skirmisher charging diagonally through forge smoke and basalt debris with a long jagged polearm, aggressive forward pressure and a low camera distinct from the Duelist."),
  target("ember_herald", "Emberhold", "Cinder Herald: an upright battlefield standard-bearer signaling an Emberhold advance beneath furnace glow, tall banner silhouette, hammered metal heraldry and organized martial authority rather than spellcasting."),
  target("ember_whelp", "Emberhold", "Cinder Whelp: a compact young forge-drake moving low across hot basalt, angular reptilian silhouette, ember-lit scales and smoke from the nostrils, clearly a dangerous juvenile creature rather than cute pet imagery."),
  target("ember_zealot", "Emberhold", "Emberfang Zealot: a broad armored devotee advancing frontally with fang-shaped pauldrons and a glowing ritual weapon, controlled fanatic intensity, ember-red scars and forged-gold details without resembling the Raider."),

  // Batch 2 — next deterministic Studio P1 queue slice.
  target("ember_blade", "Emberhold", "Flamebrand: a veteran Emberhold blade-bearer presenting a long forge-tempered sword whose edge glows from internal heat, restrained martial silhouette, obsidian plate and furnace reflections with no spellcaster pose."),
  target("ember_phantom", "Emberhold", "Flame Phantom: a heat-haze infiltrator emerging between basalt columns, half the armored silhouette breaking into ember afterimages, predatory lateral motion and a readable humanoid form rather than an abstract fire elemental."),
  target("forest_pack_shelter", "Florestia", "Abrigo da Matilha: an ancestral living shelter formed by colossal roots, broad leaves and pack-marked stone, warm interior pollen light and several protective beast silhouettes establishing safety and community."),
  target("forest_summon_pack", "Florestia", "Convocar a Matilha: a primal caller raises a moonlit pack signal as multiple beasts converge through layered jungle paths, coordinated arrival and communal momentum rather than a single monster portrait."),
  target("forest_packrunner", "Florestia", "Corredora da Matilha: a swift Florestia scout sprinting low through luminous undergrowth beside blurred pack tracks, athletic beast-hunter silhouette, turquoise moonlight and pollen-gold accents emphasizing speed and belonging."),
];

export const ALPHA_P1_ACTIVE_IDS = [
  ...ALPHA_P1_BATCH_1_IDS,
  ...ALPHA_P1_BATCH_2_IDS,
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
