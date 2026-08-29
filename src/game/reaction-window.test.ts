import { aiChooseReaction } from "./ai";
import { replayAuthoritativeMatch } from "./authoritative";
import { applyStackedActionWithAi, createCustomGame } from "./engine";
import { applyGameAction } from "./reducer";
import type { DeckInput } from "./types";

const deck: DeckInput = {
  id: "reaction-regression",
  name: "Reaction regression",
  cards: Array(20).fill("ember_whelp"),
};

let state = createCustomGame("Reaction Tester", deck, deck, {
  skipMulligan: true,
  playerGoesFirst: false,
  playerBench: ["wood_ent"],
  playerStartingHand: 0,
  aiStartingHand: 0,
  playerStartingMana: 10,
  aiStartingMana: 10,
  seed: 424242,
});

state.phase = "main";
state.activePlayer = "ai";
state.players.player.mana = 10;
state.players.player.maxMana = 10;
state.players.player.hand = [{ instanceId: "player-deny", defId: "tide_deny" }];
state.players.ai.mana = 10;
state.players.ai.maxMana = 10;
state.players.ai.hand = [{ instanceId: "ai-bolt", defId: "ember_bolt" }];

const opened = applyGameAction(state, { type: "aiStep" });
if (!opened.awaitingReaction) {
  throw new Error("AI spell should open a human reaction window when Tide Deny is available");
}
if (opened.awaitingReaction.action.player !== "ai") {
  throw new Error(`AI reaction action lost ownership: ${String(opened.awaitingReaction.action.player)}`);
}
if (opened.awaitingReaction.action.instanceId !== "ai-bolt") {
  throw new Error(`Unexpected AI action opened the reaction window: ${opened.awaitingReaction.action.instanceId}`);
}

const resolved = applyStackedActionWithAi(
  opened.next,
  opened.awaitingReaction.action,
  "skip",
  null,
  aiChooseReaction,
);

if (resolved.awaitingReaction) {
  throw new Error("Explicit human skip must resolve the AI action, not reopen the same reaction window");
}
if (resolved.next.players.ai.hand.some((card) => card.instanceId === "ai-bolt")) {
  throw new Error("AI spell remained in hand after the human explicitly skipped the reaction");
}
if (resolved.next === opened.next) {
  throw new Error("Resolving the skipped reaction must advance the authoritative game state");
}

// Replay parity regression: after a human resolves an AI reaction window, the
// authoritative replay must continue server-derived AI decisions before it
// consumes the next client action. This deterministic scenario crosses a round
// boundary, where the AI draws a second Bolt and opens one more reaction window
// before using its attack token. Only after both resolves is `block` legal.
const playerReactionDeck: DeckInput = {
  id: "reaction-player",
  name: "Reaction player",
  cards: Array(20).fill("tide_deny"),
};
const aiReactionDeck: DeckInput = {
  id: "reaction-ai",
  name: "Reaction AI",
  cards: Array(20).fill("ember_bolt"),
};

const replay = replayAuthoritativeMatch({
  playerName: "Replay Reaction Tester",
  playerDeck: playerReactionDeck,
  aiDeck: aiReactionDeck,
  playerGoesFirst: true,
  seed: 515151,
  actions: [
    { type: "pass", player: "player" },
    { type: "resolve" },
    { type: "resolve" },
    { type: "block", blocks: {} },
  ],
  customOptions: {
    skipMulligan: true,
    playerStartingHand: 1,
    aiStartingHand: 1,
    playerStartingMana: 10,
    aiStartingMana: 10,
    playerBench: ["wood_ent"],
    aiBench: ["ember_whelp"],
  },
});

if (replay.applied !== 4) {
  throw new Error(`Replay did not consume pass -> resolve -> resolve -> block sequence: ${replay.applied}`);
}
if (replay.state.phase === "blocking") {
  throw new Error("Replay remained stuck in blocking after the recorded human block decision");
}

console.log("Reaction-window regression tests passed.");
