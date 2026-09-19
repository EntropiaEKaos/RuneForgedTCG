import type { ActivatedAbility, ReactionActivatedAbility } from "./activated-ability-types";
import {
  createFourPlayerBattlefieldState,
  findFourPlayerBattlefieldObject,
  type FourPlayerActivatedAbilityUsage,
  type FourPlayerBattlefieldObject,
} from "./four-player-battlefield";
import {
  findFourPlayerGraveyardCard,
  findFourPlayerHandCard,
  putFourPlayerCardInGraveyard,
  takeFourPlayerCardFromHand,
  type FourPlayerCardZones,
} from "./four-player-card-zones";
import { getCard } from "./cards";
import { resolveFourPlayerEffect, type FourPlayerEffectZoneAction } from "./four-player-effect-resolution";
import type { FourPlayerCombatDestroyedObject } from "./four-player-combat-resolution";
import type { FourPlayerSeat } from "./four-player-general";
import { moveGeneralFromBattlefield } from "./four-player-general-zone";
import { type FourPlayerMatchState, updateMatchGeneral } from "./four-player-match";
import { fourPlayerStackActionKind, fourPlayerStackItemIsUncounterable } from "./four-player-reactions";
import { isFourPlayerSpellChainSupported } from "./four-player-spell-contract";
import {
  findFourPlayerStackItem,
  removeFourPlayerStackItemById,
  type FourPlayerStackItem,
} from "./four-player-stack";
import {
  assertFourPlayerGraveyardTarget,
  assertFourPlayerTargetObject,
  assertFourPlayerTargetPlayer,
  type FourPlayerTargetRef,
} from "./four-player-targeting";
import type { CardEffect, TargetKind } from "./types";

export type FourPlayerAbilityTiming = "main" | "reaction";
export type FourPlayerAbilityTargetKind = TargetKind | "opponentPlayer";

export interface FourPlayerActivatedAbilityPayload {
  sourceId: string;
  sourceDefId: string;
  sourceKind: FourPlayerBattlefieldObject["kind"];
  abilityIndex: number;
  timing: FourPlayerAbilityTiming;
  description: string;
  effect: CardEffect;
  target?: FourPlayerTargetRef;
  stackTargetId?: string;
  modeId?: string;
}

export interface FourPlayerStagedActivatedAbility {
  match: FourPlayerMatchState;
  zones: FourPlayerCardZones;
  stackItem: FourPlayerStackItem<FourPlayerActivatedAbilityPayload>;
}

export interface FourPlayerActivatedAbilityOption {
  sourceId: string;
  sourceDefId: string;
  sourceKind: FourPlayerBattlefieldObject["kind"];
  abilityIndex: number;
  timing: FourPlayerAbilityTiming;
  description: string;
  modeId?: string;
  modeDescription?: string;
  targetKind: FourPlayerAbilityTargetKind;
  manaCost: number;
  spellManaCost: number;
  nexusHealthCost: number;
  discardCount: number;
  exhaustSelf: boolean;
  consumeBarrier: boolean;
  sacrificeSelf: boolean;
  loyaltyDelta?: number;
  maxUsesPerRound?: number | null;
  respondsTo?: readonly ("unit" | "spell" | "sentinela")[];
  stackTargetId?: string;
}

interface AbilityChoice {
  description: string;
  effect: CardEffect;
  modeId?: string;
}

interface AbilityDescriptor {
  ability: ActivatedAbility | ReactionActivatedAbility;
  choice: AbilityChoice;
  abilityIndex: number;
  timing: FourPlayerAbilityTiming;
}

const GRAVEYARD_TARGETS = new Set<TargetKind>([
  "allyGraveyardCard",
  "enemyGraveyardCard",
  "anyGraveyardCard",
  "allyGraveyardUnit",
]);

function legacySentinelaAbilities(source: FourPlayerBattlefieldObject): ActivatedAbility[] {
  if (source.kind !== "sentinela") return [];
  const definition = getCard(source.defId);
  return (definition.sentinela?.abilities ?? []).map((ability) => ({
    description: ability.description,
    effect: structuredClone(ability.effect),
    cost: { loyaltyDelta: ability.cost },
    maxUsesPerRound: 1,
  }));
}

function mainAbilities(source: FourPlayerBattlefieldObject): ActivatedAbility[] {
  const definition = getCard(source.defId);
  return [...legacySentinelaAbilities(source), ...(definition.activatedAbilities ?? [])];
}

function reactionAbilities(source: FourPlayerBattlefieldObject): ReactionActivatedAbility[] {
  return getCard(source.defId).reactionActivatedAbilities ?? [];
}

function choicesFor(ability: ActivatedAbility | ReactionActivatedAbility): AbilityChoice[] {
  if (ability.modes !== undefined) {
    if (ability.effect !== undefined || !Array.isArray(ability.modes) || ability.modes.length === 0) return [];
    const seen = new Set<string>();
    const choices: AbilityChoice[] = [];
    for (const mode of ability.modes) {
      if (!mode || typeof mode.id !== "string" || !mode.id.trim() || mode.id.trim() !== mode.id || mode.id.length > 64 || seen.has(mode.id)) return [];
      if (typeof mode.description !== "string" || !mode.description.trim() || !mode.effect) return [];
      seen.add(mode.id);
      choices.push({ description: mode.description, effect: structuredClone(mode.effect), modeId: mode.id });
    }
    return choices;
  }
  if (!ability.effect) return [];
  return [{ description: ability.description, effect: structuredClone(ability.effect) }];
}

function descriptorFor(
  source: FourPlayerBattlefieldObject,
  timing: FourPlayerAbilityTiming,
  abilityIndex: number,
  modeId?: string,
): AbilityDescriptor {
  const abilities = timing === "main" ? mainAbilities(source) : reactionAbilities(source);
  if (!Number.isInteger(abilityIndex) || abilityIndex < 0 || abilityIndex >= abilities.length) {
    throw new Error(`4P ${timing} ability index ${abilityIndex} does not exist on ${source.defId}.`);
  }
  const ability = abilities[abilityIndex]!;
  const choices = choicesFor(ability);
  if (choices.length === 0) throw new Error(`4P ability ${source.defId}:${abilityIndex} has an invalid effect/mode definition.`);
  if (ability.modes !== undefined) {
    if (!modeId) throw new Error("4P modal ability requires a modeId.");
    const choice = choices.find((entry) => entry.modeId === modeId);
    if (!choice) throw new Error(`4P modal ability mode ${modeId} does not exist.`);
    return { ability, choice, abilityIndex, timing };
  }
  if (modeId !== undefined) throw new Error("4P non-modal ability does not accept modeId.");
  return { ability, choice: choices[0]!, abilityIndex, timing };
}

function validateNonNegativeInteger(value: number | undefined, label: string): number {
  const normalized = value ?? 0;
  if (!Number.isInteger(normalized) || normalized < 0) throw new Error(`4P ${label} must be a non-negative integer.`);
  return normalized;
}

function usageKey(timing: FourPlayerAbilityTiming, abilityIndex: number): string {
  return `${timing}:${abilityIndex}`;
}

function usageCount(
  source: FourPlayerBattlefieldObject,
  timing: FourPlayerAbilityTiming,
  abilityIndex: number,
  round: number,
): number {
  const usage = source.activatedAbilityUses?.[usageKey(timing, abilityIndex)];
  return usage?.round === round ? usage.count : 0;
}

function hasConsumingCost(ability: ActivatedAbility | ReactionActivatedAbility): boolean {
  const cost = ability.cost;
  return Boolean(
    (cost?.mana ?? 0) > 0
    || (cost?.nexusHealth ?? 0) > 0
    || (cost?.discardFromHand ?? 0) > 0
    || cost?.exhaustSelf
    || cost?.consumeBarrier
    || cost?.sacrificeSelf
    || (cost?.loyaltyDelta ?? 0) < 0
  );
}

function isOpponentPlayerEffect(effect: CardEffect): boolean {
  return effect.kind === "damageNexus" || effect.kind === "poison" || effect.kind === "mill";
}

function optionTargetKind(effect: CardEffect): FourPlayerAbilityTargetKind {
  return isOpponentPlayerEffect(effect) ? "opponentPlayer" : effect.target;
}

function validateExplicitTarget(
  match: FourPlayerMatchState,
  zones: FourPlayerCardZones,
  actor: FourPlayerSeat,
  effect: CardEffect,
  target: FourPlayerTargetRef | undefined,
  allowMissingTarget: boolean,
): void {
  if (effect.kind === "negateSpell" || effect.target === "spellOnStack") return;

  if (isOpponentPlayerEffect(effect)) {
    if (!target) {
      if (allowMissingTarget) return;
      throw new Error(`4P ${effect.kind} ability requires an opponent player target.`);
    }
    assertFourPlayerTargetPlayer(match, actor, target, "opponent");
    return;
  }

  if (GRAVEYARD_TARGETS.has(effect.target)) {
    if (!target) {
      if (allowMissingTarget) return;
      throw new Error("4P graveyard ability requires an explicit graveyard target.");
    }
    const graveyard = assertFourPlayerGraveyardTarget(match, actor, target, effect.target);
    const card = findFourPlayerGraveyardCard(zones, graveyard.seat, graveyard.instanceId);
    if (effect.target === "allyGraveyardUnit" && getCard(card.defId).type !== "Unit") {
      throw new Error(`4P graveyard target ${card.instanceId} is not a Unit.`);
    }
    return;
  }

  if (effect.target === "none" || effect.target === "self") {
    if (target) throw new Error("4P ability does not accept an explicit target.");
    return;
  }

  if (!target) {
    if (allowMissingTarget) return;
    throw new Error("4P activated ability requires an explicit battlefield target.");
  }
  assertFourPlayerTargetObject(match, actor, target, effect.target);
}

function validateCosts(
  match: FourPlayerMatchState,
  zones: FourPlayerCardZones,
  actor: FourPlayerSeat,
  source: FourPlayerBattlefieldObject,
  descriptor: AbilityDescriptor,
  discardInstanceIds: readonly string[] | undefined,
  allowMissingDiscard: boolean,
): void {
  const ability = descriptor.ability;
  const mana = validateNonNegativeInteger(ability.cost?.mana, "ability mana cost");
  const spellMana = validateNonNegativeInteger(ability.cost?.spellMana, "ability spell mana cost");
  const nexusHealth = validateNonNegativeInteger(ability.cost?.nexusHealth, "ability Nexus health cost");
  const discardCount = validateNonNegativeInteger(ability.cost?.discardFromHand, "ability discard cost");
  if (discardCount > 10) throw new Error("4P ability discard cost must be at most 10.");
  if (match.seats[actor].mana < mana) throw new Error("Not enough regular mana for 4P activated ability.");
  if (match.seats[actor].spellMana < spellMana) throw new Error("Not enough spell mana for 4P activated ability.");
  if (nexusHealth > 0 && match.seats[actor].life <= nexusHealth) {
    throw new Error("4P activated ability Nexus health cost cannot be paid lethally.");
  }

  if (discardCount === 0) {
    if (discardInstanceIds?.length) throw new Error("4P activated ability does not accept discard selections.");
  } else if (!discardInstanceIds) {
    if (!allowMissingDiscard) throw new Error("4P activated ability discard cost requires explicit hand selection.");
    if (zones[actor].hand.length < discardCount) throw new Error("Not enough cards in hand for 4P activated ability discard cost.");
  } else {
    if (discardInstanceIds.length !== discardCount) throw new Error("4P activated ability requires exactly the configured discard count.");
    if (new Set(discardInstanceIds).size !== discardInstanceIds.length) throw new Error("4P activated ability discard selection contains duplicates.");
    for (const instanceId of discardInstanceIds) findFourPlayerHandCard(zones, actor, instanceId);
  }

  const limit = ability.maxUsesPerRound === undefined ? 1 : ability.maxUsesPerRound;
  if (limit !== null && (!Number.isInteger(limit) || limit <= 0)) {
    throw new Error("4P activated ability maxUsesPerRound must be a positive integer or null.");
  }
  if (limit === null && !hasConsumingCost(ability)) {
    throw new Error("4P unlimited activated abilities require a consuming cost.");
  }
  if (source.kind === "sentinela") {
    if (source.sentinelaActivatedRound === match.turn.round) throw new Error("4P Sentinela already activated this round.");
  } else if (limit !== null && usageCount(source, descriptor.timing, descriptor.abilityIndex, match.turn.round) >= limit) {
    throw new Error("4P activated ability reached its per-round use limit.");
  }

  if (ability.cost?.exhaustSelf) {
    if (source.combat) {
      if (source.attackedThisTurn) throw new Error("4P ability source is already exhausted this turn.");
      if (source.stunned) throw new Error("Stunned 4P ability source cannot pay an exhaust cost.");
      if (source.enteredTurn >= match.turn.turn && !source.keywords.includes("Haste")) {
        throw new Error("Summoning-sick 4P ability source cannot pay an exhaust cost.");
      }
    } else if (source.exhaustedRound === match.turn.round) {
      throw new Error("4P ability source is already exhausted this round.");
    }
  }

  if (ability.cost?.consumeBarrier) {
    if (!source.combat?.barrier) throw new Error("4P ability source has no active Barrier to consume.");
  }
  if (ability.cost?.sacrificeSelf && descriptor.choice.effect.target === "self") {
    throw new Error("4P sacrificed source cannot also be the ability self target.");
  }

  if (ability.cost?.loyaltyDelta !== undefined) {
    if (!Number.isInteger(ability.cost.loyaltyDelta)) throw new Error("4P loyalty delta must be an integer.");
    if (source.kind !== "sentinela") throw new Error("4P loyalty cost requires a Sentinela source.");
    const loyalty = source.loyalty ?? getCard(source.defId).sentinela?.startingLoyalty;
    if (loyalty === undefined) throw new Error("4P Sentinela source has no authoritative loyalty state.");
    if (ability.cost.loyaltyDelta < 0 && loyalty < -ability.cost.loyaltyDelta) {
      throw new Error("Not enough 4P Sentinela loyalty.");
    }
  }
}

function validateTiming(
  match: FourPlayerMatchState,
  actor: FourPlayerSeat,
  source: FourPlayerBattlefieldObject,
  descriptor: AbilityDescriptor,
  stackTargetId?: string,
): void {
  if (match.status !== "active") throw new Error("Completed four-player matches cannot activate abilities.");
  if (match.seats[actor].eliminated) throw new Error(`Eliminated seat ${actor} cannot activate abilities.`);
  if (source.controllerSeat !== actor) throw new Error(`Seat ${actor} does not control ability source ${source.id}.`);
  if (match.resolution.priority.holder !== actor) {
    throw new Error(`Seat ${actor} does not hold priority; ${match.resolution.priority.holder} does.`);
  }

  const pending = match.resolution.stack.items.at(-1);
  if (descriptor.timing === "main") {
    if (pending) throw new Error("4P main activated abilities require an empty stack.");
    if (match.turn.activeSeat !== actor) throw new Error("4P main activated abilities require the active seat.");
    if (match.phase !== "main_1" && match.phase !== "main_2") throw new Error("4P main activated abilities require a main phase.");
    if (descriptor.choice.effect.kind === "negateSpell" || descriptor.choice.effect.target === "spellOnStack") {
      throw new Error("4P stack-targeted effects require a reaction activated ability.");
    }
    return;
  }

  if (!pending) throw new Error("4P reaction activated abilities require an open stack.");
  if (pending.controller === actor) throw new Error("4P reaction activated abilities require an opposing pending action.");
  const reaction = descriptor.ability as ReactionActivatedAbility;
  if (!Array.isArray(reaction.respondsTo) || reaction.respondsTo.length === 0 || new Set(reaction.respondsTo).size !== reaction.respondsTo.length) {
    throw new Error("4P reaction ability respondsTo contract is invalid.");
  }
  const actionKind = fourPlayerStackActionKind(pending);
  if (!actionKind || !reaction.respondsTo.includes(actionKind)) {
    throw new Error("4P reaction ability does not respond to the pending action kind.");
  }

  if (descriptor.choice.effect.target === "spellOnStack" || descriptor.choice.effect.kind === "negateSpell") {
    if (descriptor.choice.effect.kind !== "negateSpell" || descriptor.choice.effect.target !== "spellOnStack") {
      throw new Error("4P stack-targeted reaction abilities must use negateSpell + spellOnStack.");
    }
    if (actionKind !== "spell") throw new Error("4P negate reaction ability requires a pending spell.");
    const targetId = String(stackTargetId || "").trim();
    if (!targetId || targetId !== pending.id) throw new Error("4P negate reaction ability must target the current top spell.");
    if (fourPlayerStackItemIsUncounterable(pending)) throw new Error("Pending 4P spell cannot be countered.");
  } else if (stackTargetId) {
    throw new Error("4P non-counter reaction ability does not accept stackTargetId.");
  }
}

function findSource(match: FourPlayerMatchState, actor: FourPlayerSeat, sourceId: string): FourPlayerBattlefieldObject {
  const source = findFourPlayerBattlefieldObject(match.battlefield ?? createFourPlayerBattlefieldState(), sourceId);
  if (source.controllerSeat !== actor) throw new Error(`Seat ${actor} does not control ability source ${source.id}.`);
  return source;
}

function validateAbility(
  match: FourPlayerMatchState,
  zones: FourPlayerCardZones,
  actor: FourPlayerSeat,
  sourceId: string,
  timing: FourPlayerAbilityTiming,
  abilityIndex: number,
  modeId: string | undefined,
  target: FourPlayerTargetRef | undefined,
  stackTargetId: string | undefined,
  discardInstanceIds: readonly string[] | undefined,
  allowMissingTarget: boolean,
  allowMissingDiscard: boolean,
): { source: FourPlayerBattlefieldObject; descriptor: AbilityDescriptor } {
  const source = findSource(match, actor, sourceId);
  const descriptor = descriptorFor(source, timing, abilityIndex, modeId);
  if (!isFourPlayerSpellChainSupported(descriptor.choice.effect)) {
    throw new Error(`4P ability ${source.defId}:${abilityIndex} contains an unsupported effect chain.`);
  }
  validateTiming(match, actor, source, descriptor, stackTargetId);
  validateCosts(match, zones, actor, source, descriptor, discardInstanceIds, allowMissingDiscard);
  validateExplicitTarget(match, zones, actor, descriptor.choice.effect, target, allowMissingTarget);
  if (descriptor.timing === "main" && !allowMissingTarget) {
    resolveFourPlayerEffect(match, actor, descriptor.choice.effect, target, { tokenNamespace: `ability-preview:${source.id}:${abilityIndex}` });
  } else if (
    descriptor.timing === "reaction"
    && descriptor.choice.effect.kind !== "negateSpell"
    && !allowMissingTarget
  ) {
    resolveFourPlayerEffect(match, actor, descriptor.choice.effect, target, { tokenNamespace: `reaction-preview:${source.id}:${abilityIndex}` });
  }
  return { source, descriptor };
}

function recordUsage(
  object: FourPlayerBattlefieldObject,
  timing: FourPlayerAbilityTiming,
  abilityIndex: number,
  round: number,
): FourPlayerBattlefieldObject {
  if (object.kind === "sentinela") return { ...object, sentinelaActivatedRound: round };
  const key = usageKey(timing, abilityIndex);
  const previous = object.activatedAbilityUses?.[key];
  const next: FourPlayerActivatedAbilityUsage = previous?.round === round
    ? { round, count: previous.count + 1 }
    : { round, count: 1 };
  return { ...object, activatedAbilityUses: { ...(object.activatedAbilityUses ?? {}), [key]: next } };
}

function removeSacrificedSource(
  match: FourPlayerMatchState,
  zones: FourPlayerCardZones,
  source: FourPlayerBattlefieldObject,
): { match: FourPlayerMatchState; zones: FourPlayerCardZones } {
  let nextZones = zones;
  for (const equipment of source.equipment ?? []) {
    if (!equipment.physical) continue;
    nextZones = putFourPlayerCardInGraveyard(nextZones, {
      instanceId: equipment.instanceId,
      defId: equipment.defId,
      ownerSeat: equipment.ownerSeat,
    });
  }

  let nextMatch: FourPlayerMatchState = {
    ...match,
    battlefield: {
      objects: (match.battlefield?.objects ?? []).filter((object) => object.id !== source.id),
    },
  };
  if (source.kind === "general") {
    const general = nextMatch.generals[source.ownerSeat];
    if (general.location === "battlefield") {
      nextMatch = updateMatchGeneral(nextMatch, source.ownerSeat, moveGeneralFromBattlefield(general, "graveyard", true));
    }
  } else if (source.kind !== "token") {
    nextZones = putFourPlayerCardInGraveyard(nextZones, {
      instanceId: source.id,
      defId: source.defId,
      ownerSeat: source.ownerSeat,
    });
  }
  return { match: nextMatch, zones: nextZones };
}

function payAndCommitCosts(
  match: FourPlayerMatchState,
  zones: FourPlayerCardZones,
  actor: FourPlayerSeat,
  source: FourPlayerBattlefieldObject,
  descriptor: AbilityDescriptor,
  discardInstanceIds?: readonly string[],
): { match: FourPlayerMatchState; zones: FourPlayerCardZones } {
  const ability = descriptor.ability;
  let currentZones = zones;
  for (const instanceId of discardInstanceIds ?? []) {
    const taken = takeFourPlayerCardFromHand(currentZones, actor, instanceId);
    currentZones = putFourPlayerCardInGraveyard(taken.zones, taken.card);
  }

  const seat = match.seats[actor];
  let nextMatch: FourPlayerMatchState = {
    ...match,
    seats: {
      ...match.seats,
      [actor]: {
        ...seat,
        mana: seat.mana - (ability.cost?.mana ?? 0),
        spellMana: seat.spellMana - (ability.cost?.spellMana ?? 0),
        life: seat.life - (ability.cost?.nexusHealth ?? 0),
      },
    },
  };

  const battlefield = nextMatch.battlefield ?? createFourPlayerBattlefieldState();
  let committedSource = recordUsage(source, descriptor.timing, descriptor.abilityIndex, nextMatch.turn.round);
  if (ability.cost?.exhaustSelf) {
    committedSource = committedSource.combat
      ? { ...committedSource, attackedThisTurn: true }
      : { ...committedSource, exhaustedRound: nextMatch.turn.round };
  }
  if (ability.cost?.consumeBarrier && committedSource.combat) {
    committedSource = { ...committedSource, combat: { ...committedSource.combat, barrier: false } };
  }
  if (ability.cost?.loyaltyDelta !== undefined && committedSource.kind === "sentinela") {
    const current = committedSource.loyalty ?? getCard(committedSource.defId).sentinela?.startingLoyalty ?? 0;
    committedSource = { ...committedSource, loyalty: current + ability.cost.loyaltyDelta };
  }
  nextMatch = {
    ...nextMatch,
    battlefield: {
      objects: battlefield.objects.map((object) => object.id === committedSource.id ? committedSource : object),
    },
  };

  const sourceDiesForCost = Boolean(
    ability.cost?.sacrificeSelf
    || (committedSource.kind === "sentinela" && (committedSource.loyalty ?? 1) <= 0),
  );
  if (sourceDiesForCost) return removeSacrificedSource(nextMatch, currentZones, committedSource);
  return { match: nextMatch, zones: currentZones };
}

export function stageFourPlayerActivatedAbility(
  match: FourPlayerMatchState,
  zones: FourPlayerCardZones,
  actor: FourPlayerSeat,
  sourceId: string,
  timing: FourPlayerAbilityTiming,
  abilityIndex: number,
  eventId: string,
  target?: FourPlayerTargetRef,
  stackTargetId?: string,
  modeId?: string,
  discardInstanceIds?: readonly string[],
): FourPlayerStagedActivatedAbility {
  const validated = validateAbility(
    match,
    zones,
    actor,
    sourceId,
    timing,
    abilityIndex,
    modeId,
    target,
    stackTargetId,
    discardInstanceIds,
    false,
    false,
  );
  const paid = payAndCommitCosts(match, zones, actor, validated.source, validated.descriptor, discardInstanceIds);
  const payload: FourPlayerActivatedAbilityPayload = {
    sourceId: validated.source.id,
    sourceDefId: validated.source.defId,
    sourceKind: validated.source.kind,
    abilityIndex,
    timing,
    description: validated.descriptor.ability.description,
    effect: structuredClone(validated.descriptor.choice.effect),
    ...(target ? { target } : {}),
    ...(stackTargetId ? { stackTargetId } : {}),
    ...(modeId ? { modeId } : {}),
  };
  return {
    match: paid.match,
    zones: paid.zones,
    stackItem: {
      id: `ability:${actor}:${validated.source.id}:${timing}:${abilityIndex}:${eventId}`,
      controller: actor,
      kind: "ability_activation",
      payload,
    },
  };
}

export function resolveFourPlayerActivatedAbility(
  match: FourPlayerMatchState,
  item: FourPlayerStackItem,
): {
  match: FourPlayerMatchState;
  destroyed: readonly FourPlayerCombatDestroyedObject[];
  draws: Partial<Record<FourPlayerSeat, number>>;
  countered: readonly FourPlayerStackItem[];
  zoneActions?: readonly FourPlayerEffectZoneAction[];
} {
  if (item.kind !== "ability_activation") return { match, destroyed: [], draws: {}, countered: [] };
  const payload = item.payload as Partial<FourPlayerActivatedAbilityPayload>;
  if (!payload.sourceId || !payload.sourceDefId || !payload.sourceKind || payload.abilityIndex === undefined || !payload.timing || !payload.effect) {
    throw new Error("Resolved 4P activated ability is missing authoritative identity or effect.");
  }

  if (payload.effect.kind === "negateSpell") {
    const targetId = String(payload.stackTargetId || "").trim();
    if (!targetId) throw new Error("Resolved 4P negate ability is missing stackTargetId.");
    const target = findFourPlayerStackItem(match.resolution.stack, targetId);
    if (!target || fourPlayerStackActionKind(target) !== "spell" || fourPlayerStackItemIsUncounterable(target)) {
      return { match, destroyed: [], draws: {}, countered: [] };
    }
    const removed = removeFourPlayerStackItemById(match.resolution.stack, targetId);
    let nextMatch: FourPlayerMatchState = {
      ...match,
      resolution: { ...match.resolution, stack: removed.state },
    };
    let destroyed: readonly FourPlayerCombatDestroyedObject[] = [];
    let draws: Partial<Record<FourPlayerSeat, number>> = {};
    let zoneActions: readonly FourPlayerEffectZoneAction[] | undefined;
    if (payload.effect.also) {
      const secondary = resolveFourPlayerEffect(nextMatch, item.controller, payload.effect.also, undefined, { tokenNamespace: item.id });
      nextMatch = secondary.match;
      destroyed = secondary.destroyed;
      draws = secondary.draws;
      zoneActions = secondary.zoneActions;
    }
    return {
      match: nextMatch,
      destroyed,
      draws,
      countered: removed.removed ? [removed.removed] : [],
      ...(zoneActions?.length ? { zoneActions } : {}),
    };
  }

  try {
    const resolved = resolveFourPlayerEffect(match, item.controller, payload.effect, payload.target, { tokenNamespace: item.id });
    return { ...resolved, countered: [] };
  } catch {
    // Targeted abilities fizzle if their authoritative target disappeared or
    // changed relation before resolution. Costs remain committed at activation.
    return { match, destroyed: [], draws: {}, countered: [] };
  }
}

function hasLegalOptionTarget(
  match: FourPlayerMatchState,
  zones: FourPlayerCardZones,
  actor: FourPlayerSeat,
  effect: CardEffect,
): boolean {
  if (effect.kind === "negateSpell" || effect.target === "spellOnStack" || effect.target === "none" || effect.target === "self") {
    return true;
  }
  if (isOpponentPlayerEffect(effect)) {
    return Object.values(match.seats).some((seat) => !seat.eliminated && seat.seat !== actor);
  }
  if (GRAVEYARD_TARGETS.has(effect.target)) {
    for (const seat of Object.keys(zones) as FourPlayerSeat[]) {
      for (const card of zones[seat].graveyard) {
        try {
          validateExplicitTarget(match, zones, actor, effect, {
            kind: "graveyard",
            seat,
            instanceId: card.instanceId,
          }, false);
          return true;
        } catch {
          // Keep searching public graveyards for a legal physical target.
        }
      }
    }
    return false;
  }
  for (const object of (match.battlefield ?? createFourPlayerBattlefieldState()).objects) {
    try {
      validateExplicitTarget(match, zones, actor, effect, { kind: "battlefield", objectId: object.id }, false);
      return true;
    } catch {
      // Keep searching the authoritative battlefield.
    }
  }
  return false;
}

function optionFromDescriptor(
  source: FourPlayerBattlefieldObject,
  descriptor: AbilityDescriptor,
  stackTargetId?: string,
): FourPlayerActivatedAbilityOption {
  const cost = descriptor.ability.cost;
  const reaction = descriptor.timing === "reaction" ? descriptor.ability as ReactionActivatedAbility : undefined;
  return {
    sourceId: source.id,
    sourceDefId: source.defId,
    sourceKind: source.kind,
    abilityIndex: descriptor.abilityIndex,
    timing: descriptor.timing,
    description: descriptor.ability.description,
    ...(descriptor.choice.modeId ? { modeId: descriptor.choice.modeId, modeDescription: descriptor.choice.description } : {}),
    targetKind: optionTargetKind(descriptor.choice.effect),
    manaCost: cost?.mana ?? 0,
    spellManaCost: cost?.spellMana ?? 0,
    nexusHealthCost: cost?.nexusHealth ?? 0,
    discardCount: cost?.discardFromHand ?? 0,
    exhaustSelf: Boolean(cost?.exhaustSelf),
    consumeBarrier: Boolean(cost?.consumeBarrier),
    sacrificeSelf: Boolean(cost?.sacrificeSelf),
    ...(cost?.loyaltyDelta !== undefined ? { loyaltyDelta: cost.loyaltyDelta } : {}),
    ...(descriptor.ability.maxUsesPerRound !== undefined ? { maxUsesPerRound: descriptor.ability.maxUsesPerRound } : {}),
    ...(reaction ? { respondsTo: [...reaction.respondsTo] } : {}),
    ...(stackTargetId ? { stackTargetId } : {}),
  };
}

export function fourPlayerActivatedAbilityOptions(
  match: FourPlayerMatchState,
  zones: FourPlayerCardZones,
  actor: FourPlayerSeat,
): FourPlayerActivatedAbilityOption[] {
  if (match.status !== "active" || match.seats[actor].eliminated || match.resolution.priority.holder !== actor) return [];
  const battlefield = match.battlefield ?? createFourPlayerBattlefieldState();
  const sources = battlefield.objects.filter((object) => object.controllerSeat === actor);
  const pending = match.resolution.stack.items.at(-1);
  const timing: FourPlayerAbilityTiming = pending ? "reaction" : "main";
  const options: FourPlayerActivatedAbilityOption[] = [];

  for (const source of sources) {
    const abilities = timing === "main" ? mainAbilities(source) : reactionAbilities(source);
    abilities.forEach((ability, abilityIndex) => {
      for (const choice of choicesFor(ability)) {
        try {
          const descriptor = descriptorFor(source, timing, abilityIndex, choice.modeId);
          const stackTargetId = timing === "reaction" && descriptor.choice.effect.kind === "negateSpell" ? pending?.id : undefined;
          validateAbility(
            match,
            zones,
            actor,
            source.id,
            timing,
            abilityIndex,
            choice.modeId,
            undefined,
            stackTargetId,
            undefined,
            true,
            true,
          );
          if (!hasLegalOptionTarget(match, zones, actor, descriptor.choice.effect)) continue;
          options.push(optionFromDescriptor(source, descriptor, stackTargetId));
        } catch {
          // Invalid or currently unaffordable abilities are intentionally absent.
        }
      }
    });
  }
  return options;
}