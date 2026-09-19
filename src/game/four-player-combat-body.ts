import type { CardDef, Race } from "./types";

export interface FourPlayerCombatBody {
  basePower: number;
  power: number;
  health: number;
  maxHealth: number;
  races: readonly Race[];
  classes: readonly string[];
  barrier: boolean;
  frostbitten: boolean;
}

function finiteStat(value: number | undefined, fallback: number, label: string): number {
  const resolved = value ?? fallback;
  if (!Number.isFinite(resolved) || resolved < 0) {
    throw new Error(`4P combat body ${label} must be a non-negative finite number.`);
  }
  return resolved;
}

export function createFourPlayerCombatBodySnapshot(card: Pick<
  CardDef,
  "type" | "power" | "health" | "race" | "secondaryRaces" | "classes" | "keywords"
>): FourPlayerCombatBody | undefined {
  if (card.type !== "Unit") return undefined;
  const power = finiteStat(card.power, 0, "power");
  const health = finiteStat(card.health, 1, "health");
  const races = [...new Set([card.race, ...(card.secondaryRaces ?? [])].filter(Boolean))] as Race[];
  return {
    basePower: power,
    power,
    health,
    maxHealth: health,
    races,
    classes: [...(card.classes ?? [])],
    barrier: Boolean(card.keywords?.includes("Barrier")),
    frostbitten: false,
  };
}

export function cloneFourPlayerCombatBody(body: FourPlayerCombatBody | undefined): FourPlayerCombatBody | undefined {
  if (!body) return undefined;
  return {
    ...body,
    races: [...body.races],
    classes: [...body.classes],
  };
}
