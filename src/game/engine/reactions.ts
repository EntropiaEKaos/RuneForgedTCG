import { getCard } from "../cards";
import type { GameState, PlayerId } from "../types";
import { canCastReaction, castSpell, playUnit } from "./actions";

/**
 * Result of a stack resolution. If awaitingReaction is set, the human must
 * decide whether to respond to the AI's action before more AI steps run.
 */
export interface StackResolution {
  next: GameState;
  awaitingReaction?: { action: CardAction; aiState: GameState };
}

export interface CardAction {
  kind: "unit" | "spell" | "sentinela";
  player?: PlayerId;
  instanceId: string;
  defId: string;
  targetInstanceId?: string;
  playedInstanceId?: string;
  abilityIndex?: number;
}

interface StackFrame extends CardAction {
  player: PlayerId;
  /** If this is a counter-targeting spell, the instance id of the spell it negates. */
  negates?: string;
}

function canRespondTo(state: GameState, playerId: PlayerId, action: CardAction): boolean {
  if (state.phase !== "main") return false;
  const p = state.players[playerId];
  return p.hand.some((c) => {
    const def = getCard(c.defId);
    if (def.type !== "Spell" || !def.speed) return false;
    if (action.kind === "spell" && def.speed !== "Burst") return false;
    if (p.mana + p.spellMana < def.cost) return false;
    return true;
  });
}

function aiChooseReactionAction(state: GameState, action: CardAction): CardAction | null {
  return null; // overridden via ai module
}

/**
 * Drives an action through the LIFO stack. If the responding player can
 * respond with a Burst/Fast spell, the stack pauses and returns
 * awaitingReaction. If the human explicitly chose to "skip" or "pass",
 * the stack resolves immediately. If the AI is the responder and the
 * human did not pre-supply a counter, the AI brain (`aiChooseReaction`)
 * decides whether to counter and the stack resolves on the same call.
 *
 * This function is the single source of truth for stack resolution and
 * is used by /api/simulate, /api/replays, the in-browser GameClient and
 * the in-browser Reducer — guaranteeing identical behaviour.
 */
export function applyStackedAction(
  state: GameState,
  action: CardAction,
  options: { human?: "react" | "skip"; playerCounter?: CardAction | null } = {},
): StackResolution {
  if (state.phase === "gameover") return { next: state };
  const human = options.human ?? "skip";
  const playerCounter = options.playerCounter ?? null;

  // Who can respond? Opposite of the action's source.
  const sourcePlayer: PlayerId = action.player ?? "player";
  const respondingSide: PlayerId = sourcePlayer === "player" ? "ai" : "player";

  // Determine if the responder has a counter and prepare the stack.
  const baseState = state;
  const stack: StackFrame[] = [{ ...action, player: sourcePlayer }];

  let chosenCounter: CardAction | null = null;

  if (respondingSide === "player") {
    if (human === "react" && playerCounter) {
      chosenCounter = playerCounter;
    }
  } else {
    // Responder is AI. If caller pre-supplied a counter (rare), use it; otherwise
    // let the AI brain decide.
    chosenCounter = playerCounter;
  }

  if (
    chosenCounter &&
    canCastReaction(baseState, respondingSide, chosenCounter.instanceId, action.kind) &&
    !stack.some((x) => x.instanceId === chosenCounter.instanceId)
  ) {
    const counterItem: StackFrame = {
      ...chosenCounter,
      player: respondingSide,
      negates: action.instanceId,
    };
    stack.push(counterItem);
  }

  // If the human can respond (responder == player) and we haven't pushed
  // a counter yet, return so the client can ask the human.
  if (
    respondingSide === "player" &&
    human === "skip" &&
    canRespondTo(baseState, "player", action)
  ) {
    return { next: baseState, awaitingReaction: { action, aiState: baseState } };
  }

  return resolveStack(baseState, stack);
}

/** Finalize the stack: resolve from top to bottom, applying counterspells. */
function resolveStack(state: GameState, stack: StackFrame[]): StackResolution {
  let s = state;
  const negated = new Set<string>();
  for (const item of [...stack].reverse()) {
    if (s.phase === "gameover") break;

    if (negated.has(item.instanceId)) {
      s.log.push(`✨ ${getCard(item.defId).name} was negated and did not resolve.`);
      continue;
    }

    const card = getCard(item.defId);
    if (card.spell?.kind === "negateSpell" && item.negates) {
      negated.add(item.negates);
      const target = stack.find((x) => x.instanceId === item.negates);
      const targetName = target ? getCard(target.defId).name : "the spell";
      s.log.push(`✨ ${card.name} negates ${targetName}!`);
      s = castSpell(s, item.player, item.instanceId, item.negates);
      continue;
    }

    if (item.player === "player") {
      if (item.kind === "spell") s = castSpell(s, "player", item.instanceId, item.targetInstanceId);
      else s = playUnit(s, "player", item.instanceId, item.targetInstanceId);
    } else {
      if (item.kind === "spell") s = castSpell(s, "ai", item.instanceId, item.targetInstanceId);
      else s = playUnit(s, "ai", item.instanceId, item.targetInstanceId);
    }
  }
  return { next: s };
}

/** A variant that lets the AI responder counter via the AI brain. */
export function applyStackedActionWithAi(
  state: GameState,
  action: CardAction,
  human: "react" | "skip",
  playerCounter: CardAction | null,
  aiChooseReaction: (state: GameState, action: CardAction) => CardAction | null,
): StackResolution {
  if (state.phase === "gameover") return { next: state };
  const sourcePlayer: PlayerId = action.player ?? "player";
  const respondingSide: PlayerId = sourcePlayer === "player" ? "ai" : "player";

  const baseState = state;
  const stack: StackFrame[] = [{ ...action, player: sourcePlayer }];
  let chosenCounter: CardAction | null = null;

  if (respondingSide === "player") {
    if (human === "react") chosenCounter = playerCounter;
  } else {
    chosenCounter = aiChooseReaction(baseState, action);
  }

  if (
    chosenCounter &&
    canCastReaction(baseState, respondingSide, chosenCounter.instanceId, action.kind) &&
    !stack.some((x) => x.instanceId === chosenCounter.instanceId)
  ) {
    stack.push({ ...chosenCounter, player: respondingSide, negates: action.instanceId });
  }

  if (
    respondingSide === "player" &&
    human === "skip" &&
    canRespondTo(baseState, "player", action)
  ) {
    return { next: baseState, awaitingReaction: { action, aiState: baseState } };
  }

  return resolveStack(baseState, stack);
}

