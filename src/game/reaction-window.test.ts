import { aiChooseAction, aiChooseReaction } from "./ai";
import { replayAuthoritativeMatch } from "./authoritative";
import {
  applyStackedActionWithAi,
  canReactWithCard,
  createCustomGame,
  eligibleReactionCards,
  reactionEligibility,
} from "./engine";
import { applyGameAction } from "./reducer";
import type { DeckInput } from "./types";

const deck: DeckInput = {
  id: "reaction-regression",
  name: "Reaction regression",
  cards: Array(20).fill("ember_whelp"),
};

// Ability System 2.0 contract: reaction windows are opened by legal responses,
// not merely by the presence of an affordable Fast/Burst spell in hand.
const contractState = createCustomGame("Reaction Contract", deck, deck, {
  skipMulligan: true,
  playerGoesFirst: false,
  playerBench: ["wood_ent"],
  playerStartingHand: 0,
  aiStartingHand: 0,
  playerStartingMana: 10,
  aiStartingMana: 10,
  seed: 202020,
});
contractState.phase = "main";
contractState.activePlayer = "ai";
contractState.players.player.mana = 10;
contractState.players.player.maxMana = 10;
contractState.players.player.hand = [
  { instanceId: "contract-deny", defId: "tide_deny" },
  { instanceId: "contract-shield", defId: "tide_shield" },
  { instanceId: "contract-dispel", defId: "tide_dispel" },
];

if (canReactWithCard(contractState, "player", "contract-deny", "unit")) {
  throw new Error("Deny must not open a reaction window for a unit action");
}
if (reactionEligibility(contractState, "player", "contract-deny", "unit").reason !== "stack-target-mismatch") {
  throw new Error("Deny unit mismatch must be explained by the canonical stack-target contract");
}
if (!canReactWithCard(contractState, "player", "contract-deny", "spell")) {
  throw new Error("Deny must remain a legal response to a spell action");
}
if (!canReactWithCard(contractState, "player", "contract-shield", "spell")) {
  throw new Error("Burst Barrier must remain a legal response while an allied unit is targetable");
}
if (canReactWithCard(contractState, "player", "contract-dispel", "unit")) {
  throw new Error("Disenchant must not open a reaction window when no enemy permanent exists");
}
if (reactionEligibility(contractState, "player", "contract-dispel", "unit").reason !== "no-legal-target") {
  throw new Error("Targetless Disenchant opportunity must fail through the canonical target gate");
}
const unitReactionIds = eligibleReactionCards(contractState, "player", "unit").map((card) => card.instanceId);
if (!unitReactionIds.includes("contract-shield") || unitReactionIds.includes("contract-deny") || unitReactionIds.includes("contract-dispel")) {
  throw new Error(`Unit reaction candidates drifted from the canonical contract: ${unitReactionIds.join(",")}`);
}

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

// A Burst spell with no legal target must not create a false human prompt.
const noTargetState = createCustomGame("No False Reaction", deck, deck, {
  skipMulligan: true,
  playerGoesFirst: false,
  playerStartingHand: 0,
  aiStartingHand: 0,
  playerStartingMana: 10,
  aiStartingMana: 10,
  seed: 303030,
});
noTargetState.phase = "main";
noTargetState.activePlayer = "ai";
noTargetState.players.player.mana = 10;
noTargetState.players.player.maxMana = 10;
noTargetState.players.player.hand = [{ instanceId: "player-dispel", defId: "tide_dispel" }];
noTargetState.players.ai.mana = 10;
noTargetState.players.ai.maxMana = 10;
noTargetState.players.ai.hand = [{ instanceId: "ai-bolt-no-window", defId: "ember_bolt" }];
const noFalseWindow = applyGameAction(noTargetState, { type: "aiStep" });
if (noFalseWindow.awaitingReaction) {
  throw new Error("An uncastable Disenchant response opened a false reaction window");
}

// Target-contract regression: `damageUnit` describes the effect implementation,
// not permission to target a Sentinela. Ember Bolt is anyUnit-only, so the AI
// must not emit a cast at a Sentinela just because its loyalty is low.
const targetContractState = createCustomGame("Target Contract", deck, deck, {
  skipMulligan: true,
  playerGoesFirst: true,
  playerStartingHand: 0,
  aiStartingHand: 0,
  playerStartingMana: 10,
  aiStartingMana: 10,
  seed: 616161,
});
targetContractState.phase = "main";
targetContractState.activePlayer = "player";
targetContractState.players.player.mana = 10;
targetContractState.players.player.maxMana = 10;
targetContractState.players.player.hand = [{ instanceId: "player-bolt", defId: "ember_bolt" }];
targetContractState.players.ai.sentinelas = [{
  instanceId: "enemy-sentinela",
  defId: "rf296_sent_ilyra",
  owner: "ai",
  loyalty: 2,
  activatedThisTurn: false,
}];

const illegalSentinelaTarget = aiChooseAction(targetContractState, "player");
if (illegalSentinelaTarget?.targetInstanceId === "enemy-sentinela") {
  throw new Error("AI emitted a unit-only damage spell against a Sentinela target");
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

console.log("Reaction-window regression tests passed — canonical Ability System 2.0 reaction eligibility certified.");
