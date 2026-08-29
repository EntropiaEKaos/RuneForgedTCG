import {
  aiChooseAction,
  aiChooseBlocks,
  aiChooseReaction,
  aiDefend,
  aiResolveTurnEnd,
  applyAiAction,
} from "./ai";
import {
  activateSentinelaAbility,
  applyStackedActionWithAi,
  canBlock,
  canCastReaction,
  canDeclareAttack,
  canPlayCard,
  castSpell,
  createGame,
  declareAttack,
  endTurn,
  playUnit,
  resolveCombat,
  mulligan,
  skipMulligan,
} from "./engine";
import { getCard } from "./cards";
import type {
  CardInstance,
  DeckInput,
  GameState,
  PlayerId,
  TargetKind,
  UnitInstance,
  PermanentInstance,
} from "./types";
import { runtimeActionAllowed } from "./runtime-config";
import { aiRulesFor, engineRulesFor } from "./match-rules";

/**
 * A single immutable transition in the game. This is the authoritative action
 * log: replaying the same sequence against the same seed reproduces the game.
 *
 * Human actions come from the client UI. AI actions are discovered server-side
 * via the AI brain. Both are reduced through `applyGameAction`.
 */
export type GameAction =
  // ---- player human actions ----
  | { type: "play"; player: PlayerId; instanceId: string; target?: string }
  | { type: "cast"; player: PlayerId; instanceId: string; target?: string }
  | { type: "attack"; player: PlayerId; attackerIds: string[]; challenges?: Record<string, string>; sentinelaTargets?: Record<string, string> }
  | { type: "block"; blocks: Record<string, string> }
  | { type: "pass"; player: PlayerId }
  | { type: "react"; player: PlayerId; instanceId: string; target?: string }
  | { type: "resolve" } // resolve the open reaction window
  | { type: "sentinela"; player: PlayerId; sentinelaId: string; abilityIndex: number; target?: string }
  | { type: "mulligan"; player: PlayerId; cardIds: string[] }
  | { type: "skipMulligan"; player: PlayerId }
  // ---- AI transitions which may embed a reaction window ----
  | { type: "aiStep" };

export interface ActionResult {
  next: GameState;
  /** Pending reaction window the human must resolve before more AI steps. */
  awaitingReaction?: { action: CardAction; aiState: GameState };
}

import type { CardAction } from "./engine";

function findTarget(state: GameState, playerId: PlayerId, target: string) {
  const u = findUnit(state, target);
  if (u) return { kind: "unit" as const, ...u };
  const p = findPermanent(state, target);
  if (p) return { kind: "permanent" as const, ...p };
  return null;
}

function findUnit(state: GameState, instanceId: string): { unit: UnitInstance; owner: PlayerId } | null {
  for (const pid of ["player", "ai"] as PlayerId[]) {
    const u = state.players[pid].bench.find((x) => x.instanceId === instanceId);
    if (u) return { unit: u, owner: pid };
  }
  return null;
}

function findPermanent(
  state: GameState,
  instanceId: string,
): { perm: PermanentInstance; owner: PlayerId } | null {
  for (const pid of ["player", "ai"] as PlayerId[]) {
    const p = state.players[pid].permanents.find((x) => x.instanceId === instanceId);
    if (p) return { perm: p, owner: pid };
  }
  return null;
}

function actionReactable(state: GameState, action: CardAction): boolean {
  return state.players.player.hand.some((c) =>
    canCastReaction(state, "player", c.instanceId, action.kind),
  );
}

function runAiWithReaction(state: GameState, action: CardAction, maxSteps: number): GameState {
  // Apply the AI's chosen action first, then let it chain further reactions
  // to ITS OWN follow-up plays if any exist (rare, but keeps parity with the
  // AI-vs-AI simulate path). Previously this only ever called
  // aiChooseReaction(state, action) and applied the *reaction*, never the
  // original `action` — meaning the AI silently skipped its turn whenever
  // the human held no matching Burst-speed card to react with (the common
  // case). See runAiMain below for where this is invoked.
  let s = applyAiAction(state, action);
  for (let i = 0; i < maxSteps; i++) {
    if (s.phase === "gameover") return s;
    const react = aiChooseReaction(s, action);
    if (!react) break;
    s = applyAiAction(s, react);
  }
  return s;
}

function runAiMain(state: GameState, maxSteps: number): ActionResult {
  let s = state;
  for (let i = 0; i < maxSteps; i++) {
    if (s.phase === "gameover") return { next: s };
    if (s.phase !== "main" || s.activePlayer !== "ai") break;

    const action = aiChooseAction(s);
    if (!action) {
      // AI done playing — attack or end turn.
      const s2 = aiResolveTurnEnd(s);
      return { next: s2 };
    }

    if (actionReactable(s, action)) {
      return { next: s, awaitingReaction: { action: { ...action, player: "ai" }, aiState: s } };
    }
    s = runAiWithReaction(s, action, Math.max(1, aiRulesFor(s).reactionDepth));
  }
  return { next: s };
}

/**
 * Applies one authoritative action. Mutates the AI forward as far as the
 * human, optionally pausing on a reaction window.
 *
 * `opponentIsBot` controls whether the non-acting side is real AI logic
 * (`aiChooseReaction`) or a live human (PvP). It must be `false` for PvP —
 * otherwise the bot's heuristics would silently cast cards out of a real
 * opponent's hand on their behalf. It defaults to `true`, matching the
 * PvE/ranked path (see authoritative.ts), which is the only place a genuine
 * AI opponent exists.
 */
export function applyGameAction(state: GameState, action: GameAction, opponentIsBot: boolean = true): ActionResult {
  if (state.phase === "gameover") {
    return { next: state };
  }
  const runtime = engineRulesFor(state);
  if (runtime.runtimeOverridesEnabled && !runtime.phaseSequence.includes(state.phase)) return { next: state };
  if (!runtimeActionAllowed(action.type, runtime)) return { next: state };

  switch (action.type) {
    case "play": {
      const p = state.players[action.player];
      const inst = p.hand.find((c) => c.instanceId === action.instanceId);
      if (!inst) return { next: state };
      const card = getCard(inst.defId);

      if (card.type === "Spell") {
        if (action.player === "player" && opponentIsBot) {
          const cardAction: CardAction = {
            kind: "spell",
            instanceId: action.instanceId,
            defId: inst.defId,
            targetInstanceId: action.target,
          };
          // IMPORTANT: resolve through the LIFO stack BEFORE the spell is
          // applied to the board — this is what lets the AI's counterspell
          // actually negate it, instead of "reacting" to something that
          // already happened (the bug this fix addresses).
          return { next: applyStackedActionWithAi(state, cardAction, "skip", null, aiChooseReaction).next };
        }
        return { next: castSpell(state, action.player, action.instanceId, action.target) };
      }

      const cardAction: CardAction = {
        kind: card.type === "Equipment" ? "unit" : "unit",
        instanceId: action.instanceId,
        defId: inst.defId,
        targetInstanceId: action.target,
      };
      if (action.player === "player" && opponentIsBot) {
        return { next: applyStackedActionWithAi(state, cardAction, "skip", null, aiChooseReaction).next };
      }
      return { next: playUnit(state, action.player, action.instanceId, action.target) };
    }

    case "cast": {
      const inst = state.players[action.player].hand.find(
        (c) => c.instanceId === action.instanceId,
      );
      // Unlike "play" (which already no-ops on a missing hand card), this
      // branch used to fall back to a literal "unknown" defId and proceed
      // anyway — getCard("unknown") then throws, uncaught, turning a bogus
      // or stale instanceId (trivially reachable via PvP, since
      // validateGameAction only checks turn/phase/ownership for "cast", not
      // that the card is actually in hand) into a raw 500 instead of a
      // clean rejection. Mirror "play"'s guard instead.
      if (!inst) return { next: state };
      if (action.player === "player" && opponentIsBot) {
        const cardAction: CardAction = {
          kind: "spell",
          instanceId: action.instanceId,
          defId: inst.defId,
          targetInstanceId: action.target,
        };
        return { next: applyStackedActionWithAi(state, cardAction, "skip", null, aiChooseReaction).next };
      }
      return { next: castSpell(state, action.player, action.instanceId, action.target) };
    }

    case "attack": {
      const s = declareAttack(state, action.player, action.attackerIds, action.challenges, action.sentinelaTargets);
      if (opponentIsBot && s.phase === "blocking" && s.combat?.attackerId === "player") {
        // Only PvE lets the server assign AI blockers. PvP must expose the
        // blocking phase to the human defender and wait for an explicit block action.
        const blocked = aiDefend(s);
        return { next: blocked };
      }
      return { next: s };
    }

    case "block": {
      const locked = state.combat?.blocks ?? {};
      return { next: resolveCombat(state, { ...locked, ...action.blocks }) };
    }

    case "pass": {
      return { next: endTurn(state, action.player) };
    }

    case "react": {
      // Applies the pending human reaction spell, then lets it resolve.
      // The reaction window is cancelled by the client calling applying the
      // human spell then the AI action. Simpler here: cast the spell now.
      // (Implementation mirrors the single-step reaction applied by UI.)
      const opened = state.players[action.player].hand.find((c) => c.instanceId === action.instanceId);
      if (!opened) return { next: state };
      const s = castSpell(state, action.player, action.instanceId, action.target);
      return { next: s };
    }

    case "resolve": {
      // Let the current AI action resolve through the reaction window.
      return runAiWithReactionStartingFrom(state, action);
    }

    case "sentinela": {
      return { next: activateSentinelaAbility(state, action.player, action.sentinelaId, action.abilityIndex, action.target) };
    }

    case "mulligan": {
      return { next: mulligan(state, action.player, action.cardIds) };
    }

    case "skipMulligan": {
      return { next: skipMulligan(state, action.player) };
    }

    case "aiStep": {
      return runAiMain(state, 40);
    }
  }
}

function runAiWithReactionStartingFrom(state: GameState, action: GameAction): ActionResult {
  // The reaction window isn't stored in GameState; it's a UI concept. The
  // server simulation instead asks the AI to choose an action; if reactable,
  // it exposes awaitingReaction. For "resolve", we just continue the AI main.
  return runAiMain(state, 40);
}

/** Driver for headless/server simulation: step until gameover, pausing on reactions. */
export function simulateMatch(
  playerName: string,
  playerDeck: DeckInput,
  aiDeck: DeckInput,
  playerFirst: boolean,
  maxSteps = 500,
): { final: GameState; aiMoves: number } {
  let s: GameState = createGame(playerName, playerDeck, aiDeck, playerFirst, 1);
  s = skipMulligan(s, "player");
  s = skipMulligan(s, "ai");
  let aiMoves = 0;
  // Drive both parameterized AI sides. The previous implementation only ran
  // runAiMain(), which intentionally accepts turns owned by "ai"; whenever
  // priority passed to "player" it repeatedly called aiResolveTurnEnd for the
  // wrong side and remained forever in round one.
  for (let i = 0; i < maxSteps; i++) {
    if (s.phase === "gameover") break;
    if (s.phase === "blocking") {
      const defender = s.combat?.attackerId === "player" ? "ai" : "player";
      s = resolveCombat(s, aiChooseBlocks(s, defender));
      continue;
    }
    if (s.phase !== "main") continue;
    const side = s.activePlayer;
    const action = aiChooseAction(s, side);
    if (!action) {
      s = aiResolveTurnEnd(s, side);
      continue;
    }
    const next = applyAiAction(s, action, side);
    aiMoves++;
    s = next === s ? aiResolveTurnEnd(s, side) : next;
  }
  return { final: s, aiMoves };
}
