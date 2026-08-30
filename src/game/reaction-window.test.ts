import { aiChooseAction, aiChooseReaction } from "./ai";
import { replayAuthoritativeMatch } from "./authoritative";
import { getCard } from "./cards";
import {
  applyStackedActionWithAi,
  canReactWithCard,
  createCustomGame,
  eligibleReactionCards,
  reactionEligibility,
} from "./engine";
import {
  cardRulesDescription,
  counterProtectionText,
  playerVisibleCustomKeywords,
  reactionSpeedRuleText,
} from "./reaction-presentation";
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

const unitAction = { kind: "unit" as const, instanceId: "pending-unit", defId: "ember_whelp", player: "ai" as const };
const spellAction = { kind: "spell" as const, instanceId: "pending-spell", defId: "ember_bolt", player: "ai" as const };
const sentinelaAction = { kind: "sentinela" as const, instanceId: "pending-sentinela", defId: "rf296_sent_ilyra", player: "ai" as const };

if (!canReactWithCard(contractState, "player", "contract-deny", unitAction)) {
  throw new Error("Universal Deny must be able to counter a unit action");
}
if (!canReactWithCard(contractState, "player", "contract-deny", spellAction)) {
  throw new Error("Universal Deny must remain a legal response to a spell action");
}
if (!canReactWithCard(contractState, "player", "contract-deny", sentinelaAction)) {
  throw new Error("Universal Deny must be able to counter a Sentinela action");
}
if (!canReactWithCard(contractState, "player", "contract-shield", spellAction)) {
  throw new Error("Burst Barrier must remain a legal response while an allied unit is targetable");
}
if (canReactWithCard(contractState, "player", "contract-dispel", unitAction)) {
  throw new Error("Disenchant must not open a reaction window when no enemy permanent exists");
}
if (reactionEligibility(contractState, "player", "contract-dispel", unitAction).reason !== "no-legal-target") {
  throw new Error("Targetless Disenchant opportunity must fail through the canonical target gate");
}
const unitReactionIds = eligibleReactionCards(contractState, "player", unitAction).map((card) => card.instanceId);
if (!unitReactionIds.includes("contract-shield") || !unitReactionIds.includes("contract-deny") || unitReactionIds.includes("contract-dispel")) {
  throw new Error(`Unit reaction candidates drifted from the canonical contract: ${unitReactionIds.join(",")}`);
}

// Specific counters are opt-in rule keys; no filter means universal.
const denyDef = getCard("tide_deny");
const originalDenyRules = [...(denyDef.customKeywords ?? [])];

// Player-facing copy must be derived from the executable counter contract, not
// from stale authored prose or internal `customKeywords` rule keys.
const universalCounterText = cardRulesDescription(denyDef);
if (!universalCounterText.includes("Unidade") || !universalCounterText.includes("Magia") || !universalCounterText.includes("Sentinela")) {
  throw new Error(`Universal counter presentation omitted an action kind: ${universalCounterText}`);
}
if (!reactionSpeedRuleText(denyDef)?.includes("Sentinelas")) {
  throw new Error("Burst presentation did not expose the supported Sentinela response window");
}
const spellOnlyPresentation = {
  ...denyDef,
  customKeywords: [...originalDenyRules, "counter_spell", "designer_visible"],
};
const spellOnlyText = cardRulesDescription(spellOnlyPresentation);
if (!spellOnlyText.includes("Magia") || spellOnlyText.includes("Unidade") || spellOnlyText.includes("Sentinela")) {
  throw new Error(`Spell-only counter presentation drifted from its filter: ${spellOnlyText}`);
}
const visibleCounterKeywords = playerVisibleCustomKeywords(spellOnlyPresentation);
if (visibleCounterKeywords.length !== 1 || visibleCounterKeywords[0] !== "designer_visible") {
  throw new Error(`Reserved counter metadata leaked into player keywords: ${visibleCounterKeywords.join(",")}`);
}

denyDef.customKeywords = [...originalDenyRules, "counter_spell"];
if (canReactWithCard(contractState, "player", "contract-deny", unitAction)) {
  throw new Error("Spell-only counter must reject a unit action");
}
if (reactionEligibility(contractState, "player", "contract-deny", unitAction).reason !== "counter-kind-mismatch") {
  throw new Error("Specific counter mismatch must be explained by the canonical counter contract");
}
if (!canReactWithCard(contractState, "player", "contract-deny", spellAction)) {
  throw new Error("Spell-only counter must accept a spell action");
}
denyDef.customKeywords = originalDenyRules;

// `uncounterable` is the explicit exception to universal counters.
const protectedDef = getCard("ember_whelp");
const originalProtectedRules = [...(protectedDef.customKeywords ?? [])];
const protectedPresentation = {
  ...protectedDef,
  customKeywords: [...originalProtectedRules, "uncounterable", "designer_visible"],
};
if (!counterProtectionText(protectedPresentation)?.includes("não pode ser anulada")) {
  throw new Error("Uncounterable protection did not receive player-facing rules text");
}
const visibleProtectedKeywords = playerVisibleCustomKeywords(protectedPresentation);
if (visibleProtectedKeywords.length !== 1 || visibleProtectedKeywords[0] !== "designer_visible") {
  throw new Error(`Reserved uncounterable metadata leaked into player keywords: ${visibleProtectedKeywords.join(",")}`);
}

protectedDef.customKeywords = [...originalProtectedRules, "uncounterable"];
if (canReactWithCard(contractState, "player", "contract-deny", unitAction)) {
  throw new Error("An uncounterable unit must not be a legal target for a universal counter");
}
if (reactionEligibility(contractState, "player", "contract-deny", unitAction).reason !== "target-uncounterable") {
  throw new Error("Uncounterable protection must be explained by the canonical reaction contract");
}
protectedDef.customKeywords = originalProtectedRules;

// Counter follow-up effects run only after a successful counter.
const originalAlso = denyDef.spell?.also;
if (!denyDef.spell) throw new Error("Deny definition lost its spell contract");
denyDef.spell.also = { kind: "healNexus", amount: 2, target: "none" };
const followUpState = createCustomGame("Counter Follow-up", deck, deck, {
  skipMulligan: true,
  playerGoesFirst: false,
  playerStartingHand: 0,
  aiStartingHand: 0,
  playerStartingMana: 10,
  aiStartingMana: 10,
  seed: 212121,
});
followUpState.phase = "main";
followUpState.activePlayer = "ai";
followUpState.players.player.mana = 10;
followUpState.players.player.nexusHealth = 10;
followUpState.players.player.hand = [{ instanceId: "follow-counter", defId: "tide_deny" }];
followUpState.players.ai.mana = 10;
followUpState.players.ai.hand = [{ instanceId: "follow-unit", defId: "ember_whelp" }];
const followed = applyStackedActionWithAi(
  followUpState,
  { kind: "unit", player: "ai", instanceId: "follow-unit", defId: "ember_whelp" },
  "react",
  { kind: "spell", player: "player", instanceId: "follow-counter", defId: "tide_deny" },
  () => null,
).next;
if (followed.players.player.nexusHealth !== 12) {
  throw new Error(`Successful counter did not resolve its follow-up effect: ${followed.players.player.nexusHealth}`);
}
if (followed.players.ai.hand.some((card) => card.instanceId === "follow-unit")) {
  throw new Error("Countered unit remained in hand and could be replayed");
}
if (followed.players.ai.bench.some((unit) => unit.instanceId === "follow-unit" || unit.defId === "ember_whelp")) {
  throw new Error("Countered unit resolved onto the battlefield");
}
if (followed.players.ai.mana !== 9) {
  throw new Error(`Countered unit did not pay its committed mana cost: ${followed.players.ai.mana}`);
}

const blockedFollowUpState = createCustomGame("Blocked Counter Follow-up", deck, deck, {
  skipMulligan: true,
  playerGoesFirst: false,
  playerStartingHand: 0,
  aiStartingHand: 0,
  playerStartingMana: 10,
  aiStartingMana: 10,
  seed: 222222,
});
blockedFollowUpState.phase = "main";
blockedFollowUpState.activePlayer = "ai";
blockedFollowUpState.players.player.mana = 10;
blockedFollowUpState.players.player.nexusHealth = 10;
blockedFollowUpState.players.player.hand = [{ instanceId: "blocked-counter", defId: "tide_deny" }];
blockedFollowUpState.players.ai.hand = [{ instanceId: "blocked-unit", defId: "ember_whelp" }];
protectedDef.customKeywords = [...originalProtectedRules, "uncounterable"];
const blocked = applyStackedActionWithAi(
  blockedFollowUpState,
  { kind: "unit", player: "ai", instanceId: "blocked-unit", defId: "ember_whelp" },
  "react",
  { kind: "spell", player: "player", instanceId: "blocked-counter", defId: "tide_deny" },
  () => null,
).next;
if (blocked.players.player.nexusHealth !== 10) {
  throw new Error("Counter follow-up effect fired even though the target could not be countered");
}
if (!blocked.players.ai.bench.some((unit) => unit.defId === "ember_whelp")) {
  throw new Error("Uncounterable unit failed to resolve after the illegal counter attempt");
}
protectedDef.customKeywords = originalProtectedRules;
denyDef.spell.also = originalAlso;

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

console.log("Reaction-window regression tests passed — universal/specific counters, uncounterable protection, committed-card lifecycle, follow-ups and player-facing semantics certified.");