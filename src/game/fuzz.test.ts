/** Lightweight property/fuzz gate: random deterministic seeds must preserve engine invariants.
 *
 * Drives BOTH sides of the match through the real production AI brain
 * (aiChooseAction/applyAiAction/aiResolveTurnEnd from ai.ts), now that those
 * functions are parameterized by playerId instead of being hardcoded to
 * "ai". This is what actually exercises the AI code path players face in
 * real games — a hand-rolled bot here would hide production bugs (as it did
 * before: this file previously drove the "player" side with its own
 * separate playerBotTurn() implementation, which made the fuzz gate pass
 * without ever calling aiChooseAction/applyAiAction for that side).
 */
import { DECKS } from "./decks";
import { createGame, resolveCombat, skipMulligan } from "./engine";
import { assertGameStateInvariant } from "./invariants";
import { aiChooseBlocks, aiChooseAction, applyAiAction, aiResolveTurnEnd } from "./ai";
import type { PlayerId } from "./types";

const runs = Number(process.env.FUZZ_RUNS || 50);
// Control mirrors and the interaction-heavy 2.54 starters can legitimately
// consume more decisions than the old 700-action budget without stalling.
const maxDecisions = Number(process.env.FUZZ_MAX_DECISIONS || 1400);
let completed = 0;
for (let i = 0; i < runs; i++) {
  const a = DECKS[i % DECKS.length];
  const b = DECKS[(i * 3 + 1) % DECKS.length];
  let state = createGame("FuzzA", { id: a.id, name: a.name, cards: a.cards }, { id: b.id, name: b.name, cards: b.cards }, i % 2 === 0, i + 1);
  assertGameStateInvariant(state);
  state = skipMulligan(state, "player");
  let guard = 0;
  let lastAction: unknown = null;
  while (state.phase !== "gameover" && guard++ < maxDecisions) {
    if (state.phase === "blocking" && state.combat) {
      const defenderId: PlayerId = state.combat.attackerId === "player" ? "ai" : "player";
      state = resolveCombat(state, aiChooseBlocks(state, defenderId));
      assertGameStateInvariant(state);
    } else if (state.phase === "main") {
      const pid = state.activePlayer;
      const action = aiChooseAction(state, pid);
      lastAction = action;
      state = action ? applyAiAction(state, action, pid) : aiResolveTurnEnd(state, pid);
      assertGameStateInvariant(state);
    } else break;
  }
  if (state.phase !== "gameover") {
    const diagnostic = {
      round: state.round,
      phase: state.phase,
      activePlayer: state.activePlayer,
      player: { nexus: state.players.player.nexusHealth, hand: state.players.player.hand.length, deck: state.players.player.deck.length, bench: state.players.player.bench.length },
      ai: { nexus: state.players.ai.nexusHealth, hand: state.players.ai.hand.length, deck: state.players.ai.deck.length, bench: state.players.ai.bench.length },
      lastAction,
    };
    throw new Error(`Fuzz run ${i} did not terminate (seed=${i + 1}, decisions=${maxDecisions}): ${JSON.stringify(diagnostic)}`);
  }
  completed++;
}
console.log(`✅ Fuzz gate passed: ${completed}/${runs} deterministic games`);
