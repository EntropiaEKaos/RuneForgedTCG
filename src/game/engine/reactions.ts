import { getCard } from "../cards";
import { canCounterPendingAction, canReactWithCard, hasReactionOpportunity } from "../reaction-contract";
import type { GameState, PlayerId } from "../types";
import { castSpell, playUnit } from "./actions";

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
  /** Pending stack frame this counter attempts to prevent from resolving. */
  negates?: string;
}

function canRespondTo(state: GameState, playerId: PlayerId, action: CardAction): boolean {
  return hasReactionOpportunity(state, playerId, action);
}

function aiChooseReactionAction(state: GameState, action: CardAction): CardAction | null {
  return null; // overridden via ai module
}

/**
 * Drives an action through the LIFO stack. If the responding player has a
 * legal reaction, the stack pauses and returns awaitingReaction. If the human
 * explicitly chose to "skip" or "pass", the stack resolves immediately. If
 * the AI is the responder and the human did not pre-supply a counter, the AI
 * brain (`aiChooseReaction`) decides whether to react and the stack resolves
 * on the same call.
 *
 * Reaction eligibility is authoritative in reaction-contract.ts: the exact
 * same speed/mana/target contract gates both opening the window and inserting
 * the chosen response into the stack.
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
  const humanDecisionPending = options.human === undefined;
  const human = options.human ?? "skip";
  const playerCounter = options.playerCounter ?? null;

  // Who can respond? Opposite of the action's source.
  const sourcePlayer: PlayerId = action.player ?? "player";
  const respondingSide: PlayerId = sourcePlayer === "player" ? "ai" : "player";

  // Determine if the responder has a legal reaction and prepare the stack.
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
    canReactWithCard(baseState, respondingSide, chosenCounter.instanceId, action) &&
    !stack.some((x) => x.instanceId === chosenCounter.instanceId)
  ) {
    const counterItem: StackFrame = {
      ...chosenCounter,
      player: respondingSide,
      negates: action.instanceId,
    };
    stack.push(counterItem);
  }

  // Omitting a human decision means "pause and ask". An explicit "skip" is
  // a real player choice and must resolve the base action instead of reopening
  // the same reaction window forever.
  if (
    respondingSide === "player" &&
    humanDecisionPending &&
    canRespondTo(baseState, "player", action)
  ) {
    return { next: baseState, awaitingReaction: { action, aiState: baseState } };
  }

  return resolveStack(baseState, stack);
}

/** Finalize the stack: resolve from top to bottom, applying counters. */
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
      const target = stack.find((x) => x.instanceId === item.negates);
      if (target && canCounterPendingAction(card, target)) {
        negated.add(item.negates);
        const targetName = getCard(target.defId).name;
        s.log.push(`✨ ${card.name} negates ${targetName}!`);
        // Secondary effects (`also`) resolve only after the counter succeeded.
        s = castSpell(s, item.player, item.instanceId, item.negates);
      }
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
    canReactWithCard(baseState, respondingSide, chosenCounter.instanceId, action) &&
    !stack.some((x) => x.instanceId === chosenCounter.instanceId)
  ) {
    stack.push({ ...chosenCounter, player: respondingSide, negates: action.instanceId });
  }

  // `human` is required in this variant, so "skip" is always an explicit
  // decision. Never turn it back into another awaitingReaction window.
  return resolveStack(baseState, stack);
}
