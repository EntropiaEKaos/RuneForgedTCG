import type { DeckDef } from "./decks";

/**
 * Vanilla experimental recipe helpers.
 *
 * Five Vanguards intentionally preserve the historical 36 Unit + 4 Spell intake.
 * Tidecall Vanguard owns an evidence-driven Vanilla 1.5 exception that reduces
 * duplicated top-end and adds regional control tools without changing CardDefs.
 * Ascendant keeps one copy of every regional `van_*` card and adds exactly ten
 * explicit duplicates selected by deterministic Balance Lab evidence. This
 * makes the recipe contract auditable while preserving 180/180 pool coverage.
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

function ascendantRecipe(prefix: VanillaPrefix, duplicateSuffixes: readonly RegionalSuffix[]): string[] {
  if (duplicateSuffixes.length !== 10 || new Set(duplicateSuffixes).size !== 10) {
    throw new Error(`${prefix}: Ascendant recipe requires exactly ten unique duplicate slots`);
  }
  const uniqueCards = allRegionalCards(prefix);
  const duplicates = duplicateSuffixes.map((suffix) => cardId(prefix, suffix));
  return [...uniqueCards, ...duplicates];
}

const ASCENDANT_DUPLICATES = {
  ember: ["u03", "u02", "u05", "u08", "u04", "u01", "u13", "u11", "u14", "u06"],
  tide: ["u01", "u02", "u03", "u04", "u05", "u06", "u09", "u10", "e01", "e02"],
  wood: ["u04", "u03", "u02", "u05", "u08", "u01", "u13", "u11", "u14", "u06"],
  void: ["u03", "u02", "u05", "u08", "u04", "u01", "u13", "u11", "u14", "u06"],
  forest: ["u03", "u02", "u05", "u08", "u04", "u01", "u13", "u11", "u14", "u06"],
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
    cards: vanguardRecipe("van_ember"),
  },
  {
    id: "vanilla_ember_2",
    name: "Emberhold Ascendant",
    regions: ["Emberhold"],
    description: "Experimental Vanilla archetype for Emberhold. Kept outside ranked until Balance Lab certification.",
    emoji: "🔥",
    cards: ascendantRecipe("van_ember", ASCENDANT_DUPLICATES.ember),
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
    cards: ascendantRecipe("van_tide", ASCENDANT_DUPLICATES.tide),
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
    cards: ascendantRecipe("van_wood", ASCENDANT_DUPLICATES.wood),
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
    cards: ascendantRecipe("van_void", ASCENDANT_DUPLICATES.void),
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
    cards: ascendantRecipe("van_forest", ASCENDANT_DUPLICATES.forest),
  },
  {
    id: "vanilla_storm_1",
    name: "Tempestade Vanguard",
    regions: ["Tempestade"],
    description: "Experimental Vanilla archetype for Tempestade. Kept outside ranked until Balance Lab certification.",
    emoji: "⚡",
    cards: vanguardRecipe("van_storm"),
  },
  {
    id: "vanilla_storm_2",
    name: "Tempestade Ascendant",
    regions: ["Tempestade"],
    description: "Experimental Vanilla archetype for Tempestade. Kept outside ranked until Balance Lab certification.",
    emoji: "⚡",
    cards: ascendantRecipe("van_storm", ASCENDANT_DUPLICATES.storm),
  },
];
