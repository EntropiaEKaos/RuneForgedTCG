import { getCard } from "./cards";
import {
  attachFourPlayerEquipment,
  canAttachFourPlayerEquipment,
  createFourPlayerBattlefieldState,
  findFourPlayerBattlefieldObject,
  putFourPlayerBattlefieldObject,
  type FourPlayerBattlefieldKind,
  type FourPlayerDurability,
} from "./four-player-battlefield";
import { createFourPlayerCombatBodySnapshot, type FourPlayerCombatBody } from "./four-player-combat-body";
import { resolveFourPlayerEffect, type FourPlayerEffectZoneAction } from "./four-player-effect-resolution";
import {
  findFourPlayerGraveyardCard,
  findFourPlayerHandCard,
  takeFourPlayerCardFromHand,
  type FourPlayerCardInstance,
  type FourPlayerCardZones,
} from "./four-player-card-zones";
import type { FourPlayerSeat } from "./four-player-general";
import { addFourPlayerProgress, type FourPlayerMatchState } from "./four-player-match";
import {
  findFourPlayerStackItem,
  removeFourPlayerStackItemById,
  type FourPlayerStackItem,
} from "./four-player-stack";
import { canFourPlayerCounterStackItem, canFourPlayerReactWithCard } from "./four-player-reactions";
import { isFourPlayerSpellChainSupported } from "./four-player-spell-contract";
import { cardUsesSpellMana, semanticProactivePlayAllowed, semanticReactionAllowed } from "./semantic-card-types";
import { assertFourPlayerGraveyardTarget, assertFourPlayerTargetObject, type FourPlayerTargetRef } from "./four-player-targeting";
import type { CardEffect, CardType, Keyword } from "./types";

export const FOUR_PLAYER_STAGEABLE_CARD_TYPES = ["Unit", "Enchantment", "Artifact", "Equipment", "Sentinela", "Spell"] as const;
export type FourPlayerStageableCardType = (typeof FOUR_PLAYER_STAGEABLE_CARD_TYPES)[number];

export interface FourPlayerCardCastPayload {
  instanceId: string;
  defId: string;
  ownerSeat: FourPlayerSeat;
  cardType: FourPlayerStageableCardType;
  keywords: readonly Keyword[];
  combat?: FourPlayerCombatBody;
  durability?: FourPlayerDurability;
  loyalty?: number;
  equipment?: { buffPower: number; buffHealth: number; keywords: readonly Keyword[] };
  effect?: CardEffect;
  target?: FourPlayerTargetRef;
  speed?: "Fast" | "Burst";
  stackTargetId?: string;
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

function permanentDurability(definition: ReturnType<typeof getCard>): FourPlayerDurability | undefined {
  if (definition.type !== "Enchantment" && definition.type !== "Artifact") return undefined;
  const maxHealth = definition.maxHealth ?? 3;
  if (!Number.isFinite(maxHealth) || maxHealth <= 0) throw new Error(`Permanent ${definition.defId} has invalid maxHealth.`);
  return { health: maxHealth, maxHealth };
}

const FOUR_PLAYER_GRAVEYARD_TARGETS = new Set([
  "allyGraveyardCard",
  "enemyGraveyardCard",
  "anyGraveyardCard",
  "allyGraveyardUnit",
]);

function assertGraveyardSpellTarget(
  match: FourPlayerMatchState,
  zones: FourPlayerCardZones,
  actor: FourPlayerSeat,
  effect: CardEffect,
  target?: FourPlayerTargetRef,
): void {
  if (!FOUR_PLAYER_GRAVEYARD_TARGETS.has(effect.target)) return;
  const graveyard = assertFourPlayerGraveyardTarget(match, actor, target, effect.target);
  const card = findFourPlayerGraveyardCard(zones, graveyard.seat, graveyard.instanceId);
  if (effect.target === "allyGraveyardUnit" && getCard(card.defId).type !== "Unit") {
    throw new Error(`4P graveyard target ${card.instanceId} is not a Unit.`);
  }
}

function assertCardPlayTiming(
  match: FourPlayerMatchState,
  actor: FourPlayerSeat,
  definition: ReturnType<typeof getCard>,
  stackTargetId?: string,
): void {
  if (match.status !== "active") throw new Error("Completed four-player matches cannot stage cards.");
  if (match.seats[actor].eliminated) throw new Error(`Eliminated seat ${actor} cannot stage cards.`);
  if (match.resolution.priority.holder !== actor) {
    throw new Error(`Seat ${actor} does not hold priority; ${match.resolution.priority.holder} does.`);
  }

  const pending = match.resolution.stack.items[match.resolution.stack.items.length - 1];
  if (pending) {
    if (!semanticReactionAllowed(definition)) {
      throw new Error(`Card ${definition.defId} cannot enter a 4P reaction window.`);
    }
    if (!canFourPlayerReactWithCard(definition, pending)) {
      throw new Error("Only legal Fast/Burst reaction spells may be staged while the 4P stack is open.");
    }
    if (definition.spell?.kind === "negateSpell") {
      const targetId = String(stackTargetId || "").trim();
      if (!targetId) throw new Error("4P negateSpell requires a stackTargetId.");
      const target = findFourPlayerStackItem(match.resolution.stack, targetId);
      if (!target) throw new Error(`4P stack target ${targetId} does not exist.`);
      if (!canFourPlayerCounterStackItem(definition, target)) {
        throw new Error(`4P negateSpell cannot counter stack item ${targetId}.`);
      }
    } else if (definition.spell?.target === "spellOnStack") {
      throw new Error("Only negateSpell may target the 4P reaction stack.");
    }
    return;
  }

  if (!semanticProactivePlayAllowed(definition)) {
    throw new Error(`Card ${definition.defId} is reaction-only and requires an open 4P stack.`);
  }
  if (definition.spell?.kind === "negateSpell" || definition.spell?.target === "spellOnStack") {
    throw new Error("4P stack-targeted reactions require a pending stack item.");
  }
  if (match.turn.activeSeat !== actor) {
    throw new Error(`Only active seat ${match.turn.activeSeat} may stage sorcery-speed cards.`);
  }
  if (match.phase !== "main_1" && match.phase !== "main_2") {
    throw new Error("4P physical card staging requires a main phase.");
  }
}

export function stageFourPlayerCardCast(
  match: FourPlayerMatchState,
  zones: FourPlayerCardZones,
  actor: FourPlayerSeat,
  instanceId: string,
  eventId: string,
  target?: FourPlayerTargetRef,
  stackTargetId?: string,
): FourPlayerStagedCardCast {
  const card = findFourPlayerHandCard(zones, actor, instanceId);
  const definition = getCard(card.defId);
  assertCardPlayTiming(match, actor, definition, stackTargetId);
  if (!isStageableType(definition.type)) {
    throw new Error(`Card type ${definition.type} is not stageable by 4P physical play authority yet.`);
  }
  if (!Number.isFinite(definition.cost) || definition.cost < 0) {
    throw new Error(`Card ${definition.defId} has invalid authoritative cost.`);
  }
  if (definition.type === "Equipment") {
    if (!definition.equipment) throw new Error(`Equipment ${definition.defId} has no authoritative Equipment definition.`);
    const equipmentTarget = assertFourPlayerTargetObject(match, actor, target, "allyUnit");
    if (!canAttachFourPlayerEquipment(equipmentTarget)) {
      throw new Error(`4P Equipment target ${equipmentTarget.id} has no free Equipment slot.`);
    }
  }
  const seat = match.seats[actor];
  const usesSpellMana = cardUsesSpellMana(definition);
  const availableMana = seat.mana + (usesSpellMana ? seat.spellMana : 0);
  if (availableMana < definition.cost) {
    throw new Error(
      `Insufficient mana to play ${definition.defId}: requires ${definition.cost}, has ${seat.mana} regular + ${usesSpellMana ? seat.spellMana : 0} spell mana.`,
    );
  }
  const regularPaid = usesSpellMana ? Math.min(seat.mana, definition.cost) : definition.cost;
  const spellManaPaid = usesSpellMana ? definition.cost - regularPaid : 0;
  const taken = takeFourPlayerCardFromHand(zones, actor, card.instanceId);
  let paidMatch: FourPlayerMatchState = {
    ...match,
    seats: {
      ...match.seats,
      [actor]: {
        ...seat,
        mana: seat.mana - regularPaid,
        spellMana: seat.spellMana - spellManaPaid,
      },
    },
  };
  if (usesSpellMana) {
    paidMatch = addFourPlayerProgress(paidMatch, actor, { spellsCast: 1 });
  }
  const combat = createFourPlayerCombatBodySnapshot(definition);
  const durability = permanentDurability(definition);
  if (definition.type === "Spell") {
    if (!definition.spell) throw new Error(`Spell ${definition.defId} has no authoritative effect.`);
    if (!isFourPlayerSpellChainSupported(definition.spell)) {
      throw new Error(`Spell ${definition.defId} contains an effect outside the certified 4P spell contract.`);
    }
    assertGraveyardSpellTarget(match, zones, actor, definition.spell, target);
    if (definition.spell.kind !== "negateSpell") {
      resolveFourPlayerEffect(match, actor, definition.spell, target);
    }
  }
  const payload: FourPlayerCardCastPayload = {
    instanceId: card.instanceId,
    defId: card.defId,
    ownerSeat: actor,
    cardType: definition.type,
    keywords: [...(definition.keywords ?? [])],
    ...(combat ? { combat } : {}),
    ...(durability ? { durability } : {}),
    ...(definition.type === "Sentinela" && definition.sentinela ? { loyalty: definition.sentinela.startingLoyalty } : {}),
    ...(definition.type === "Equipment" && definition.equipment ? {
      equipment: {
        buffPower: definition.equipment.buffPower,
        buffHealth: definition.equipment.buffHealth,
        keywords: [...(definition.equipment.keywords ?? [])],
      },
      ...(target ? { target } : {}),
    } : {}),
    ...(definition.type === "Spell" && definition.spell ? {
      effect: structuredClone(definition.spell),
      ...(target ? { target } : {}),
      ...(definition.speed ? { speed: definition.speed } : {}),
      ...(stackTargetId ? { stackTargetId } : {}),
    } : {}),
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

function battlefieldKind(type: Exclude<FourPlayerStageableCardType, "Spell" | "Equipment">): FourPlayerBattlefieldKind {
  if (type === "Unit") return "unit";
  if (type === "Sentinela") return "sentinela";
  return "permanent";
}

export function resolveFourPlayerCardCast(
  match: FourPlayerMatchState,
  item: FourPlayerStackItem,
): { match: FourPlayerMatchState; zoneActions: readonly FourPlayerEffectZoneAction[] } {
  if (item.kind !== "card_cast") return { match, zoneActions: [] };
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
  if (payload.cardType === "Equipment") {
    const equipment = payload.equipment;
    const targetId = payload.target?.kind === "battlefield" ? payload.target.objectId : "";
    if (!equipment || !targetId) {
      throw new Error("Resolved 4P Equipment cast is missing authoritative attachment data.");
    }
    try {
      const sourceBattlefield = match.battlefield ?? createFourPlayerBattlefieldState();
      const currentTarget = findFourPlayerBattlefieldObject(sourceBattlefield, targetId);
      if (currentTarget.controllerSeat !== item.controller || !canAttachFourPlayerEquipment(currentTarget)) {
        throw new Error(`4P Equipment target ${targetId} is no longer a legal allied attachment target.`);
      }
      const battlefield = attachFourPlayerEquipment(
        sourceBattlefield,
        targetId,
        {
          instanceId: payload.instanceId,
          defId: payload.defId,
          ownerSeat: payload.ownerSeat,
          physical: true,
          buffPower: equipment.buffPower,
          buffHealth: equipment.buffHealth,
          keywords: equipment.keywords ?? [],
        },
      );
      return { match: { ...match, battlefield }, zoneActions: [] };
    } catch {
      return {
        match,
        zoneActions: [{
          kind: "put_graveyard",
          card: { instanceId: payload.instanceId, defId: payload.defId, ownerSeat: payload.ownerSeat },
        }],
      };
    }
  }
  const enteredMatch: FourPlayerMatchState = {
    ...match,
    battlefield: putFourPlayerBattlefieldObject(
      match.battlefield ?? createFourPlayerBattlefieldState(),
      {
        id: payload.instanceId,
        defId: payload.defId,
        kind: battlefieldKind(payload.cardType as Exclude<FourPlayerStageableCardType, "Spell" | "Equipment">),
        ownerSeat: payload.ownerSeat,
        controllerSeat: item.controller,
        enteredTurn: match.turn.turn,
        keywords: payload.keywords ?? [],
        combat: payload.combat,
        durability: payload.durability,
        loyalty: payload.loyalty,
      },
    ),
  };
  return {
    match: payload.cardType === "Unit"
      ? addFourPlayerProgress(enteredMatch, item.controller, { alliesSummoned: 1 })
      : enteredMatch,
    zoneActions: [],
  };
}


export function resolveFourPlayerSpellCast(
  match: FourPlayerMatchState,
  item: FourPlayerStackItem,
): {
  match: FourPlayerMatchState;
  destroyed: readonly import("./four-player-combat-resolution").FourPlayerCombatDestroyedObject[];
  draws: Partial<Record<FourPlayerSeat, number>>;
  countered: readonly FourPlayerStackItem[];
  zoneActions?: readonly FourPlayerEffectZoneAction[];
} {
  if (item.kind !== "spell_cast") return { match, destroyed: [], draws: {}, countered: [] };
  const payload = item.payload as Partial<FourPlayerCardCastPayload>;
  if (!payload.instanceId || !payload.defId || !payload.ownerSeat || payload.cardType !== "Spell" || !payload.effect) {
    throw new Error("Resolved 4P spell cast is missing authoritative identity or effect.");
  }
  if (payload.ownerSeat !== item.controller) {
    throw new Error("Resolved 4P spell owner/controller identity mismatch.");
  }
  if (payload.effect.kind === "negateSpell") {
    const targetId = String(payload.stackTargetId || "").trim();
    if (!targetId) throw new Error("Resolved 4P negateSpell is missing stackTargetId.");
    const target = findFourPlayerStackItem(match.resolution.stack, targetId);
    if (!target) return { match, destroyed: [], draws: {}, countered: [] };
    const counterDef = getCard(payload.defId);
    if (!canFourPlayerCounterStackItem(counterDef, target)) {
      return { match, destroyed: [], draws: {}, countered: [] };
    }
    const removed = removeFourPlayerStackItemById(match.resolution.stack, targetId);
    let nextMatch: FourPlayerMatchState = {
      ...match,
      resolution: { ...match.resolution, stack: removed.state },
    };
    let destroyed: readonly import("./four-player-combat-resolution").FourPlayerCombatDestroyedObject[] = [];
    let draws: Partial<Record<FourPlayerSeat, number>> = {};
    let zoneActions: readonly FourPlayerEffectZoneAction[] | undefined;
    if (payload.effect.also) {
      const secondary = resolveFourPlayerEffect(nextMatch, item.controller, payload.effect.also, undefined, { tokenNamespace: item.id });
      nextMatch = secondary.match;
      destroyed = secondary.destroyed;
      draws = secondary.draws;
      zoneActions = secondary.zoneActions;
    }
    return { match: nextMatch, destroyed, draws, countered: removed.removed ? [removed.removed] : [], ...(zoneActions?.length ? { zoneActions } : {}) };
  }
  const resolved = resolveFourPlayerEffect(match, item.controller, payload.effect, payload.target, { tokenNamespace: item.id });
  return { ...resolved, countered: [] };
}