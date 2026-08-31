import { getCard } from "../cards";
import { canCounterPendingAction, canReactWithResponse, hasReactionOpportunity } from "../reaction-contract";
import { resolveReactionActivatedAbility, type ReactionActivatedAbilityAction } from "../reaction-activated-abilities";
import type { GameState, PlayerId } from "../types";
import { castSpell, effectiveCost, playUnit } from "./actions";

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
  /** Pending stack frame this card counter attempts to prevent from resolving. */
  negates?: string;
  /** Pending action that opened a battlefield reaction ability. */
  respondsTo?: string;
}

function canRespondTo(state: GameState, playerId: PlayerId, action: CardAction): boolean {
  return hasReactionOpportunity(state, playerId, action);
}

/**
 * A counter prevents resolution; it does not rewind the fact that the target
 * card was committed to the stack. RuneForge has no graveyard zone yet, so the
 * authoritative equivalent is to consume the card from hand and pay its cast
 * cost without applying any summon/play/spell effects.
 */
function consumeNegatedCard(state: GameState, item: StackFrame): void {
  // Battlefield abilities are not hand cards and therefore have nothing to
  // consume from hand if a future nested reaction negates their stack frame.
  if (item.responseKind === "activatedAbility") return;
  const player = state.players[item.player];
  const instance = player.hand.find((card) => card.instanceId === item.instanceId);
  if (!instance) return;

  const def = getCard(instance.defId);
  const cost = effectiveCost(state, item.player, def);
  const usesSpellMana = def.type !== "Unit" && def.type !== "Sentinela";

  if (usesSpellMana) {
    const regularMana = Math.min(player.mana, cost);
    player.mana -= regularMana;
    player.spellMana = Math.max(0, player.spellMana - (cost - regularMana));
    player.stats.spellsCast += 1;
  } else {
    player.mana = Math.max(0, player.mana - cost);
  }
  player.hand = player.hand.filter((card) => card.instanceId !== item.instanceId);
}

function pushLegalResponse(
  stack: StackFrame[],
  baseState: GameState,
  respondingSide: PlayerId,
  chosenResponse: CardAction | null,
  pendingAction: CardAction,
): void {
  if (!chosenResponse || stack.some((frame) => frame.instanceId === chosenResponse.instanceId)) return;
  const normalized: CardAction = { ...chosenResponse, player: respondingSide };
  if (!canReactWithResponse(baseState, respondingSide, normalized, pendingAction)) return;

  stack.push({
    ...normalized,
    player: respondingSide,
    respondsTo: pendingAction.instanceId,
    ...(normalized.responseKind === "activatedAbility" ? {} : { negates: pendingAction.instanceId }),
  });
}

/**
 * Drives an action through the LIFO stack. If the responding player has a
 * legal reaction, the stack pauses and returns awaitingReaction. If the human
 * explicitly chose to "skip" or "pass", the stack resolves immediately. If
 * the AI is the responder and the human did not pre-supply a response, the AI
 * brain decides whether to react and the stack resolves on the same call.
 *
 * Reaction eligibility is authoritative in reaction-contract.ts: the exact
 * same card/ability target and resource contract gates both opening the window
 * and inserting the chosen response into the stack.
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

  const sourcePlayer: PlayerId = action.player ?? "player";
  const respondingSide: PlayerId = sourcePlayer === "player" ? "ai" : "player";
  const baseState = state;
  const stack: StackFrame[] = [{ ...action, player: sourcePlayer }];

  let chosenCounter: CardAction | null = null;
  if (respondingSide === "player") {
    if (human === "react" && playerCounter) chosenCounter = playerCounter;
  } else {
    chosenCounter = playerCounter;
  }
  pushLegalResponse(stack, baseState, respondingSide, chosenCounter, action);

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
      consumeNegatedCard(s, item);
      const name = item.responseKind === "activatedAbility"
        ? getCard(item.defId).name
        : getCard(item.defId).name;
      s.log.push(`✨ ${name} was negated and did not resolve.`);
      continue;
    }

    if (item.responseKind === "activatedAbility") {
      const pending = item.respondsTo ? stack.find((frame) => frame.instanceId === item.respondsTo) : undefined;
      if (!pending || item.abilityIndex === undefined) continue;
      const abilityAction: ReactionActivatedAbilityAction = {
        kind: "sentinela",
        responseKind: "activatedAbility",
        player: item.player,
        instanceId: item.instanceId,
        defId: item.defId,
        abilityIndex: item.abilityIndex,
        ...(item.targetInstanceId ? { targetInstanceId: item.targetInstanceId } : {}),
        ...(item.modeId ? { modeId: item.modeId } : {}),
        ...(item.costDiscardInstanceIds ? { costDiscardInstanceIds: item.costDiscardInstanceIds } : {}),
      };
      const resolved = resolveReactionActivatedAbility(s, item.player, abilityAction, pending);
      s = resolved.next;
      if (resolved.negatesPending) negated.add(pending.instanceId);
      continue;
    }

    const card = getCard(item.defId);
    if (card.spell?.kind === "negateSpell" && item.negates) {
      const target = stack.find((frame) => frame.instanceId === item.negates);
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

/** A variant that lets the AI responder choose a card or battlefield reaction. */
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
  pushLegalResponse(stack, baseState, respondingSide, chosenCounter, action);

  // `human` is required in this variant, so "skip" is always an explicit
  // decision. Never turn it back into another awaitingReaction window.
  return resolveStack(baseState, stack);
}
