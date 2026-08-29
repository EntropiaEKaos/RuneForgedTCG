import { aiChooseReaction } from "./ai";
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
  playerBench: ["ember_drake"],
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

console.log("Reaction-window regression tests passed.");
