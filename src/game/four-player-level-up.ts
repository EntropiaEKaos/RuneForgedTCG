import { getCard } from "./cards";
import {
  createFourPlayerBattlefieldState,
  type FourPlayerBattlefieldObject,
} from "./four-player-battlefield";
import { createFourPlayerCombatBodySnapshot } from "./four-player-combat-body";
import type { FourPlayerSeat } from "./four-player-general";
import type { FourPlayerMatchState, FourPlayerProgressStats } from "./four-player-match";
import type { Keyword } from "./types";

export interface FourPlayerChampionProgress {
  current: number;
  goal: number;
  hint: string;
}

export interface FourPlayerLevelUpEvent {
  objectId: string;
  ownerSeat: FourPlayerSeat;
  controllerSeat: FourPlayerSeat;
  fromDefId: string;
  toDefId: string;
  kind: FourPlayerBattlefieldObject["kind"];
}

export interface FourPlayerLevelUpResult {
  match: FourPlayerMatchState;
  leveled: readonly FourPlayerLevelUpEvent[];
}

function statsFor(match: FourPlayerMatchState, seat: FourPlayerSeat): FourPlayerProgressStats {
  return match.seats[seat].stats ?? { nexusDamageDealt: 0, spellsCast: 0, alliesSummoned: 0 };
}

export function fourPlayerChampionProgress(
  match: FourPlayerMatchState,
  object: FourPlayerBattlefieldObject,
): FourPlayerChampionProgress | null {
  if (!object.combat || object.combat.health <= 0) return null;
  const definition = getCard(object.defId);
  if (!definition.levelUp) return null;
  const stats = statsFor(match, object.ownerSeat);
  let current = 0;
  switch (definition.levelUp.type) {
    case "nexusDamage":
      current = stats.nexusDamageDealt;
      break;
    case "spellsCast":
      current = stats.spellsCast;
      break;
    case "alliesSummoned":
      current = stats.alliesSummoned;
      break;
    case "nexusStrikes":
      current = object.nexusStrikes ?? 0;
      break;
  }
  return {
    current: Math.min(current, definition.levelUp.amount),
    goal: definition.levelUp.amount,
    hint: definition.levelUp.hint,
  };
}

function equipmentKeywords(object: FourPlayerBattlefieldObject): Keyword[] {
  return [...new Set((object.equipment ?? []).flatMap((entry) => entry.keywords))];
}

function transformObject(object: FourPlayerBattlefieldObject): FourPlayerBattlefieldObject | null {
  if (!object.combat || object.combat.health <= 0) return null;
  const definition = getCard(object.defId);
  if (!definition.levelUp) return null;
  const next = getCard(definition.levelUp.toDefId);
  if (next.type !== "Unit" || !next.isChampion) {
    throw new Error(`4P level-up target ${next.defId} must be a Champion Unit.`);
  }

  const oldPrinted = createFourPlayerCombatBodySnapshot(definition);
  const nextPrinted = createFourPlayerCombatBodySnapshot(next);
  if (!oldPrinted || !nextPrinted) throw new Error("4P Champion forms require combat bodies.");

  const powerDelta = object.combat.power - oldPrinted.power;
  const healthDelta = object.combat.maxHealth - oldPrinted.maxHealth;
  const maxHealth = Math.max(0, nextPrinted.maxHealth + healthDelta);
  const health = Math.max(0, Math.min(maxHealth, object.combat.health + (maxHealth - object.combat.maxHealth)));

  const oldPrintedKeywords = new Set(definition.keywords ?? []);
  const durableExtras = object.keywords.filter((keyword) => !oldPrintedKeywords.has(keyword));
  const keywords = [...new Set([
    ...(next.keywords ?? []),
    ...durableExtras,
    ...equipmentKeywords(object),
  ])];

  return {
    ...object,
    defId: next.defId,
    keywords,
    combat: {
      ...object.combat,
      basePower: nextPrinted.basePower,
      power: Math.max(0, nextPrinted.power + powerDelta),
      health,
      maxHealth,
      races: [...nextPrinted.races],
      classes: [...nextPrinted.classes],
      barrier: keywords.includes("Barrier"),
    },
  };
}

export function advanceFourPlayerLevelUps(match: FourPlayerMatchState): FourPlayerLevelUpResult {
  if (match.status === "completed") return { match, leveled: [] };
  const battlefield = match.battlefield ?? createFourPlayerBattlefieldState();
  const replacements = new Map<string, FourPlayerBattlefieldObject>();
  const leveled: FourPlayerLevelUpEvent[] = [];

  for (const object of battlefield.objects) {
    const progress = fourPlayerChampionProgress(match, object);
    if (!progress || progress.current < progress.goal) continue;
    const transformed = transformObject(object);
    if (!transformed) continue;
    replacements.set(object.id, transformed);
    leveled.push({
      objectId: object.id,
      ownerSeat: object.ownerSeat,
      controllerSeat: object.controllerSeat,
      fromDefId: object.defId,
      toDefId: transformed.defId,
      kind: object.kind,
    });
  }

  if (leveled.length === 0) return { match, leveled };

  let next: FourPlayerMatchState = {
    ...match,
    battlefield: {
      objects: battlefield.objects.map((object) => replacements.get(object.id) ?? object),
    },
  };

  for (const event of leveled) {
    if (event.kind !== "general") continue;
    const transformed = replacements.get(event.objectId);
    if (!transformed?.combat) continue;
    const general = next.generals[event.ownerSeat];
    const evolvedDefinition = getCard(transformed.defId);
    const evolvedPrintedBody = createFourPlayerCombatBodySnapshot(evolvedDefinition);
    if (!evolvedPrintedBody) throw new Error("4P evolved General requires a printed combat body.");
    next = {
      ...next,
      generals: {
        ...next.generals,
        [event.ownerSeat]: { ...general, defId: transformed.defId },
      },
      generalKeywords: {
        ...(next.generalKeywords ?? { p1: [], p2: [], p3: [], p4: [] }),
        [event.ownerSeat]: [...(evolvedDefinition.keywords ?? [])],
      },
      generalCombatBodies: {
        ...(next.generalCombatBodies ?? {}),
        [event.ownerSeat]: {
          ...evolvedPrintedBody,
          races: [...evolvedPrintedBody.races],
          classes: [...evolvedPrintedBody.classes],
        },
      },
    };
  }

  return { match: next, leveled };
}
