import type { DeckDef } from "./decks";

/**
 * Vanilla experimental recipe helpers.
 *
 * Three Vanguards preserve the historical 36 Unit + 4 Spell intake. Tidecall,
 * Tempestade and Emberhold own evidence-driven regional exceptions from Vanilla
 * 1.5, 1.6 and 1.7 respectively. They change recipe concentration only; CardDefs
 * remain untouched.
 *
 * Every Ascendant keeps one copy of all 30 regional `van_*` cards. The ten
 * remaining slots are explicit and evidence-selected. Vanilla 1.7 allows those
 * ten slots to concentrate a card up to the runtime-legal three-copy ceiling,
 * while preserving 30/30 regional coverage and the global 180/180 pool.
 */
type VanillaPrefix =
  | "van_ember"
  | "van_tide"
  | "van_wood"
  | "van_void"
  | "van_forest"
  | "van_storm";

type RegionalSuffix =
  | `u${string}`
  | `s${string}`
  | "e01"
  | "e02"
  | "a01"
  | "q01";

function cardId(prefix: VanillaPrefix, suffix: RegionalSuffix): string {
  return `${prefix}_${suffix}`;
}

function unitIds(prefix: VanillaPrefix): string[] {
  return Array.from({ length: 18 }, (_, index) => cardId(prefix, `u${String(index + 1).padStart(2, "0")}`));
}

function spellIds(prefix: VanillaPrefix): string[] {
  return Array.from({ length: 8 }, (_, index) => cardId(prefix, `s${String(index + 1).padStart(2, "0")}`));
}

function allRegionalCards(prefix: VanillaPrefix): string[] {
  return [
    ...unitIds(prefix),
    ...spellIds(prefix),
    cardId(prefix, "e01"),
    cardId(prefix, "e02"),
    cardId(prefix, "a01"),
    cardId(prefix, "q01"),
  ];
}

function vanguardRecipe(prefix: VanillaPrefix): string[] {
  return [
    ...unitIds(prefix).flatMap((defId) => [defId, defId]),
    cardId(prefix, "s01"),
    cardId(prefix, "s01"),
    cardId(prefix, "s02"),
    cardId(prefix, "s02"),
  ];
}

/** Vanilla 1.5: 32 Units + 8 Spells, with only one copy of u15-u18. */
function tidecallVanguardRecipe(): string[] {
  const units = unitIds("van_tide");
  return [
    ...units.slice(0, 14).flatMap((defId) => [defId, defId]),
    ...units.slice(14),
    cardId("van_tide", "s01"),
    cardId("van_tide", "s01"),
    cardId("van_tide", "s02"),
    cardId("van_tide", "s02"),
    cardId("van_tide", "s05"),
    cardId("van_tide", "s05"),
    cardId("van_tide", "s06"),
    cardId("van_tide", "s06"),
  ];
}

/** Vanilla 1.6: 32 Units + 8 Spells, with u03/u05/u08/u11 as singletons. */
function tempestadeVanguardRecipe(): string[] {
  const units = unitIds("van_storm");
  const singletonUnits = new Set([
    cardId("van_storm", "u03"),
    cardId("van_storm", "u05"),
    cardId("van_storm", "u08"),
    cardId("van_storm", "u11"),
  ]);
  return [
    ...units.flatMap((defId) => singletonUnits.has(defId) ? [defId] : [defId, defId]),
    cardId("van_storm", "s01"),
    cardId("van_storm", "s01"),
    cardId("van_storm", "s02"),
    cardId("van_storm", "s02"),
    cardId("van_storm", "s05"),
    cardId("van_storm", "s05"),
    cardId("van_storm", "s06"),
    cardId("van_storm", "s06"),
  ];
}

/** Vanilla 1.7: remove one u13 Haste+Tough copy and add one regional Stun. */
function emberholdVanguardRecipe(): string[] {
  const singleton = cardId("van_ember", "u13");
  return [
    ...unitIds("van_ember").flatMap((defId) => defId === singleton ? [defId] : [defId, defId]),
    cardId("van_ember", "s01"),
    cardId("van_ember", "s01"),
    cardId("van_ember", "s02"),
    cardId("van_ember", "s02"),
    cardId("van_ember", "s04"),
  ];
}

function ascendantRecipe(prefix: VanillaPrefix, extraSuffixes: readonly RegionalSuffix[]): string[] {
  if (extraSuffixes.length !== 10) {
    throw new Error(`${prefix}: Ascendant recipe requires exactly ten extra slots`);
  }
  const extraCounts = new Map<RegionalSuffix, number>();
  for (const suffix of extraSuffixes) {
    const count = (extraCounts.get(suffix) ?? 0) + 1;
    if (count > 2) throw new Error(`${prefix}: ${suffix} would exceed the three-copy ceiling`);
    extraCounts.set(suffix, count);
  }
  return [...allRegionalCards(prefix), ...extraSuffixes.map((suffix) => cardId(prefix, suffix))];
}

const ASCENDANT_EXTRAS = {
  ember: ["u03", "u02", "u05", "u08", "u04", "u01", "u13", "u11", "u14", "u06"],
  tide: ["u01", "u02", "u03", "u04", "u05", "u06", "u09", "u10", "e01", "e02"],
  // Vanilla 1.7: five closing bodies at three copies each.
  wood: ["u03", "u03", "u08", "u08", "u11", "u11", "u13", "u13", "u18", "u18"],
  // Vanilla 1.7: same concentration policy was strongest for Voidborn.
  void: ["u03", "u03", "u08", "u08", "u11", "u11", "u13", "u13", "u18", "u18"],
  // Vanilla 1.7: triple midgame leverage, double four complementary bodies.
  forest: ["u08", "u08", "u11", "u11", "u13", "u13", "u03", "u05", "u14", "u18"],
  storm: ["u08", "u03", "u02", "u05", "u04", "u01", "u13", "u11", "u14", "u06"],
} satisfies Record<string, readonly RegionalSuffix[]>;

/** 12 experimental Vanilla archetypes. They are intentionally excluded from Ranked until certified. */
export const VANILLA_EXPERIMENTAL_DECKS: DeckDef[] = [
  {
    id: "vanilla_ember_1",
    name: "Emberhold Vanguard",
    regions: ["Emberhold"],
    description: "Experimental Vanilla archetype for Emberhold. Kept outside ranked until Balance Lab certification.",
    emoji: "🔥",
    cards: emberholdVanguardRecipe(),
  },
  {
    id: "vanilla_ember_2",
    name: "Emberhold Ascendant",
    regions: ["Emberhold"],
    description: "Experimental Vanilla archetype for Emberhold. Kept outside ranked until Balance Lab certification.",
    emoji: "🔥",
    cards: ascendantRecipe("van_ember", ASCENDANT_EXTRAS.ember),
  },
  {
    id: "vanilla_tide_1",
    name: "Tidecall Vanguard",
    regions: ["Tidecall"],
    description: "Experimental Vanilla archetype for Tidecall. Kept outside ranked until Balance Lab certification.",
    emoji: "🌊",
    cards: tidecallVanguardRecipe(),
  },
  {
    id: "vanilla_tide_2",
    name: "Tidecall Ascendant",
    regions: ["Tidecall"],
    description: "Experimental Vanilla archetype for Tidecall. Kept outside ranked until Balance Lab certification.",
    emoji: "🌊",
    cards: ascendantRecipe("van_tide", ASCENDANT_EXTRAS.tide),
  },
  {
    id: "vanilla_wood_1",
    name: "Ironwood Vanguard",
    regions: ["Ironwood"],
    description: "Experimental Vanilla archetype for Ironwood. Kept outside ranked until Balance Lab certification.",
    emoji: "🌿",
    cards: vanguardRecipe("van_wood"),
  },
  {
    id: "vanilla_wood_2",
    name: "Ironwood Ascendant",
    regions: ["Ironwood"],
    description: "Experimental Vanilla archetype for Ironwood. Kept outside ranked until Balance Lab certification.",
    emoji: "🌿",
    cards: ascendantRecipe("van_wood", ASCENDANT_EXTRAS.wood),
  },
  {
    id: "vanilla_void_1",
    name: "Voidborn Vanguard",
    regions: ["Voidborn"],
    description: "Experimental Vanilla archetype for Voidborn. Kept outside ranked until Balance Lab certification.",
    emoji: "☠️",
    cards: vanguardRecipe("van_void"),
  },
  {
    id: "vanilla_void_2",
    name: "Voidborn Ascendant",
    regions: ["Voidborn"],
    description: "Experimental Vanilla archetype for Voidborn. Kept outside ranked until Balance Lab certification.",
    emoji: "☠️",
    cards: ascendantRecipe("van_void", ASCENDANT_EXTRAS.void),
  },
  {
    id: "vanilla_forest_1",
    name: "Florestia Vanguard",
    regions: ["Florestia"],
    description: "Experimental Vanilla archetype for Florestia. Kept outside ranked until Balance Lab certification.",
    emoji: "🐺",
    cards: vanguardRecipe("van_forest"),
  },
  {
    id: "vanilla_forest_2",
    name: "Florestia Ascendant",
    regions: ["Florestia"],
    description: "Experimental Vanilla archetype for Florestia. Kept outside ranked until Balance Lab certification.",
    emoji: "🐺",
    cards: ascendantRecipe("van_forest", ASCENDANT_EXTRAS.forest),
  },
  {
    id: "vanilla_storm_1",
    name: "Tempestade Vanguard",
    regions: ["Tempestade"],
    description: "Experimental Vanilla archetype for Tempestade. Kept outside ranked until Balance Lab certification.",
    emoji: "⚡",
    cards: tempestadeVanguardRecipe(),
  },
  {
    id: "vanilla_storm_2",
    name: "Tempestade Ascendant",
    regions: ["Tempestade"],
    description: "Experimental Vanilla archetype for Tempestade. Kept outside ranked until Balance Lab certification.",
    emoji: "⚡",
    cards: ascendantRecipe("van_storm", ASCENDANT_EXTRAS.storm),
  },
];
