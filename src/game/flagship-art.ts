import type { Region } from "./types";

export type FlagshipArtTier = "champion" | "semantic" | "starter-signature";
export type FlagshipSemanticRole = "structure" | "ritual" | "trap";

export interface FlagshipArtTarget {
  defId: string;
  region: Region;
  tier: FlagshipArtTier;
  semanticRole?: FlagshipSemanticRole;
  assetPath: string;
  brief: string;
}

export const FLAGSHIP_ART_ROOT = "/art/cards/flagship";
export const FLAGSHIP_ART_FORMAT = {
  aspectRatio: "4:5",
  masterWidth: 1536,
  masterHeight: 1920,
  delivery: "webp",
  safeZone: "keep faces, focal silhouettes and critical props inside the central 70% so CardView crops remain safe",
} as const;

export const FLAGSHIP_ART_STYLE_BIBLE: Record<Region, { palette: string; light: string; motifs: string }> = {
  Emberhold: {
    palette: "obsidian, furnace orange, ember red, forged gold",
    light: "hard volcanic rim light, hot sparks, deep smoke",
    motifs: "dragon-forges, basalt citadels, molten runes, hammered metal",
  },
  Tidecall: {
    palette: "deep navy, luminous cyan, pearl white, sea-glass teal",
    light: "volumetric underwater caustics and moonlit mist",
    motifs: "tide temples, memory sigils, coral architecture, suspended water",
  },
  Ironwood: {
    palette: "ancient bark brown, moss green, amber sap, muted jade",
    light: "soft forest shafts, bioluminescent spores, warm dawn",
    motifs: "living fortresses, colossal roots, carved druidic circles, iron-barked beasts",
  },
  Voidborn: {
    palette: "black violet, abyssal blue, ghost silver, toxic magenta",
    light: "cold backlight, eclipsed halos, void bloom",
    motifs: "impossible monoliths, fractured shadows, soul smoke, corrupted constellations",
  },
  Florestia: {
    palette: "lush emerald, moonlit turquoise, warm fur tones, pollen gold",
    light: "dappled moonlight, fireflies, dawn haze",
    motifs: "ancestral dens, pack totems, flowering ruins, primal beasts",
  },
  Tempestade: {
    palette: "storm blue, electric white, violet charge, pale gold",
    light: "lightning rim light, cloud glow, high-altitude sun shafts",
    motifs: "sky bastions, winged warriors, storm engines, charged runes",
  },
};

const target = (
  defId: string,
  region: Region,
  tier: FlagshipArtTier,
  brief: string,
  semanticRole?: FlagshipSemanticRole,
): FlagshipArtTarget => ({
  defId,
  region,
  tier,
  semanticRole,
  assetPath: `${FLAGSHIP_ART_ROOT}/${region.toLowerCase()}/${defId}.webp`,
  brief,
});

/**
 * Alpha flagship set: 30 unique master artworks.
 * Champion masters are intentionally reused by their evolved forms for Alpha;
 * evolved-specific illustrations are a post-Alpha luxury, not a release blocker.
 */
export const FLAGSHIP_ART_TARGETS: FlagshipArtTarget[] = [
  // ── Champions: one master identity per region ────────────────────────────
  target("ember_champion", "Emberhold", "champion", "Pyra as the unmistakable face of Emberhold: regal dragon champion, forge crown, controlled inferno, heroic low angle."),
  target("tide_champion", "Tidecall", "champion", "Nerida as Tidecall royalty: spectral tide empress commanding suspended water and memory sigils, elegant but formidable."),
  target("wood_champion", "Ironwood", "champion", "Ancient Ironwood champion as a colossal living guardian, iron bark, luminous sap and overwhelming rooted presence."),
  target("void_champion", "Voidborn", "champion", "Voidborn champion emerging from an eclipsed abyss, predatory silhouette, soul-light and impossible shadow geometry."),
  target("forest_champion", "Florestia", "champion", "Florestia pack champion at the head of an ancestral hunt, primal nobility, moonlit jungle and protective ferocity."),
  target("storm_champion", "Tempestade", "champion", "Tempestade champion above the cloudline, angelic aerial authority, lightning-wreathed armor and storm-broken sky."),

  // ── Emberhold semantic trio ──────────────────────────────────────────────
  target("rfalpha_ember_structure_forge_bastion", "Emberhold", "semantic", "A red-forge bastion physically anchored into basalt, furnace vents and defensive dragon reliefs; it must read as a permanent fortification.", "structure"),
  target("rfalpha_ember_ritual_red_rite", "Emberhold", "semantic", "A deliberate mana rite inside a forge circle: molten runes channel controlled power into a central reservoir rather than a generic explosion.", "ritual"),
  target("rfalpha_ember_trap_ash_snare", "Emberhold", "semantic", "A reaction trap snapping shut in a corridor of embers, diagonal motion and sudden heat bloom; readable as interruption, not proactive sorcery.", "trap"),

  // ── Tidecall semantic trio ───────────────────────────────────────────────
  target("rfalpha_tide_structure_silent_beacon", "Tidecall", "semantic", "A silent beacon-temple standing in black water, concentric tide rings and cyan signal light; serene permanent battlefield landmark.", "structure"),
  target("rfalpha_tide_ritual_memory_tide", "Tidecall", "semantic", "A memory tide ritual where spell-mana currents are recycled through floating glyphs and mirrored water, contemplative and precise.", "ritual"),
  target("rfalpha_tide_trap_countercurrent", "Tidecall", "semantic", "A countercurrent seal intercepting an incoming magical force, two opposing water vectors colliding around a bright reaction sigil.", "trap"),

  // ── Ironwood semantic trio ───────────────────────────────────────────────
  target("rfalpha_wood_structure_root_circle", "Ironwood", "semantic", "An enormous root circle grown into a defensive living structure, iron bark arches and amber sap conduits.", "structure"),
  target("rfalpha_wood_ritual_ancient_roots", "Ironwood", "semantic", "Druids invest mana into ancient roots that store power beneath the battlefield, patient growth and visible resource flow.", "ritual"),
  target("rfalpha_wood_trap_emergency_bark", "Ironwood", "semantic", "Emergency bark erupts around an ally at the instant of impact, layered living armor and a clear reactive moment.", "trap"),

  // ── Voidborn semantic trio ───────────────────────────────────────────────
  target("rfalpha_void_structure_hollow_obelisk", "Voidborn", "semantic", "A hollow obelisk bending nearby starlight, permanent void monument with a predatory absence at its center.", "structure"),
  target("rfalpha_void_ritual_emptiness", "Voidborn", "semantic", "A forbidden mana rite draining luminous resource threads into a controlled void aperture; elegant corruption rather than chaotic horror.", "ritual"),
  target("rfalpha_void_trap_early_eclipse", "Voidborn", "semantic", "A sudden premature eclipse swallowing an incoming action, sharp black halo and reaction-focused composition.", "trap"),

  // ── Florestia semantic trio ──────────────────────────────────────────────
  target("rfalpha_forest_structure_ancestral_den", "Florestia", "semantic", "An ancestral beast den grown around carved pack totems, protective roots and warm interior life; unmistakably a permanent home.", "structure"),
  target("rfalpha_forest_ritual_green_moon", "Florestia", "semantic", "Pack shamans conduct a green-moon mana rite, pooling natural energy around paw-marked stones before the hunt.", "ritual"),
  target("rfalpha_forest_trap_pack_ambush", "Florestia", "semantic", "A coordinated beast ambush exploding from layered foliage, eye-lines converging on the intruder and strong reactive motion.", "trap"),

  // ── Tempestade semantic trio ─────────────────────────────────────────────
  target("rfalpha_storm_structure_first_thunder", "Tempestade", "semantic", "A sky tower that captures the first thunderbolt of a storm, permanent charged architecture above the clouds.", "structure"),
  target("rfalpha_storm_ritual_eye_of_storm", "Tempestade", "semantic", "A controlled eye-of-the-storm mana ceremony, calm center surrounded by rotating lightning and disciplined resource channeling.", "ritual"),
  target("rfalpha_storm_trap_crosswind", "Tempestade", "semantic", "A violent crosswind interrupts an airborne advance at the decisive instant, diagonal cloud shear and lightning reaction cue.", "trap"),

  // ── Starter signatures chosen from the authored doctrine contracts ──────
  target("ember_ashguard", "Emberhold", "starter-signature", "Ashguard holding a forge gate under impossible heat, the visual thesis for Emberhold pressure backed by martial discipline."),
  target("tide_cloudpiercer", "Tidecall", "starter-signature", "Cloudpiercer rising through sea mist and suspended water, an evasive late-game Tidecall threat with graceful vertical composition."),
  target("wood_canopy_bastion", "Ironwood", "starter-signature", "Canopy Bastion as a massive living bulwark beneath an ancient forest crown, resilience made architectural."),
  target("void_gloom_warden", "Voidborn", "starter-signature", "Gloom Warden patrolling an abyssal threshold, lifeless silver armor and void mist defining controlled dread."),
  target("forest_dawn_alpha", "Florestia", "starter-signature", "Dawn Alpha leading the pack through luminous jungle at first light, communal strength rather than solitary monster fantasy."),
  target("storm_static_adept", "Tempestade", "starter-signature", "Static Adept shaping lightning around precise hand sigils on a high sky platform, speed and technical storm mastery."),
];

export function flagshipArtTarget(defId: string): FlagshipArtTarget | undefined {
  return FLAGSHIP_ART_TARGETS.find((entry) => entry.defId === defId);
}

export function flagshipArtTargetsForRegion(region: Region): FlagshipArtTarget[] {
  return FLAGSHIP_ART_TARGETS.filter((entry) => entry.region === region);
}
