import {
  createCustomGame,
  applyStackedActionWithAi,
  resolveCombat,
  canPlayCard,
  canDeclareAttack,
  playUnit,
  castSpell,
  spellNeedsTarget,
  declareAttack,
  endTurn,
  canBlock,
  isValidTarget,
  type CardAction,
} from "@/game/engine";
import { aiChooseAction, aiChooseReaction, aiChooseSentinelaAction, applyAiAction, aiResolveTurnEnd } from "@/game/ai";
import { getCard } from "@/game/cards";
import { getDeck } from "@/game/decks";
import { semanticCardTypeLabel } from "@/game/semantic-card-types";
import type { DeckInput, GameState, PlayerId } from "@/game/types";
import { ENGINE_VERSION, RULESET_VERSION } from "@/game/version";

export type SimulationSummary = {
  deckA: string;
  deckB: string;
  requestedGames: number;
  completedGames: number;
  winsA: number;
  winsB: number;
  draws: number;
  avgRounds: number;
  winRateA: number;
  winRateB: number;
  firstPlayerWins: number;
  secondPlayerWins: number;
  firstPlayerWinRate: number;
  winRateA95: { low: number; high: number };
  seed: number;
  engineVersion: string;
  rulesetVersion: string;
  roundDistribution: { min: number; max: number; median: number };
};

export type BalanceSimulationPolicy = "player-heuristic" | "ai-core";

export type UtilizationCounters = {
  seen: number;
  initialHand: number;
  drawn: number;
  played: number;
  endHand: number;
  playableSamples: number;
  unplayableSamples: number;
  ignoredPlayableSamples: number;
  targetStarvedSamples: number;
  reactionOnlySamples: number;
  policyUnsupportedSamples: number;
};

export type CardUtilizationTelemetry = UtilizationCounters & {
  defId: string;
  name: string;
  semanticType: string;
  printedCost: number;
};

export type SemanticTypeUtilizationTelemetry = UtilizationCounters & {
  semanticType: string;
};

export type PolicyUtilizationTelemetry = {
  policy: BalanceSimulationPolicy;
  games: number;
  decisions: number;
  cardPlays: number;
  activations: number;
  attacks: number;
  endTurns: number;
  noOpActions: number;
  endTurnsWithPlayable: number;
  unspentManaAtTurnEnd: number;
  unspentSpellManaAtTurnEnd: number;
};

export type DeckUtilizationTelemetry = {
  id: string;
  name: string;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  seenCards: number;
  initialHandCards: number;
  drawnCards: number;
  cardsPlayed: number;
  endHandCards: number;
  decisionSamples: number;
  endTurnsWithPlayable: number;
  printedCostPlayed: number;
  manaSpentOnCardPlays: number;
  spellManaSpentOnCardPlays: number;
  handSizeSamples: number;
  benchSizeSamples: number;
  permanentSizeSamples: number;
  sentinelaSizeSamples: number;
  manaSamples: number;
  spellManaSamples: number;
  finalSpellsCast: number;
  finalAlliesSummoned: number;
  finalNexusDamageDealt: number;
  finalHandSize: number;
  finalBenchSize: number;
  finalPermanentSize: number;
  finalSentinelaSize: number;
  cards: Record<string, CardUtilizationTelemetry>;
  semanticTypes: Record<string, SemanticTypeUtilizationTelemetry>;
  policies: Record<BalanceSimulationPolicy, PolicyUtilizationTelemetry>;
};

export type BalanceSimulationTelemetry = {
  decks: Record<string, DeckUtilizationTelemetry>;
};

export type TelemetrySimulationResult = {
  summary: SimulationSummary;
  telemetry: BalanceSimulationTelemetry;
};

type DecisionKind = "cardPlay" | "activation" | "attack" | "endTurn" | "noOp";

type ReactionRecord = {
  playerId: PlayerId;
  action: CardAction;
};

type DecisionResult = {
  next: GameState;
  kind: DecisionKind;
  action?: CardAction;
  reactions?: ReactionRecord[];
};

type SeenContext = {
  seen: Set<string>;
  initial: Set<string>;
};

type TelemetryRuntime = {
  report: BalanceSimulationTelemetry;
  seenByDeck: Record<string, SeenContext>;
};

function wilson95(wins: number, total: number): { low: number; high: number } {
  if (!total) return { low: 0, high: 0 };
  const z = 1.96, p = wins / total, z2 = z * z;
  const center = (p + z2 / (2 * total)) / (1 + z2 / total);
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total) / (1 + z2 / total);
  return { low: Math.round(Math.max(0, center - margin) * 1000) / 10, high: Math.round(Math.min(1, center + margin) * 1000) / 10 };
}

function deck(id: string, overrides?: Record<string, DeckInput>): DeckInput {
  if (overrides?.[id]) return { ...overrides[id], cards: [...overrides[id].cards] };
  const d = getDeck(id);
  return { id: d.id, name: d.name, cards: d.cards };
}

function emptyCounters(): UtilizationCounters {
  return {
    seen: 0,
    initialHand: 0,
    drawn: 0,
    played: 0,
    endHand: 0,
    playableSamples: 0,
    unplayableSamples: 0,
    ignoredPlayableSamples: 0,
    targetStarvedSamples: 0,
    reactionOnlySamples: 0,
    policyUnsupportedSamples: 0,
  };
}

function emptyPolicy(policy: BalanceSimulationPolicy): PolicyUtilizationTelemetry {
  return {
    policy,
    games: 0,
    decisions: 0,
    cardPlays: 0,
    activations: 0,
    attacks: 0,
    endTurns: 0,
    noOpActions: 0,
    endTurnsWithPlayable: 0,
    unspentManaAtTurnEnd: 0,
    unspentSpellManaAtTurnEnd: 0,
  };
}

function emptyDeckTelemetry(input: DeckInput): DeckUtilizationTelemetry {
  return {
    id: input.id,
    name: input.name,
    games: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    seenCards: 0,
    initialHandCards: 0,
    drawnCards: 0,
    cardsPlayed: 0,
    endHandCards: 0,
    decisionSamples: 0,
    endTurnsWithPlayable: 0,
    printedCostPlayed: 0,
    manaSpentOnCardPlays: 0,
    spellManaSpentOnCardPlays: 0,
    handSizeSamples: 0,
    benchSizeSamples: 0,
    permanentSizeSamples: 0,
    sentinelaSizeSamples: 0,
    manaSamples: 0,
    spellManaSamples: 0,
    finalSpellsCast: 0,
    finalAlliesSummoned: 0,
    finalNexusDamageDealt: 0,
    finalHandSize: 0,
    finalBenchSize: 0,
    finalPermanentSize: 0,
    finalSentinelaSize: 0,
    cards: {},
    semanticTypes: {},
    policies: {
      "player-heuristic": emptyPolicy("player-heuristic"),
      "ai-core": emptyPolicy("ai-core"),
    },
  };
}

function cardTelemetry(target: DeckUtilizationTelemetry, defId: string): CardUtilizationTelemetry {
  const existing = target.cards[defId];
  if (existing) return existing;
  const def = getCard(defId);
  const created: CardUtilizationTelemetry = {
    ...emptyCounters(),
    defId,
    name: def.name,
    semanticType: semanticCardTypeLabel(def),
    printedCost: def.cost,
  };
  target.cards[defId] = created;
  return created;
}

function semanticTelemetry(target: DeckUtilizationTelemetry, semanticType: string): SemanticTypeUtilizationTelemetry {
  const existing = target.semanticTypes[semanticType];
  if (existing) return existing;
  const created: SemanticTypeUtilizationTelemetry = { ...emptyCounters(), semanticType };
  target.semanticTypes[semanticType] = created;
  return created;
}

function incrementBoth(
  target: DeckUtilizationTelemetry,
  defId: string,
  field: keyof UtilizationCounters,
  amount = 1,
): void {
  const card = cardTelemetry(target, defId);
  const semantic = semanticTelemetry(target, card.semanticType);
  card[field] += amount;
  semantic[field] += amount;
}

function createTelemetry(a: DeckInput, b: DeckInput): BalanceSimulationTelemetry {
  return { decks: { [a.id]: emptyDeckTelemetry(a), [b.id]: emptyDeckTelemetry(b) } };
}

function ensureDeckTelemetry(report: BalanceSimulationTelemetry, input: DeckInput): DeckUtilizationTelemetry {
  return report.decks[input.id] ?? (report.decks[input.id] = emptyDeckTelemetry(input));
}

function cloneCountersInto(target: UtilizationCounters, source: UtilizationCounters): void {
  for (const key of Object.keys(emptyCounters()) as Array<keyof UtilizationCounters>) target[key] += source[key];
}

/** Merge telemetry from independently simulated matchup/seed batches without losing deck identity. */
export function mergeBalanceSimulationTelemetry(
  reports: BalanceSimulationTelemetry[],
): BalanceSimulationTelemetry {
  const merged: BalanceSimulationTelemetry = { decks: {} };
  for (const report of reports) {
    for (const source of Object.values(report.decks)) {
      const target = ensureDeckTelemetry(merged, { id: source.id, name: source.name, cards: [] });
      for (const field of [
        "games", "wins", "losses", "draws", "seenCards", "initialHandCards", "drawnCards", "cardsPlayed",
        "endHandCards", "decisionSamples", "endTurnsWithPlayable", "printedCostPlayed", "manaSpentOnCardPlays",
        "spellManaSpentOnCardPlays", "handSizeSamples", "benchSizeSamples", "permanentSizeSamples", "sentinelaSizeSamples",
        "manaSamples", "spellManaSamples", "finalSpellsCast", "finalAlliesSummoned", "finalNexusDamageDealt", "finalHandSize",
        "finalBenchSize", "finalPermanentSize", "finalSentinelaSize",
      ] as const) target[field] += source[field];

      for (const [defId, card] of Object.entries(source.cards)) {
        const dest = cardTelemetry(target, defId);
        cloneCountersInto(dest, card);
      }
      for (const [type, semantic] of Object.entries(source.semanticTypes)) {
        const dest = semanticTelemetry(target, type);
        cloneCountersInto(dest, semantic);
      }
      for (const policyName of ["player-heuristic", "ai-core"] as BalanceSimulationPolicy[]) {
        const srcPolicy = source.policies[policyName];
        const destPolicy = target.policies[policyName];
        for (const field of [
          "games", "decisions", "cardPlays", "activations", "attacks", "endTurns", "noOpActions",
          "endTurnsWithPlayable", "unspentManaAtTurnEnd", "unspentSpellManaAtTurnEnd",
        ] as const) destPolicy[field] += srcPolicy[field];
      }
    }
  }
  return merged;
}

function chooseBlocksSymmetric(state: GameState): Record<string,string> {
  if(!state.combat)return {}; const attacker=state.combat.attackerId; const defender=attacker==="player"?"ai":"player";
  const attackers=state.players[attacker].bench.filter(u=>u.isAttacking&&!state.combat!.locked.includes(u.instanceId));
  const blockers=state.players[defender].bench.slice(); const used=new Set<string>(); const blocks:Record<string,string>={...state.combat.blocks};
  for(const atk of [...attackers].sort((a,b)=>b.power-a.power)){const candidates=blockers.filter(b=>!used.has(b.instanceId)&&canBlock(atk,b)); const choice=candidates.sort((a,b)=>((b.power>=atk.health?1:0)-(a.power>=atk.health?1:0))||b.health-a.health)[0]; if(choice){blocks[atk.instanceId]=choice.instanceId;used.add(choice.instanceId);}}
  return blocks;
}

function playOneForPlayerDetailed(state: GameState): DecisionResult {
  const sentinelAction = aiChooseSentinelaAction(state, "player");
  if (sentinelAction) {
    const next = applyAiAction(state, sentinelAction, "player");
    return { next, kind: next === state ? "noOp" : "activation", action: sentinelAction };
  }
  const p=state.players.player;
  const playable=p.hand.filter(c=>canPlayCard(state,"player",c.instanceId)).sort((a,b)=>getCard(b.defId).cost-getCard(a.defId).cost);
  for(const c of playable){
    const def=getCard(c.defId); let next=state; let action: CardAction | undefined;
    if(def.type==="Unit"||def.type==="Enchantment"||def.type==="Artifact"||def.type==="Sentinela") {
      action={kind:"unit",instanceId:c.instanceId,defId:c.defId};
      next=playUnit(state,"player",c.instanceId);
    }
    else if(def.type==="Equipment"){
      const t=[...p.bench].filter(u=>u.equipment.length<2).sort((a,b)=>b.power-a.power)[0];
      if(!t)continue;
      action={kind:"unit",instanceId:c.instanceId,defId:c.defId,targetInstanceId:t.instanceId};
      next=playUnit(state,"player",c.instanceId,t.instanceId);
    }
    else if(def.type==="Spell"){
      const needs=spellNeedsTarget(c.defId);
      if(!needs||needs==="none"||needs==="self"||needs==="spellOnStack") {
        action={kind:"spell",instanceId:c.instanceId,defId:c.defId};
        next=castSpell(state,"player",c.instanceId);
      }
      else if(needs==="enemyUnit"||needs==="anyUnit"){
        const t=state.players.ai.bench.slice().sort((a,b)=>b.power-a.power)[0];if(!t)continue;
        action={kind:"spell",instanceId:c.instanceId,defId:c.defId,targetInstanceId:t.instanceId};
        next=castSpell(state,"player",c.instanceId,t.instanceId);
      }
      else if(needs==="allyUnit"){
        const t=p.bench.slice().sort((a,b)=>b.power-a.power)[0];if(!t)continue;
        action={kind:"spell",instanceId:c.instanceId,defId:c.defId,targetInstanceId:t.instanceId};
        next=castSpell(state,"player",c.instanceId,t.instanceId);
      }
    }
    if(next!==state)return { next, kind:"cardPlay", action };
  }
  if(canDeclareAttack(state,"player")){
    const ids=p.bench.filter(u=>!u.stunned&&!u.summonedThisTurn).map(u=>u.instanceId);
    if(ids.length)return { next:declareAttack(state,"player",ids,{}), kind:"attack" };
  }
  return { next:endTurn(state,"player"), kind:"endTurn" };
}

function playOneForPlayer(state: GameState): GameState {
  return playOneForPlayerDetailed(state).next;
}

function playOneForPlayerStackAwareDetailed(state: GameState): DecisionResult {
  const sentinelAction = aiChooseSentinelaAction(state, "player");
  if (sentinelAction) {
    const next = applyAiAction(state, sentinelAction, "player");
    return { next, kind: next === state ? "noOp" : "activation", action: sentinelAction };
  }

  const p = state.players.player;
  const playable = p.hand
    .filter((card) => canPlayCard(state, "player", card.instanceId))
    .sort((a, b) => getCard(b.defId).cost - getCard(a.defId).cost);

  for (const card of playable) {
    const def = getCard(card.defId);
    let action: CardAction | undefined;

    if (def.type === "Unit" || def.type === "Enchantment" || def.type === "Artifact" || def.type === "Sentinela") {
      action = { kind: "unit", instanceId: card.instanceId, defId: card.defId };
    } else if (def.type === "Equipment") {
      const target = [...p.bench].filter((unit) => unit.equipment.length < 2).sort((a, b) => b.power - a.power)[0];
      if (!target) continue;
      action = { kind: "unit", instanceId: card.instanceId, defId: card.defId, targetInstanceId: target.instanceId };
    } else if (def.type === "Spell") {
      const needs = spellNeedsTarget(card.defId);
      if (!needs || needs === "none" || needs === "self") {
        action = { kind: "spell", instanceId: card.instanceId, defId: card.defId };
      } else if (needs === "enemyUnit" || needs === "anyUnit") {
        const target = state.players.ai.bench.slice().sort((a, b) => b.power - a.power)[0];
        if (!target) continue;
        action = { kind: "spell", instanceId: card.instanceId, defId: card.defId, targetInstanceId: target.instanceId };
      } else if (needs === "allyUnit") {
        const target = p.bench.slice().sort((a, b) => b.power - a.power)[0];
        if (!target) continue;
        action = { kind: "spell", instanceId: card.instanceId, defId: card.defId, targetInstanceId: target.instanceId };
      }
    }

    if (!action) continue;
    const applied = applyStackAwareCardAction(state, action, "player");
    if (applied.next !== state) {
      return { next: applied.next, kind: "cardPlay", action, reactions: applied.reactions };
    }
  }

  if (canDeclareAttack(state, "player")) {
    const ids = p.bench.filter((unit) => !unit.stunned && !unit.summonedThisTurn).map((unit) => unit.instanceId);
    if (ids.length) return { next: declareAttack(state, "player", ids, {}), kind: "attack" };
  }
  return { next: endTurn(state, "player"), kind: "endTurn" };
}

function playOneForAiDetailed(state: GameState): DecisionResult {
  const action = aiChooseAction(state);
  if (action) {
    const fromHand = state.players.ai.hand.some((card) => card.instanceId === action.instanceId);
    const next = applyAiAction(state, action);
    return { next, kind: next === state ? "noOp" : fromHand ? "cardPlay" : "activation", action };
  }
  const next = aiResolveTurnEnd(state);
  const attacked = next.phase === "blocking" || (next.combat !== undefined && next.combat !== state.combat);
  return { next, kind: attacked ? "attack" : "endTurn" };
}

function playOneForAiStackAwareDetailed(state: GameState): DecisionResult {
  const action = aiChooseAction(state, "ai");
  if (action) {
    const fromHand = state.players.ai.hand.some((card) => card.instanceId === action.instanceId);
    if (!fromHand || action.kind === "sentinela") {
      const next = applyAiAction(state, action, "ai");
      return { next, kind: next === state ? "noOp" : fromHand ? "cardPlay" : "activation", action };
    }
    const applied = applyStackAwareCardAction(state, action, "ai");
    return {
      next: applied.next,
      kind: applied.next === state ? "noOp" : "cardPlay",
      action,
      reactions: applied.reactions,
    };
  }
  const next = aiResolveTurnEnd(state, "ai");
  const attacked = next.phase === "blocking" || (next.combat !== undefined && next.combat !== state.combat);
  return { next, kind: attacked ? "attack" : "endTurn" };
}

function other(playerId: PlayerId): PlayerId {
  return playerId === "player" ? "ai" : "player";
}

function applyStackAwareCardAction(
  state: GameState,
  action: CardAction,
  playerId: PlayerId,
): { next: GameState; reactions: ReactionRecord[] } {
  const pending: CardAction = { ...action, player: playerId };
  const responder = other(playerId);

  if (responder === "player") {
    const response = aiChooseReaction(state, pending, "player");
    const result = applyStackedActionWithAi(
      state,
      pending,
      response ? "react" : "skip",
      response,
      (current, pendingAction) => aiChooseReaction(current, pendingAction, "ai"),
    );
    return {
      next: result.next,
      reactions: response ? [{ playerId: "player", action: response }] : [],
    };
  }

  let chosenAiResponse: CardAction | null = null;
  const result = applyStackedActionWithAi(
    state,
    pending,
    "skip",
    null,
    (current, pendingAction) => {
      chosenAiResponse = aiChooseReaction(current, pendingAction, "ai");
      return chosenAiResponse;
    },
  );
  return {
    next: result.next,
    reactions: chosenAiResponse ? [{ playerId: "ai", action: chosenAiResponse }] : [],
  };
}

function legalMainTargetExists(state: GameState, playerId: PlayerId, defId: string): boolean {
  const target = spellNeedsTarget(defId);
  if (!target || target === "none" || target === "self") return true;
  if (target === "spellOnStack") return false;
  const enemyId = other(playerId);
  for (const owner of [playerId, enemyId] as PlayerId[]) {
    for (const unit of state.players[owner].bench) {
      if (isValidTarget(state, playerId, target, { kind: "unit", owner, unit })) return true;
    }
    for (const perm of state.players[owner].permanents) {
      if (isValidTarget(state, playerId, target, { kind: "permanent", owner, perm })) return true;
    }
    for (const sen of state.players[owner].sentinelas) {
      if (isValidTarget(state, playerId, target, { kind: "sentinela", owner, sen })) return true;
    }
  }
  return false;
}

function playerHeuristicSupportsCard(defId: string): boolean {
  const def = getCard(defId);
  if (def.type !== "Spell") return true;
  const target = spellNeedsTarget(defId);
  return !target || target === "none" || target === "self" || target === "spellOnStack" ||
    target === "enemyUnit" || target === "anyUnit" || target === "allyUnit";
}

function recordSeen(
  runtime: TelemetryRuntime,
  deckId: string,
  defId: string,
  instanceId: string,
  initial: boolean,
): void {
  const seen = runtime.seenByDeck[deckId];
  if (seen.seen.has(instanceId)) return;
  seen.seen.add(instanceId);
  if (initial) seen.initial.add(instanceId);
  const deckTelemetry = runtime.report.decks[deckId];
  incrementBoth(deckTelemetry, defId, "seen");
  deckTelemetry.seenCards += 1;
  if (initial) {
    incrementBoth(deckTelemetry, defId, "initialHand");
    deckTelemetry.initialHandCards += 1;
  } else {
    incrementBoth(deckTelemetry, defId, "drawn");
    deckTelemetry.drawnCards += 1;
  }
}

function recordInitialHand(runtime: TelemetryRuntime, state: GameState, playerId: PlayerId, deckId: string): void {
  for (const card of state.players[playerId].hand) recordSeen(runtime, deckId, card.defId, card.instanceId, true);
}

function observeDecision(
  runtime: TelemetryRuntime,
  state: GameState,
  playerId: PlayerId,
  deckId: string,
  policy: BalanceSimulationPolicy,
): string[] {
  const deckTelemetry = runtime.report.decks[deckId];
  const policyTelemetry = deckTelemetry.policies[policy];
  const player = state.players[playerId];
  deckTelemetry.decisionSamples += 1;
  policyTelemetry.decisions += 1;
  deckTelemetry.handSizeSamples += player.hand.length;
  deckTelemetry.benchSizeSamples += player.bench.length;
  deckTelemetry.permanentSizeSamples += player.permanents.length;
  deckTelemetry.sentinelaSizeSamples += player.sentinelas.length;
  deckTelemetry.manaSamples += player.mana;
  deckTelemetry.spellManaSamples += player.spellMana;

  const playable: string[] = [];
  for (const card of player.hand) {
    recordSeen(runtime, deckId, card.defId, card.instanceId, false);
    const def = getCard(card.defId);
    const canPlay = canPlayCard(state, playerId, card.instanceId);
    incrementBoth(deckTelemetry, card.defId, canPlay ? "playableSamples" : "unplayableSamples");
    if (canPlay) playable.push(card.instanceId);
    const needs = spellNeedsTarget(card.defId);
    if (needs && needs !== "none" && needs !== "self" && !legalMainTargetExists(state, playerId, card.defId)) {
      incrementBoth(deckTelemetry, card.defId, "targetStarvedSamples");
    }
    if (def.archetypeKey === "trap" || needs === "spellOnStack") {
      incrementBoth(deckTelemetry, card.defId, "reactionOnlySamples");
    }
    if (policy === "player-heuristic" && canPlay && !playerHeuristicSupportsCard(card.defId)) {
      incrementBoth(deckTelemetry, card.defId, "policyUnsupportedSamples");
    }
  }
  return playable;
}

function recordDecisionOutcome(
  runtime: TelemetryRuntime,
  before: GameState,
  after: GameState,
  playerId: PlayerId,
  deckId: string,
  policy: BalanceSimulationPolicy,
  result: DecisionResult,
  playableInstances: string[],
): void {
  const deckTelemetry = runtime.report.decks[deckId];
  const policyTelemetry = deckTelemetry.policies[policy];
  if (result.kind === "cardPlay" && result.action) {
    policyTelemetry.cardPlays += 1;
    deckTelemetry.cardsPlayed += 1;
    incrementBoth(deckTelemetry, result.action.defId, "played");
    const def = getCard(result.action.defId);
    deckTelemetry.printedCostPlayed += def.cost;
    deckTelemetry.manaSpentOnCardPlays += Math.max(0, before.players[playerId].mana - after.players[playerId].mana);
    deckTelemetry.spellManaSpentOnCardPlays += Math.max(0, before.players[playerId].spellMana - after.players[playerId].spellMana);
  } else if (result.kind === "activation") {
    policyTelemetry.activations += 1;
  } else if (result.kind === "attack") {
    policyTelemetry.attacks += 1;
  } else if (result.kind === "endTurn") {
    policyTelemetry.endTurns += 1;
    policyTelemetry.unspentManaAtTurnEnd += before.players[playerId].mana;
    policyTelemetry.unspentSpellManaAtTurnEnd += before.players[playerId].spellMana;
    if (playableInstances.length > 0) {
      policyTelemetry.endTurnsWithPlayable += 1;
      deckTelemetry.endTurnsWithPlayable += 1;
      for (const instanceId of playableInstances) {
        const card = before.players[playerId].hand.find((item) => item.instanceId === instanceId);
        if (card) incrementBoth(deckTelemetry, card.defId, "ignoredPlayableSamples");
      }
    }
  } else if (result.kind === "noOp") {
    policyTelemetry.noOpActions += 1;
  }
}

function recordReactionOutcome(
  runtime: TelemetryRuntime,
  before: GameState,
  after: GameState,
  playerId: PlayerId,
  deckId: string,
  policy: BalanceSimulationPolicy,
  action: CardAction,
): void {
  const deckTelemetry = runtime.report.decks[deckId];
  const policyTelemetry = deckTelemetry.policies[policy];

  if (action.kind === "sentinela") {
    policyTelemetry.activations += 1;
    return;
  }

  const handCard = before.players[playerId].hand.find((card) => card.instanceId === action.instanceId);
  if (!handCard) return;
  recordSeen(runtime, deckId, handCard.defId, handCard.instanceId, false);

  policyTelemetry.cardPlays += 1;
  deckTelemetry.cardsPlayed += 1;
  incrementBoth(deckTelemetry, handCard.defId, "played");
  const def = getCard(handCard.defId);
  deckTelemetry.printedCostPlayed += def.cost;
  deckTelemetry.manaSpentOnCardPlays += Math.max(0, before.players[playerId].mana - after.players[playerId].mana);
  deckTelemetry.spellManaSpentOnCardPlays += Math.max(0, before.players[playerId].spellMana - after.players[playerId].spellMana);
}

function recordFinalState(
  runtime: TelemetryRuntime,
  state: GameState,
  playerId: PlayerId,
  deckId: string,
): void {
  const deckTelemetry = runtime.report.decks[deckId];
  const player = state.players[playerId];
  for (const card of player.hand) {
    recordSeen(runtime, deckId, card.defId, card.instanceId, false);
    incrementBoth(deckTelemetry, card.defId, "endHand");
    deckTelemetry.endHandCards += 1;
  }
  deckTelemetry.finalSpellsCast += player.stats.spellsCast;
  deckTelemetry.finalAlliesSummoned += player.stats.alliesSummoned;
  deckTelemetry.finalNexusDamageDealt += player.stats.nexusDamageDealt;
  deckTelemetry.finalHandSize += player.hand.length;
  deckTelemetry.finalBenchSize += player.bench.length;
  deckTelemetry.finalPermanentSize += player.permanents.length;
  deckTelemetry.finalSentinelaSize += player.sentinelas.length;
}

function runSimulationCore(
  deckAId: string,
  deckBId: string,
  games: number,
  seed: number,
  overrides?: Record<string, DeckInput>,
  withTelemetry = false,
  stackAwareReactions = false,
): TelemetrySimulationResult {
  const count=Math.min(Math.max(Math.floor(games),1),5000);const rounds:number[]=[];let winsA=0,winsB=0,draws=0,firstPlayerWins=0,secondPlayerWins=0;
  const a=deck(deckAId, overrides), b=deck(deckBId, overrides);
  const report = createTelemetry(a, b);
  for(let i=0;i<count;i++){
    const matchSeed=(seed+i*7919)&0x7fffffff;const aIsPlayer=i%2===0;
    const playerGoesFirst=Math.floor(i/2)%2===0;
    const playerDeck=aIsPlayer?a:b, opponentDeck=aIsPlayer?b:a;
    let state:GameState=createCustomGame("Balance",playerDeck,opponentDeck,{seed:matchSeed,playerGoesFirst,skipMulligan:true});
    const runtime: TelemetryRuntime = {
      report,
      seenByDeck: {
        [playerDeck.id]: { seen: new Set<string>(), initial: new Set<string>() },
        [opponentDeck.id]: { seen: new Set<string>(), initial: new Set<string>() },
      },
    };
    if (withTelemetry) {
      report.decks[playerDeck.id].games += 1;
      report.decks[opponentDeck.id].games += 1;
      report.decks[playerDeck.id].policies["player-heuristic"].games += 1;
      report.decks[opponentDeck.id].policies["ai-core"].games += 1;
      recordInitialHand(runtime, state, "player", playerDeck.id);
      recordInitialHand(runtime, state, "ai", opponentDeck.id);
    }
    let guard=0;
    while(state.phase!=="gameover"&&guard++<800){
      if(state.phase==="blocking"){state=resolveCombat(state,chooseBlocksSymmetric(state));continue;}
      if(state.activePlayer==="ai"&&state.phase==="main"){
        const before=state;
        const playable = withTelemetry ? observeDecision(runtime,before,"ai",opponentDeck.id,"ai-core") : [];
        const result=stackAwareReactions?playOneForAiStackAwareDetailed(before):playOneForAiDetailed(before);
        state=result.next;
        if(withTelemetry){
          recordDecisionOutcome(runtime,before,state,"ai",opponentDeck.id,"ai-core",result,playable);
          for(const reaction of result.reactions??[]){
            const reactionDeckId=reaction.playerId==="player"?playerDeck.id:opponentDeck.id;
            const reactionPolicy:BalanceSimulationPolicy=reaction.playerId==="player"?"player-heuristic":"ai-core";
            recordReactionOutcome(runtime,before,state,reaction.playerId,reactionDeckId,reactionPolicy,reaction.action);
          }
        }
      }
      else if(state.activePlayer==="player"&&state.phase==="main"){
        const before=state;
        const playable = withTelemetry ? observeDecision(runtime,before,"player",playerDeck.id,"player-heuristic") : [];
        const result=stackAwareReactions
          ? playOneForPlayerStackAwareDetailed(before)
          : withTelemetry
            ? playOneForPlayerDetailed(before)
            : {next:playOneForPlayer(before),kind:"noOp" as DecisionKind};
        state=result.next;
        if(withTelemetry){
          recordDecisionOutcome(runtime,before,state,"player",playerDeck.id,"player-heuristic",result,playable);
          for(const reaction of result.reactions??[]){
            const reactionDeckId=reaction.playerId==="player"?playerDeck.id:opponentDeck.id;
            const reactionPolicy:BalanceSimulationPolicy=reaction.playerId==="player"?"player-heuristic":"ai-core";
            recordReactionOutcome(runtime,before,state,reaction.playerId,reactionDeckId,reactionPolicy,reaction.action);
          }
        }
      }
    }
    // Alternate which deck occupies the human-side heuristic so that policy asymmetry is averaged out.
    if(state.winner==="player"){
      if(aIsPlayer)winsA++;else winsB++;
      if(withTelemetry){report.decks[playerDeck.id].wins+=1;report.decks[opponentDeck.id].losses+=1;}
    }
    else if(state.winner==="ai"){
      if(aIsPlayer)winsB++;else winsA++;
      if(withTelemetry){report.decks[opponentDeck.id].wins+=1;report.decks[playerDeck.id].losses+=1;}
    }
    else {
      draws++;
      if(withTelemetry){report.decks[playerDeck.id].draws+=1;report.decks[opponentDeck.id].draws+=1;}
    }
    if(state.winner){const firstWon=(state.winner==="player"&&playerGoesFirst)||(state.winner==="ai"&&!playerGoesFirst);if(firstWon)firstPlayerWins++;else secondPlayerWins++;}
    if(withTelemetry){recordFinalState(runtime,state,"player",playerDeck.id);recordFinalState(runtime,state,"ai",opponentDeck.id);}
    rounds.push(state.round);
  }
  const sorted=[...rounds].sort((a,b)=>a-b),average=rounds.reduce((a,b)=>a+b,0)/Math.max(rounds.length,1);
  const decisive=Math.max(winsA+winsB,1), firstDecisive=Math.max(firstPlayerWins+secondPlayerWins,1);
  const summary={deckA:deckAId,deckB:deckBId,requestedGames:count,completedGames:rounds.length,winsA,winsB,draws,avgRounds:Math.round(average),winRateA:Math.round(winsA/decisive*1000)/10,winRateB:Math.round(winsB/decisive*1000)/10,firstPlayerWins,secondPlayerWins,firstPlayerWinRate:Math.round(firstPlayerWins/firstDecisive*1000)/10,winRateA95:wilson95(winsA,decisive),seed,engineVersion:ENGINE_VERSION,rulesetVersion:RULESET_VERSION,roundDistribution:{min:sorted[0]??0,max:sorted.at(-1)??0,median:sorted[Math.floor(sorted.length/2)]??0}};
  return {summary,telemetry:report};
}

/** Historical balance API. Telemetry is opt-in so Ranked and existing audits retain the exact public contract. */
export function runBalanceSimulation(deckAId: string, deckBId: string, games: number, seed: number, overrides?: Record<string, DeckInput>): SimulationSummary {
  return runSimulationCore(deckAId,deckBId,games,seed,overrides,false,false).summary;
}

/** Runs the same historical deterministic simulation while collecting read-only utilization observations. */
export function runBalanceSimulationWithTelemetry(
  deckAId: string,
  deckBId: string,
  games: number,
  seed: number,
  overrides?: Record<string, DeckInput>,
): TelemetrySimulationResult {
  return runSimulationCore(deckAId,deckBId,games,seed,overrides,true,false);
}

/**
 * Opt-in stack-aware balance mode. Proactive hand actions travel through the
 * certified reaction stack so Traps, counters and reaction abilities can
 * participate without changing the historical simulator contract.
 */
export function runStackAwareBalanceSimulation(
  deckAId: string,
  deckBId: string,
  games: number,
  seed: number,
  overrides?: Record<string, DeckInput>,
): SimulationSummary {
  return runSimulationCore(deckAId,deckBId,games,seed,overrides,false,true).summary;
}

/** Stack-aware simulation with the same read-only telemetry contract. */
export function runStackAwareBalanceSimulationWithTelemetry(
  deckAId: string,
  deckBId: string,
  games: number,
  seed: number,
  overrides?: Record<string, DeckInput>,
): TelemetrySimulationResult {
  return runSimulationCore(deckAId,deckBId,games,seed,overrides,true,true);
}
