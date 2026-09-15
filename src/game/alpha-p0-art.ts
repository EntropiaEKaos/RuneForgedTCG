import type { Region } from "./types";
import { FLAGSHIP_ART_FORMAT } from "./flagship-art";

export interface AlphaP0ArtTarget {
  defId: string;
  region: Region;
  assetPath: string;
  brief: string;
}

export const ALPHA_P0_ART_ROOT = "/art/cards/alpha-p0";
export const ALPHA_P0_ART_FORMAT = FLAGSHIP_ART_FORMAT;

const target = (defId: string, region: Region, brief: string): AlphaP0ArtTarget => ({
  defId,
  region,
  assetPath: `${ALPHA_P0_ART_ROOT}/${region.toLowerCase()}/${defId}.webp`,
  brief,
});

/**
 * Production contract for the first 21-card P0 art sprint.
 *
 * Targets remain production intent until they are explicitly promoted into
 * ALPHA_P0_ACTIVE_IDS after physical-master and browser certification. This keeps
 * runtime resolution and reported coverage fail-closed for undelivered targets.
 */
export const ALPHA_P0_ART_TARGETS: AlphaP0ArtTarget[] = [
  target("ember_bolt", "Emberhold", "Scorching Bolt: a compact forge-fire projectile ripping across a basalt combat lane, immediate speed and impact, no generic fireball composition."),
  target("wood_webweaver", "Ironwood", "Silkweb Weaver: an iron-barked forest arachnid or druidic web-weaver spanning luminous silk between colossal roots, defensive intelligence over horror."),
  target("tide_guard", "Tidecall", "Tidal Warden: disciplined guardian framed by suspended water shields and cyan tide sigils, calm defensive authority in a moonlit temple approach."),
  target("wood_growth", "Ironwood", "Wild Growth: roots and ironwood vines erupting in controlled layers around an allied position, visible reinforcement and resource-rich amber sap."),
  target("wood_mend", "Ironwood", "Nature's Mending: living bark knitting back together under warm sap-light and drifting spores, restorative focus rather than explosive magic."),
  target("ember_sprinter", "Emberhold", "Blitzrunner: agile Emberhold skirmisher sprinting through sparks and forge smoke, low aggressive camera and unmistakable forward momentum."),
  target("wood_ward", "Ironwood", "Barkskin: layered iron bark sealing around a protected fighter at the instant of danger, tactile resilience and warm amber sap seams."),
  target("ember_face", "Emberhold", "A direct Emberhold pressure strike aimed at the opposing line: disciplined furnace aggression, red-hot motion and readable offensive intent."),
  target("ember_drake", "Emberhold", "Young forge drake banking above basalt battlements, ember-lit scales and compact predatory silhouette, clearly distinct from the regal champion identity."),
  target("ember_stun", "Emberhold", "A concussive forge shock halting an enemy mid-action, hammer-like heat wave and sparks frozen around the interrupted target."),
  target("forest_canopy_warden", "Florestia", "Canopy Warden: ancestral jungle guardian watching from intertwined boughs, pack-protective posture, moonlit turquoise foliage and pollen gold."),
  target("forest_cub", "Florestia", "Young pack cub moving with alert confidence through luminous undergrowth, communal warmth and future strength rather than comic cuteness."),
  target("storm_dashbolt", "Tempestade", "Dashbolt: a precise lightning-assisted aerial dash across a storm platform, diagonal speed line and sharp electric-white trail."),
  target("storm_eye", "Tempestade", "A warrior or adept centered in the calm eye of a violent storm, disciplined control surrounded by rotating cloud and charge."),
  target("storm_herald", "Tempestade", "Storm Herald announcing the charge above cloudline bastions, winged or aerial silhouette with pale-gold authority and branching lightning."),
  target("storm_lightning", "Tempestade", "A focused lightning strike descending from engineered storm clouds onto a battlefield target, precise geometry and technical storm mastery."),
  target("storm_sky_sentinel", "Tempestade", "Sky Sentinel guarding a high-altitude bastion edge, vigilant armored silhouette against electric clouds and distant sun shafts."),
  target("storm_strikecaller", "Tempestade", "Strikecaller directing multiple lightning vectors with deliberate hand or weapon signals, battlefield conductor rather than uncontrolled mage."),
  target("tide_sprite", "Tidecall", "Tide Sprite formed from luminous seawater and pearl light, small but elegant elemental presence near coral architecture and suspended droplets."),
  target("void_drain", "Voidborn", "Controlled void drain pulling luminous essence threads into a compact abyssal aperture, elegant predation with eclipsed halo and soul smoke."),
  target("wood_cub", "Ironwood", "Young ironwood beast beneath colossal roots, sturdy bark-like hide and amber-sap accents, resilient juvenile guardian rather than pet imagery."),
];

export const ALPHA_P0_ACTIVE_IDS = [
  "ember_bolt",
  "wood_webweaver",
  "tide_guard",
  "wood_growth",
  "wood_mend",
  "ember_sprinter",
  "wood_ward",
  "ember_face",
  "ember_drake",
  "ember_stun",
  "forest_canopy_warden",
  "forest_cub",
  "storm_dashbolt",
  "storm_eye",
  "storm_herald",
] as const;

const activeIds = new Set<string>(ALPHA_P0_ACTIVE_IDS);

export const ALPHA_P0_ACTIVE_TARGETS = ALPHA_P0_ART_TARGETS.filter((entry) => activeIds.has(entry.defId));

export function alphaP0ArtTarget(defId: string): AlphaP0ArtTarget | undefined {
  return ALPHA_P0_ART_TARGETS.find((entry) => entry.defId === defId);
}

export function alphaP0ActiveArtTarget(defId: string): AlphaP0ArtTarget | undefined {
  return activeIds.has(defId) ? alphaP0ArtTarget(defId) : undefined;
}

export function alphaP0ArtUrl(defId: string): string | undefined {
  return alphaP0ActiveArtTarget(defId)?.assetPath;
}
