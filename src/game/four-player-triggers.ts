import { getCard } from "./cards";
import {
  createFourPlayerBattlefieldState,
  type FourPlayerBattlefieldObject,
} from "./four-player-battlefield";
import type { FourPlayerCombatDestroyedObject, FourPlayerCombatImpact } from "./four-player-combat-resolution";
import {
  resolveFourPlayerEffect,
  type FourPlayerEffectResolutionResult,
  type FourPlayerEffectZoneAction,
} from "./four-player-effect-resolution";
import { FOUR_PLAYER_SEATS, type FourPlayerSeat } from "./four-player-general";
import type { FourPlayerLevelUpEvent } from "./four-player-level-up";
import type { FourPlayerMatchState } from "./four-player-match";
import { createFourPlayerPriorityState } from "./four-player-priority-manager";
import { FOUR_PLAYER_RESOLVER_EFFECT_KINDS } from "./four-player-spell-contract";
import { pushFourPlayerStackItem, type FourPlayerStackItem } from "./four-player-stack";
import {
  assertFourPlayerTargetObject,
  type FourPlayerTargetRef,
} from "./four-player-targeting";
import type { CardDef, CardEffect, TriggerWhen } from "./types";

export const FOUR_PLAYER_AUTOMATIC_TRIGGER_EVENTS = [
  "onSummon",
  "onPermanentSummon",
  "onDeath",
  "onAllyDeath",
  "onRoundStart",
  "onLevelUp",
  "onAttack",
  "onBlock",
  "onStrike",
  "onNexusStrike",
  "onKill",
] as const satisfies readonly TriggerWhen[];

export type FourPlayerAutomaticTriggerWhen = (typeof FOUR_PLAYER_AUTOMATIC_TRIGGER_EVENTS)[number];

export interface FourPlayerTriggeredAbilityPayload {
  sourceId: string;
  sourceDefId: string;
  sourceKind: string;
  when: FourPlayerAutomaticTriggerWhen;
  description: string;
  effect: CardEffect;
  targets: readonly (FourPlayerTargetRef | null)[];
}

export interface FourPlayerTriggerQueueResult {
  match: FourPlayerMatchState;
  queued: readonly FourPlayerStackItem<FourPlayerTriggeredAbilityPayload>[];
}

interface TriggerCandidate {
  controller: FourPlayerSeat;
  sourceId: string;
  sourceDefId: string;
  sourceKind: string;
  sourceTargetId?: string;
  when: FourPlayerAutomaticTriggerWhen;
  description: string;
  effect: CardEffect;
  ordinal: number;
}

const SUPPORTED_EFFECTS = new Set<string>(FOUR_PLAYER_RESOLVER_EFFECT_KINDS);
const GRAVEYARD_TARGETS = new Set([
  "allyGraveyardCard",
  "enemyGraveyardCard",
  "anyGraveyardCard",
  "allyGraveyardUnit",
]);

function safeCard(defId: string): CardDef | undefined {
  try {
    return getCard(defId);
  } catch {
    return undefined;
  }
}

function automaticTriggerChainSupported(effect: CardEffect): boolean {
  let cursor: CardEffect | undefined = effect;
  for (let guard = 0; cursor && guard < 32; guard += 1) {
    if (!SUPPORTED_EFFECTS.has(cursor.kind)) return false;
    if (GRAVEYARD_TARGETS.has(cursor.target) || cursor.target === "spellOnStack") return false;
    cursor = cursor.also;
  }
  return !cursor;
}

function livingSeatOrder(match: FourPlayerMatchState, anchor: FourPlayerSeat): FourPlayerSeat[] {
  const start = FOUR_PLAYER_SEATS.indexOf(anchor);
  const ordered: FourPlayerSeat[] = [];
  for (let offset = 0; offset < FOUR_PLAYER_SEATS.length; offset += 1) {
    const seat = FOUR_PLAYER_SEATS[(start + offset) % FOUR_PLAYER_SEATS.length]!;
    if (!match.seats[seat].eliminated) ordered.push(seat);
  }
  return ordered;
}

function nextOpponent(match: FourPlayerMatchState, actor: FourPlayerSeat): FourPlayerSeat | undefined {
  return livingSeatOrder(match, actor).find((seat) => seat !== actor);
}

function stableObjectOrder(
  match: FourPlayerMatchState,
  actor: FourPlayerSeat,
  objects: readonly FourPlayerBattlefieldObject[],
  metric: (object: FourPlayerBattlefieldObject) => number,
  ascending = false,
): FourPlayerBattlefieldObject[] {
  const seatOrder = livingSeatOrder(match, actor);
  const seatRank = new Map(seatOrder.map((seat, index) => [seat, index]));
  return [...objects].sort((a, b) => {
    const av = metric(a);
    const bv = metric(b);
    if (av !== bv) return ascending ? av - bv : bv - av;
    const ar = seatRank.get(a.controllerSeat) ?? FOUR_PLAYER_SEATS.length;
    const br = seatRank.get(b.controllerSeat) ?? FOUR_PLAYER_SEATS.length;
    if (ar !== br) return ar - br;
    return a.id.localeCompare(b.id);
  });
}

function livingObjects(match: FourPlayerMatchState): FourPlayerBattlefieldObject[] {
  return [...(match.battlefield ?? createFourPlayerBattlefieldState()).objects].filter((object) => {
    if (match.seats[object.controllerSeat].eliminated) return false;
    if (object.combat && object.combat.health <= 0) return false;
    if (object.durability && object.durability.health <= 0) return false;
    if (object.kind === "sentinela" && object.loyalty !== undefined && object.loyalty <= 0) return false;
    return true;
  });
}

function canTargetEnemy(object: FourPlayerBattlefieldObject, actor: FourPlayerSeat): boolean {
  return object.controllerSeat !== actor && !object.keywords.includes("Hexproof");
}

function automaticTargetForEffect(
  match: FourPlayerMatchState,
  actor: FourPlayerSeat,
  effect: CardEffect,
  sourceTargetId?: string,
): FourPlayerTargetRef | undefined {
  if (effect.kind === "damageNexus" || effect.kind === "mill" || effect.kind === "poison") {
    const seat = nextOpponent(match, actor);
    return seat ? { kind: "player", seat } : undefined;
  }

  if (effect.target === "none") return undefined;
  if (effect.target === "self") {
    const source = sourceTargetId
      ? (match.battlefield?.objects ?? []).find((object) => object.id === sourceTargetId)
      : undefined;
    return source ? { kind: "battlefield", objectId: source.id } : undefined;
  }

  const objects = livingObjects(match);
  const units = objects.filter((object) => ["unit", "general", "token"].includes(object.kind) && object.combat);
  const permanents = objects.filter((object) => object.kind === "permanent" && object.durability);
  const sentinelas = objects.filter((object) => object.kind === "sentinela" && object.loyalty !== undefined);

  const strongestUnit = (items: readonly FourPlayerBattlefieldObject[]) =>
    stableObjectOrder(match, actor, items, (object) => object.combat?.power ?? 0)[0];
  const strongestPermanent = (items: readonly FourPlayerBattlefieldObject[]) =>
    stableObjectOrder(match, actor, items, (object) => object.durability?.health ?? 0)[0];
  const weakestSentinela = (items: readonly FourPlayerBattlefieldObject[]) =>
    stableObjectOrder(match, actor, items, (object) => object.loyalty ?? Number.MAX_SAFE_INTEGER, true)[0];

  let selected: FourPlayerBattlefieldObject | undefined;
  if (effect.target === "allyUnit") selected = strongestUnit(units.filter((object) => object.controllerSeat === actor));
  if (effect.target === "enemyUnit") selected = strongestUnit(units.filter((object) => canTargetEnemy(object, actor)));
  if (effect.target === "anyUnit") {
    selected = strongestUnit(units.filter((object) => object.controllerSeat === actor || canTargetEnemy(object, actor)));
  }
  if (effect.target === "allyPermanent") selected = strongestPermanent(permanents.filter((object) => object.controllerSeat === actor));
  if (effect.target === "enemyPermanent") selected = strongestPermanent(permanents.filter((object) => canTargetEnemy(object, actor)));
  if (effect.target === "anyPermanent") {
    selected = strongestPermanent(permanents.filter((object) => object.controllerSeat === actor || canTargetEnemy(object, actor)));
  }
  if (effect.target === "allySentinela") selected = weakestSentinela(sentinelas.filter((object) => object.controllerSeat === actor));
  if (effect.target === "enemySentinela") selected = weakestSentinela(sentinelas.filter((object) => canTargetEnemy(object, actor)));
  if (effect.target === "anySentinela") {
    selected = weakestSentinela(sentinelas.filter((object) => object.controllerSeat === actor || canTargetEnemy(object, actor)));
  }
  if (effect.target === "anyBoard") {
    selected = strongestUnit(units.filter((object) => object.controllerSeat === actor || canTargetEnemy(object, actor)))
      ?? strongestPermanent(permanents.filter((object) => object.controllerSeat === actor || canTargetEnemy(object, actor)));
  }
  return selected ? { kind: "battlefield", objectId: selected.id } : undefined;
}

function snapshotTargets(
  match: FourPlayerMatchState,
  actor: FourPlayerSeat,
  effect: CardEffect,
  sourceTargetId?: string,
): readonly (FourPlayerTargetRef | null)[] {
  const targets: (FourPlayerTargetRef | null)[] = [];
  let cursor: CardEffect | undefined = effect;
  for (let guard = 0; cursor && guard < 32; guard += 1) {
    targets.push(automaticTargetForEffect(match, actor, cursor, sourceTargetId) ?? null);
    cursor = cursor.also;
  }
  return targets;
}

function effectNeedsTarget(effect: CardEffect): boolean {
  if (effect.kind === "damageNexus" || effect.kind === "mill" || effect.kind === "poison") return true;
  return effect.target !== "none";
}

function targetStillLegal(
  match: FourPlayerMatchState,
  actor: FourPlayerSeat,
  effect: CardEffect,
  target: FourPlayerTargetRef | null | undefined,
  sourceTargetId?: string,
): boolean {
  if (!target) return !effectNeedsTarget(effect);
  if (target.kind === "player") {
    if (match.seats[target.seat].eliminated) return false;
    if (effect.kind === "damageNexus" || effect.kind === "mill" || effect.kind === "poison") {
      return target.seat !== actor;
    }
    if (effect.kind === "healNexus") return target.seat === actor;
    return true;
  }
  if (target.kind !== "battlefield") return false;
  if (effect.target === "self") {
    if (!sourceTargetId || target.objectId !== sourceTargetId) return false;
    const source = (match.battlefield?.objects ?? []).find((object) => object.id === sourceTargetId);
    return Boolean(source && (!source.combat || source.combat.health > 0));
  }
  try {
    assertFourPlayerTargetObject(match, actor, target, effect.target);
    return true;
  } catch {
    return false;
  }
}

function candidateForObject(
  object: FourPlayerBattlefieldObject,
  when: FourPlayerAutomaticTriggerWhen,
  ordinal: number,
): TriggerCandidate | undefined {
  const definition = safeCard(object.defId);
  const trigger = definition?.trigger;
  if (!definition || !trigger || trigger.when !== when) return undefined;
  if (!automaticTriggerChainSupported(trigger.effect)) return undefined;
  return {
    controller: object.controllerSeat,
    sourceId: object.id,
    sourceDefId: object.defId,
    sourceKind: object.kind,
    sourceTargetId: object.id,
    when,
    description: `${definition.name} — ${when}`,
    effect: structuredClone(trigger.effect),
    ordinal,
  };
}

function equipmentCandidates(
  bearer: FourPlayerBattlefieldObject,
  when: FourPlayerAutomaticTriggerWhen,
  ordinalStart: number,
  reverse = false,
): TriggerCandidate[] {
  if (!["onStrike", "onKill", "onNexusStrike", "onAllyDeath"].includes(when)) return [];
  const candidates: TriggerCandidate[] = [];
  let ordinal = ordinalStart;
  const attachments = reverse ? [...(bearer.equipment ?? [])].reverse() : [...(bearer.equipment ?? [])];
  for (const equipment of attachments) {
    const definition = safeCard(equipment.defId);
    const trigger = definition?.trigger;
    if (!definition || !trigger || trigger.when !== when || !automaticTriggerChainSupported(trigger.effect)) continue;
    candidates.push({
      controller: bearer.controllerSeat,
      sourceId: equipment.instanceId,
      sourceDefId: equipment.defId,
      sourceKind: "equipment",
      sourceTargetId: bearer.id,
      when,
      description: `${definition.name} — ${when}`,
      effect: structuredClone(trigger.effect),
      ordinal: ordinal++,
    });
  }
  return candidates;
}

function queueCandidates(
  match: FourPlayerMatchState,
  candidates: readonly TriggerCandidate[],
  eventKey: string,
): FourPlayerTriggerQueueResult {
  if (match.status === "completed" || candidates.length === 0) return { match, queued: [] };
  const seatOrder = livingSeatOrder(match, match.turn.activeSeat);
  const rank = new Map(seatOrder.map((seat, index) => [seat, index]));
  const ordered = [...candidates]
    .filter((candidate) => !match.seats[candidate.controller].eliminated)
    .sort((a, b) => {
      const ar = rank.get(a.controller) ?? FOUR_PLAYER_SEATS.length;
      const br = rank.get(b.controller) ?? FOUR_PLAYER_SEATS.length;
      return ar !== br ? ar - br : a.ordinal - b.ordinal;
    });

  let stack = match.resolution.stack;
  const queued: FourPlayerStackItem<FourPlayerTriggeredAbilityPayload>[] = [];
  for (let index = 0; index < ordered.length; index += 1) {
    const candidate = ordered[index]!;
    const item: FourPlayerStackItem<FourPlayerTriggeredAbilityPayload> = {
      id: `trigger:${eventKey}:${candidate.when}:${candidate.sourceId}:${index}`,
      controller: candidate.controller,
      kind: "triggered_ability",
      payload: {
        sourceId: candidate.sourceId,
        sourceDefId: candidate.sourceDefId,
        sourceKind: candidate.sourceKind,
        when: candidate.when,
        description: candidate.description,
        effect: structuredClone(candidate.effect),
        targets: snapshotTargets(match, candidate.controller, candidate.effect, candidate.sourceTargetId),
      },
    };
    stack = pushFourPlayerStackItem(stack, item);
    queued.push(item);
  }

  if (queued.length === 0) return { match, queued };
  const priority = createFourPlayerPriorityState(
    match.turn.activeSeat,
    match.turn.eliminatedSeats,
    match.resolution.priority.mode,
  );
  return {
    match: { ...match, resolution: { stack, priority } },
    queued,
  };
}

export function queueFourPlayerTransitionTriggers(
  before: FourPlayerMatchState,
  after: FourPlayerMatchState,
  destroyed: readonly Pick<FourPlayerCombatDestroyedObject, "id" | "defId" | "ownerSeat" | "kind" | "killerId">[] = [],
  eventKey = `transition:${after.turn.turn}`,
): FourPlayerTriggerQueueResult {
  if (after.status === "completed") return { match: after, queued: [] };
  const beforeObjects = before.battlefield?.objects ?? [];
  const afterObjects = after.battlefield?.objects ?? [];
  const beforeById = new Map(beforeObjects.map((object) => [object.id, object]));
  const afterIds = new Set(afterObjects.map((object) => object.id));
  const entered = afterObjects.filter((object) => !beforeById.has(object.id));
  const candidates: TriggerCandidate[] = [];
  let ordinal = 0;

  for (const object of entered) {
    const definition = safeCard(object.defId);
    if (!definition || definition.type !== "Unit") continue;
    const summon = candidateForObject(object, "onSummon", ordinal++);
    if (summon) candidates.push(summon);

    for (const watcher of afterObjects) {
      if (watcher.controllerSeat !== object.controllerSeat || watcher.kind !== "permanent") continue;
      const watcherDef = safeCard(watcher.defId);
      if (!watcherDef || (watcherDef.type !== "Enchantment" && watcherDef.type !== "Artifact")) continue;
      const permanentSummon = candidateForObject(watcher, "onPermanentSummon", ordinal++);
      if (permanentSummon) candidates.push(permanentSummon);
    }
  }

  for (const dead of destroyed) {
    const source = beforeById.get(dead.id);
    if (!source || afterIds.has(source.id)) continue;
    const definition = safeCard(source.defId);
    if (definition?.type === "Unit") {
      const death = candidateForObject(source, "onDeath", ordinal++);
      if (death) candidates.push({ ...death, sourceTargetId: undefined });

      if (dead.killerId) {
        const killer = beforeById.get(dead.killerId);
        const killerDef = killer ? safeCard(killer.defId) : undefined;
        if (killer && killerDef?.type === "Unit") {
          const killEquipment = equipmentCandidates(killer, "onKill", ordinal, true);
          candidates.push(...killEquipment);
          ordinal += killEquipment.length;
          const kill = candidateForObject(killer, "onKill", ordinal++);
          if (kill) candidates.push(kill);
        }
      }

      for (const survivor of afterObjects) {
        if (survivor.controllerSeat !== source.controllerSeat) continue;
        const survivorDef = safeCard(survivor.defId);
        if (survivorDef?.type === "Unit") {
          const allyDeath = candidateForObject(survivor, "onAllyDeath", ordinal++);
          if (allyDeath) candidates.push(allyDeath);
        }
        const equipment = equipmentCandidates(survivor, "onAllyDeath", ordinal);
        candidates.push(...equipment);
        ordinal += equipment.length;
      }
    }
  }

  return queueCandidates(after, candidates, eventKey);
}

function appendImpactEventCandidates(
  candidates: TriggerCandidate[],
  source: FourPlayerBattlefieldObject,
  when: "onStrike" | "onNexusStrike",
  ordinal: number,
): number {
  const equipment = equipmentCandidates(source, when, ordinal, true);
  candidates.push(...equipment);
  let nextOrdinal = ordinal + equipment.length;
  const card = candidateForObject(source, when, nextOrdinal++);
  if (card) candidates.push(card);
  return nextOrdinal;
}

export function queueFourPlayerCombatImpactTriggers(
  match: FourPlayerMatchState,
  impacts: readonly FourPlayerCombatImpact[],
  eventKey = `combat-impact:${match.turn.turn}`,
): FourPlayerTriggerQueueResult {
  if (match.status === "completed" || impacts.length === 0) return { match, queued: [] };
  const candidates: TriggerCandidate[] = [];
  let ordinal = 0;
  for (const impact of impacts) {
    // Push NexusStrike before Strike so LIFO resolution preserves 1v1 order:
    // onStrike resolves first, followed by onNexusStrike.
    if (impact.kind === "nexus_strike") {
      ordinal = appendImpactEventCandidates(candidates, impact.source, "onNexusStrike", ordinal);
    }
    ordinal = appendImpactEventCandidates(candidates, impact.source, "onStrike", ordinal);
  }
  return queueCandidates(match, candidates, eventKey);
}

export function queueFourPlayerCombatDeclarationTriggers(
  match: FourPlayerMatchState,
  eventKey = `combat-declarations:${match.turn.turn}`,
): FourPlayerTriggerQueueResult {
  if (match.status === "completed" || match.phase !== "combat") return { match, queued: [] };
  const battlefield = match.battlefield ?? createFourPlayerBattlefieldState();
  const candidates: TriggerCandidate[] = [];
  let ordinal = 0;

  for (const attacker of match.combat.attackers) {
    const source = battlefield.objects.find((object) => object.id === attacker.unitId);
    if (!source || source.controllerSeat !== attacker.controller) continue;
    const candidate = candidateForObject(source, "onAttack", ordinal++);
    if (candidate) candidates.push(candidate);
  }
  for (const blocker of match.combat.blockers) {
    const source = battlefield.objects.find((object) => object.id === blocker.unitId);
    if (!source || source.controllerSeat !== blocker.controller) continue;
    const candidate = candidateForObject(source, "onBlock", ordinal++);
    if (candidate) candidates.push(candidate);
  }

  return queueCandidates(match, candidates, eventKey);
}

export function queueFourPlayerRoundStartTriggers(
  match: FourPlayerMatchState,
  eventKey = `round:${match.turn.round}`,
): FourPlayerTriggerQueueResult {
  if (match.status === "completed") return { match, queued: [] };
  const candidates: TriggerCandidate[] = [];
  let ordinal = 0;
  for (const object of match.battlefield?.objects ?? []) {
    const definition = safeCard(object.defId);
    if (
      !definition
      || (definition.type !== "Unit" && definition.type !== "Enchantment" && definition.type !== "Artifact")
    ) continue;
    const candidate = candidateForObject(object, "onRoundStart", ordinal++);
    if (candidate) candidates.push(candidate);
  }
  return queueCandidates(match, candidates, eventKey);
}

export function queueFourPlayerLevelUpTriggers(
  match: FourPlayerMatchState,
  leveled: readonly FourPlayerLevelUpEvent[],
  eventKey = `level-up:${match.turn.turn}`,
): FourPlayerTriggerQueueResult {
  if (match.status === "completed" || leveled.length === 0) return { match, queued: [] };
  const candidates: TriggerCandidate[] = [];
  let ordinal = 0;
  for (const event of leveled) {
    const source = (match.battlefield?.objects ?? []).find((object) => object.id === event.objectId);
    if (!source || source.defId !== event.toDefId) continue;
    const candidate = candidateForObject(source, "onLevelUp", ordinal++);
    if (candidate) candidates.push(candidate);
  }
  return queueCandidates(match, candidates, eventKey);
}

export function destroyedFourPlayerObjectsFromRemoval(
  before: FourPlayerMatchState,
  after: FourPlayerMatchState,
): readonly FourPlayerCombatDestroyedObject[] {
  const afterIds = new Set((after.battlefield?.objects ?? []).map((object) => object.id));
  return (before.battlefield?.objects ?? [])
    .filter((object) => !afterIds.has(object.id))
    .map((object) => ({
      id: object.id,
      defId: object.defId,
      ownerSeat: object.ownerSeat,
      kind: object.kind,
      destination: object.kind === "general" ? "general_zone" : object.kind === "token" ? "none" : "graveyard",
    }));
}

export function resolveFourPlayerTriggeredAbility(
  match: FourPlayerMatchState,
  item: FourPlayerStackItem,
): FourPlayerEffectResolutionResult {
  if (item.kind !== "triggered_ability") return { match, destroyed: [], draws: {} };
  const payload = item.payload as Partial<FourPlayerTriggeredAbilityPayload>;
  if (
    !payload.sourceId
    || !payload.sourceDefId
    || !payload.when
    || !FOUR_PLAYER_AUTOMATIC_TRIGGER_EVENTS.includes(payload.when as FourPlayerAutomaticTriggerWhen)
    || !payload.effect
    || !Array.isArray(payload.targets)
  ) {
    throw new Error("Resolved 4P trigger is missing authoritative trigger identity.");
  }
  if (!automaticTriggerChainSupported(payload.effect)) {
    throw new Error(`Resolved 4P trigger ${payload.sourceDefId} contains an unsupported effect chain.`);
  }

  const sourceDefinition = safeCard(payload.sourceDefId);
  const sourceRaces = sourceDefinition
    ? (sourceDefinition.race ? [sourceDefinition.race] : [])
    : undefined;

  let current = match;
  const destroyed: FourPlayerCombatDestroyedObject[] = [];
  const draws: Partial<Record<FourPlayerSeat, number>> = {};
  const zoneActions: FourPlayerEffectZoneAction[] = [];
  let cursor: CardEffect | undefined = payload.effect;
  let index = 0;

  while (cursor && index < 32 && current.status === "active") {
    const single: CardEffect = { ...cursor, also: undefined };
    const target = payload.targets[index] ?? null;
    if (targetStillLegal(current, item.controller, single, target, payload.sourceId)) {
      const resolved = resolveFourPlayerEffect(
        current,
        item.controller,
        single,
        target ?? undefined,
        {
          tokenNamespace: `${item.id}:${index}`,
          ...(sourceRaces !== undefined ? { sourceRaces } : {}),
        },
      );
      current = resolved.match;
      destroyed.push(...resolved.destroyed);
      for (const [seat, amount] of Object.entries(resolved.draws)) {
        if (!amount) continue;
        const key = seat as FourPlayerSeat;
        draws[key] = (draws[key] ?? 0) + amount;
      }
      zoneActions.push(...(resolved.zoneActions ?? []));
    }
    cursor = cursor.also;
    index += 1;
  }
  if (cursor) throw new Error("4P triggered effect chain exceeds the maximum supported depth.");
  return { match: current, destroyed, draws, ...(zoneActions.length ? { zoneActions } : {}) };
}
