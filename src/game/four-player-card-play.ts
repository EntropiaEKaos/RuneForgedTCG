import { getCard } from "./cards";
import {
  createFourPlayerBattlefieldState,
  putFourPlayerBattlefieldObject,
  type FourPlayerBattlefieldKind,
} from "./four-player-battlefield";
import { createFourPlayerCombatBodySnapshot, type FourPlayerCombatBody } from "./four-player-combat-body";
import { resolveFourPlayerEffect } from "./four-player-effect-resolution";
import {
  findFourPlayerHandCard,
  takeFourPlayerCardFromHand,
  type FourPlayerCardInstance,
  type FourPlayerCardZones,
} from "./four-player-card-zones";
import type { FourPlayerSeat } from "./four-player-general";
import type { FourPlayerMatchState } from "./four-player-match";
import type { FourPlayerStackItem } from "./four-player-stack";
import type { FourPlayerTargetRef } from "./four-player-targeting";
import type { CardEffect, CardType, Keyword } from "./types";

export const FOUR_PLAYER_STAGEABLE_CARD_TYPES = ["Unit", "Enchantment", "Artifact", "Sentinela", "Spell"] as const;
export type FourPlayerStageableCardType = (typeof FOUR_PLAYER_STAGEABLE_CARD_TYPES)[number];

export interface FourPlayerCardCastPayload {
  instanceId: string;
  defId: string;
  ownerSeat: FourPlayerSeat;
  cardType: FourPlayerStageableCardType;
  keywords: readonly Keyword[];
  combat?: FourPlayerCombatBody;
  effect?: CardEffect;
  target?: FourPlayerTargetRef;
}

export interface FourPlayerStagedCardCast {
  match: FourPlayerMatchState;
  zones: FourPlayerCardZones;
  card: FourPlayerCardInstance;
  stackItem: FourPlayerStackItem<FourPlayerCardCastPayload>;
}

function isStageableType(type: CardType): type is FourPlayerStageableCardType {
  return (FOUR_PLAYER_STAGEABLE_CARD_TYPES as readonly CardType[]).includes(type);
}

function assertCardPlayTiming(match: FourPlayerMatchState, actor: FourPlayerSeat): void {
  if (match.status !== "active") throw new Error("Completed four-player matches cannot stage cards.");
  if (match.seats[actor].eliminated) throw new Error(`Eliminated seat ${actor} cannot stage cards.`);
  if (match.resolution.priority.holder !== actor) {
    throw new Error(`Seat ${actor} does not hold priority; ${match.resolution.priority.holder} does.`);
  }
  if (match.turn.activeSeat !== actor) {
    throw new Error(`Only active seat ${match.turn.activeSeat} may stage sorcery-speed cards.`);
  }
  if (match.phase !== "main_1" && match.phase !== "main_2") {
    throw new Error("4P physical card staging requires a main phase.");
  }
  if (match.resolution.stack.items.length > 0) {
    throw new Error("4P physical card staging requires an empty stack.");
  }
}

export function stageFourPlayerCardCast(
  match: FourPlayerMatchState,
  zones: FourPlayerCardZones,
  actor: FourPlayerSeat,
  instanceId: string,
  eventId: string,
  target?: FourPlayerTargetRef,
): FourPlayerStagedCardCast {
  assertCardPlayTiming(match, actor);
  const card = findFourPlayerHandCard(zones, actor, instanceId);
  const definition = getCard(card.defId);
  if (!isStageableType(definition.type)) {
    throw new Error(`Card type ${definition.type} is not stageable by 4P physical play authority yet.`);
  }
  if (!Number.isFinite(definition.cost) || definition.cost < 0) {
    throw new Error(`Card ${definition.defId} has invalid authoritative cost.`);
  }
  const seat = match.seats[actor];
  if (seat.mana < definition.cost) {
    throw new Error(`Insufficient mana to play ${definition.defId}: requires ${definition.cost}, has ${seat.mana}.`);
  }
  const taken = takeFourPlayerCardFromHand(zones, actor, card.instanceId);
  const paidMatch: FourPlayerMatchState = {
    ...match,
    seats: {
      ...match.seats,
      [actor]: { ...seat, mana: seat.mana - definition.cost },
    },
  };
  const combat = createFourPlayerCombatBodySnapshot(definition);
  if (definition.type === "Spell") {
    if (!definition.spell) throw new Error(`Spell ${definition.defId} has no authoritative effect.`);
    resolveFourPlayerEffect(match, actor, definition.spell, target);
  }
  const payload: FourPlayerCardCastPayload = {
    instanceId: card.instanceId,
    defId: card.defId,
    ownerSeat: actor,
    cardType: definition.type,
    keywords: [...(definition.keywords ?? [])],
    ...(combat ? { combat } : {}),
    ...(definition.type === "Spell" && definition.spell ? { effect: structuredClone(definition.spell), ...(target ? { target } : {}) } : {}),
  };
  return {
    match: paidMatch,
    zones: taken.zones,
    card,
    stackItem: {
      id: `card:${card.instanceId}:${eventId}`,
      controller: actor,
      kind: definition.type === "Spell" ? "spell_cast" : "card_cast",
      payload,
    },
  };
}

function battlefieldKind(type: Exclude<FourPlayerStageableCardType, "Spell">): FourPlayerBattlefieldKind {
  if (type === "Unit") return "unit";
  if (type === "Sentinela") return "sentinela";
  return "permanent";
}

export function resolveFourPlayerCardCast(
  match: FourPlayerMatchState,
  item: FourPlayerStackItem,
): FourPlayerMatchState {
  if (item.kind !== "card_cast") return match;
  const payload = item.payload as Partial<FourPlayerCardCastPayload>;
  if (!payload.instanceId || !payload.defId || !payload.ownerSeat || !payload.cardType) {
    throw new Error("Resolved 4P card cast is missing authoritative identity.");
  }
  if (payload.ownerSeat !== item.controller) {
    throw new Error("Resolved 4P card owner/controller identity mismatch.");
  }
  if (!(FOUR_PLAYER_STAGEABLE_CARD_TYPES as readonly string[]).includes(payload.cardType) || payload.cardType === "Spell") {
    throw new Error(`Resolved 4P permanent type ${payload.cardType} is unsupported.`);
  }
  return {
    ...match,
    battlefield: putFourPlayerBattlefieldObject(
      match.battlefield ?? createFourPlayerBattlefieldState(),
      {
        id: payload.instanceId,
        defId: payload.defId,
        kind: battlefieldKind(payload.cardType as Exclude<FourPlayerStageableCardType, "Spell">),
        ownerSeat: payload.ownerSeat,
        controllerSeat: item.controller,
        enteredTurn: match.turn.turn,
        keywords: payload.keywords ?? [],
        combat: payload.combat,
      },
    ),
  };
}


export function resolveFourPlayerSpellCast(
  match: FourPlayerMatchState,
  item: FourPlayerStackItem,
): {
  match: FourPlayerMatchState;
  destroyed: readonly import("./four-player-combat-resolution").FourPlayerCombatDestroyedObject[];
  draws: Partial<Record<FourPlayerSeat, number>>;
} {
  if (item.kind !== "spell_cast") return { match, destroyed: [], draws: {} };
  const payload = item.payload as Partial<FourPlayerCardCastPayload>;
  if (!payload.instanceId || !payload.defId || !payload.ownerSeat || payload.cardType !== "Spell" || !payload.effect) {
    throw new Error("Resolved 4P spell cast is missing authoritative identity or effect.");
  }
  if (payload.ownerSeat !== item.controller) {
    throw new Error("Resolved 4P spell owner/controller identity mismatch.");
  }
  return resolveFourPlayerEffect(match, item.controller, payload.effect, payload.target, { tokenNamespace: item.id });
}
