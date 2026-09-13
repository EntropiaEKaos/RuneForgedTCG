import { aiChooseReaction } from "./ai";
import { getCard } from "./cards";
import {
  applyStackedAction,
  applyStackedActionWithAi,
  createCustomGame,
  eligibleReactionActivatedAbilities,
  type CardAction,
} from "./engine";
import { applyGameAction } from "./reducer";
import type { ReactionActivatedAbility } from "./activated-ability-types";
import type { DeckInput } from "./types";

const deck: DeckInput = {
  id: "reaction-activated-regression",
  name: "Reaction activated regression",
  cards: Array(20).fill("ember_whelp"),
};

const sourceDef = getCard("wood_ent");
const boltDef = getCard("ember_bolt");
const originalAbilities = sourceDef.reactionActivatedAbilities;
const originalBoltRules = [...(boltDef.customKeywords ?? [])];

function stateWithSource() {
  const state = createCustomGame("Reaction Activated", deck, deck, {
    skipMulligan: true,
    playerGoesFirst: false,
    playerBench: ["wood_ent"],
    playerStartingHand: 0,
    aiStartingHand: 0,
    playerStartingMana: 10,
    aiStartingMana: 10,
    seed: 717171,
  });
  state.phase = "main";
  state.activePlayer = "ai";
  state.players.player.mana = 10;
  state.players.player.maxMana = 10;
  state.players.ai.mana = 10;
  state.players.ai.maxMana = 10;
  state.players.ai.hand = [{ instanceId: "pending-bolt", defId: "ember_bolt" }];
  return state;
}

function pendingSpell(targetInstanceId?: string): CardAction {
  return {
    kind: "spell",
    player: "ai",
    instanceId: "pending-bolt",
    defId: "ember_bolt",
    ...(targetInstanceId ? { targetInstanceId } : {}),
  };
}

try {
  const negateAbility: ReactionActivatedAbility = {
    description: "Ward the stack",
    respondsTo: ["spell"],
    effect: { kind: "negateSpell", amount: 0, target: "spellOnStack" },
    cost: { mana: 1 },
    maxUsesPerRound: 1,
  };
  sourceDef.reactionActivatedAbilities = [negateAbility];

  // A battlefield response alone must be enough to open the existing window.
  const windowState = stateWithSource();
  const source = windowState.players.player.bench[0];
  const opened = applyStackedAction(windowState, pendingSpell(source.instanceId));
  if (!opened.awaitingReaction) throw new Error("Battlefield reaction ability failed to open the authoritative reaction window");
  const options = eligibleReactionActivatedAbilities(windowState, "player", pendingSpell(source.instanceId));
  if (options.length !== 1 || options[0].sourceInstanceId !== source.instanceId) {
    throw new Error(`Reaction ability option projection drifted: ${JSON.stringify(options)}`);
  }

  const response: CardAction = {
    kind: "sentinela",
    responseKind: "activatedAbility",
    player: "player",
    instanceId: source.instanceId,
    defId: source.defId,
    abilityIndex: 0,
    targetInstanceId: "pending-bolt",
  };
  const negated = applyStackedActionWithAi(windowState, pendingSpell(source.instanceId), "react", response, () => null).next;
  if (negated.players.player.mana !== 9) throw new Error(`Reaction ability mana cost was not paid: ${negated.players.player.mana}`);
  if (negated.players.ai.hand.some((card) => card.instanceId === "pending-bolt")) throw new Error("Negated pending spell remained in the opponent hand");
  if ((negated.players.player.bench[0].activatedAbilityUses?.["reaction:0"]?.count ?? 0) !== 1) {
    throw new Error("Reaction ability did not record its independent per-round usage");
  }

  // Event-kind filtering is authoritative; a spell must not open a unit-only response.
  sourceDef.reactionActivatedAbilities = [{ ...negateAbility, respondsTo: ["unit"] }];
  const wrongKindState = stateWithSource();
  if (applyStackedAction(wrongKindState, pendingSpell(wrongKindState.players.player.bench[0].instanceId)).awaitingReaction) {
    throw new Error("A reaction ability opened on an action kind outside respondsTo");
  }

  // Uncounterable remains a shared stack rule for card and battlefield counters.
  sourceDef.reactionActivatedAbilities = [negateAbility];
  boltDef.customKeywords = [...originalBoltRules, "uncounterable"];
  const protectedState = stateWithSource();
  if (applyStackedAction(protectedState, pendingSpell(protectedState.players.player.bench[0].instanceId)).awaitingReaction) {
    throw new Error("Battlefield negate ability opened against an uncounterable spell");
  }
  boltDef.customKeywords = originalBoltRules;

  // A non-counter reaction resolves first and changes how the pending action resolves.
  sourceDef.reactionActivatedAbilities = [{
    description: "Emergency bark",
    respondsTo: ["spell"],
    effect: { kind: "grantBarrier", amount: 0, target: "allyUnit" },
    cost: { discardFromHand: 1 },
    maxUsesPerRound: 1,
  }];
  const barrierState = stateWithSource();
  const barrierSource = barrierState.players.player.bench[0];
  barrierState.players.player.hand = [{ instanceId: "discard-me", defId: "ember_whelp" }];
  const initialHealth = barrierSource.health;
  const barrierPending = pendingSpell(barrierSource.instanceId);
  if (!applyStackedAction(barrierState, barrierPending).awaitingReaction) {
    throw new Error("Payable board-target reaction did not open a window during preflight");
  }

  // Exact selected costs are required at stack insertion even though preflight may omit them.
  const missingDiscard: CardAction = {
    kind: "sentinela",
    responseKind: "activatedAbility",
    player: "player",
    instanceId: barrierSource.instanceId,
    defId: barrierSource.defId,
    abilityIndex: 0,
    targetInstanceId: barrierSource.instanceId,
  };
  const rejected = applyStackedActionWithAi(barrierState, barrierPending, "react", missingDiscard, () => null).next;
  if (!rejected.players.player.hand.some((card) => card.instanceId === "discard-me")) {
    throw new Error("Invalid reaction discard payload mutated the player hand");
  }
  if (rejected.players.player.bench[0].health >= initialHealth) {
    throw new Error("Pending spell failed to resolve after an invalid battlefield response was rejected");
  }

  const validBarrierState = stateWithSource();
  const validBarrierSource = validBarrierState.players.player.bench[0];
  validBarrierState.players.player.hand = [{ instanceId: "discard-me", defId: "ember_whelp" }];
  const validPending = pendingSpell(validBarrierSource.instanceId);
  const validResponse: CardAction = {
    kind: "sentinela",
    responseKind: "activatedAbility",
    player: "player",
    instanceId: validBarrierSource.instanceId,
    defId: validBarrierSource.defId,
    abilityIndex: 0,
    targetInstanceId: validBarrierSource.instanceId,
    costDiscardInstanceIds: ["discard-me"],
  };
  const protectedByAbility = applyStackedActionWithAi(validBarrierState, validPending, "react", validResponse, () => null).next;
  if (protectedByAbility.players.player.hand.some((card) => card.instanceId === "discard-me")) throw new Error("Reaction discard cost was not paid");
  if (protectedByAbility.players.player.bench[0].health !== initialHealth) {
    throw new Error(`Barrier reaction did not resolve before pending damage: ${protectedByAbility.players.player.bench[0].health}`);
  }

  // Modal choices share the same base cost/usage budget and carry stable mode ids.
  sourceDef.reactionActivatedAbilities = [{
    description: "Choose a defense",
    respondsTo: ["spell"],
    modes: [
      { id: "deny", description: "Deny", effect: { kind: "negateSpell", amount: 0, target: "spellOnStack" } },
      { id: "shield", description: "Shield", effect: { kind: "grantBarrier", amount: 0, target: "allyUnit" } },
    ],
    cost: { mana: 1 },
    maxUsesPerRound: 1,
  }];
  const modalState = stateWithSource();
  const modalSource = modalState.players.player.bench[0];
  const modalOptions = eligibleReactionActivatedAbilities(modalState, "player", pendingSpell(modalSource.instanceId));
  if (modalOptions.map((option) => option.modeId).join(",") !== "deny,shield") {
    throw new Error(`Modal reaction choices lost stable ids: ${modalOptions.map((option) => option.modeId).join(",")}`);
  }

  // AI response includes exact source/mode/target data and remains deterministic.
  sourceDef.reactionActivatedAbilities = [negateAbility];
  const aiState = stateWithSource();
  const movedSource = aiState.players.player.bench[0];
  aiState.players.player.bench = [];
  movedSource.owner = "ai";
  aiState.players.ai.bench = [movedSource];
  aiState.players.player.hand = [{ instanceId: "player-bolt", defId: "ember_bolt" }];
  aiState.activePlayer = "player";
  const playerAction: CardAction = {
    kind: "spell",
    player: "player",
    instanceId: "player-bolt",
    defId: "ember_bolt",
    targetInstanceId: movedSource.instanceId,
  };
  const aiResponseA = aiChooseReaction(aiState, playerAction, "ai");
  const aiResponseB = aiChooseReaction(aiState, playerAction, "ai");
  if (!aiResponseA || aiResponseA.responseKind !== "activatedAbility" || aiResponseA.targetInstanceId !== "player-bolt") {
    throw new Error(`AI failed to choose the battlefield negate response: ${JSON.stringify(aiResponseA)}`);
  }
  if (JSON.stringify(aiResponseA) !== JSON.stringify(aiResponseB)) throw new Error("AI reaction ability choice is not deterministic");

  // Regression: proactive battlefield activated abilities selected by the AI also
  // travel through the reaction stack. Before this contract, resolving a skipped
  // window treated every non-spell action as playUnit(), so a battlefield source
  // no-oped and immediately reopened the same reaction window until the Alpha
  // action budget was exhausted.
  const stackedState = createCustomGame("Stacked Activated AI", deck, deck, {
    skipMulligan: true,
    playerGoesFirst: false,
    aiBench: ["van_tide_u15"],
    playerStartingHand: 0,
    aiStartingHand: 0,
    playerStartingMana: 10,
    aiStartingMana: 10,
    seed: 979797,
  });
  stackedState.phase = "main";
  stackedState.activePlayer = "ai";
  stackedState.players.player.mana = 10;
  stackedState.players.player.maxMana = 10;
  stackedState.players.player.hand = [{ instanceId: "stacked-player-deny", defId: "tide_deny" }];
  stackedState.players.ai.mana = 10;
  stackedState.players.ai.maxMana = 10;

  const stackedSource = stackedState.players.ai.bench.find((unit) => unit.defId === "van_tide_u15");
  if (!stackedSource) throw new Error("Stacked activation fixture lost van_tide_u15");
  if (stackedSource.hasAttackedThisTurn) throw new Error("Stacked activation source must begin ready to pay its exhaust cost");

  const stackedOpened = applyGameAction(stackedState, { type: "aiStep" });
  if (!stackedOpened.awaitingReaction) {
    throw new Error("AI proactive activated ability failed to open the player's Tide Deny reaction window");
  }
  if (stackedOpened.awaitingReaction.action.kind !== "sentinela") {
    throw new Error(`Proactive activated ability lost its stack kind: ${stackedOpened.awaitingReaction.action.kind}`);
  }
  if (stackedOpened.awaitingReaction.action.instanceId !== stackedSource.instanceId) {
    throw new Error("Proactive activated ability reaction window lost the battlefield source instance");
  }
  if (stackedOpened.awaitingReaction.action.abilityIndex !== 0) {
    throw new Error(`Proactive activated ability lost its ability index: ${String(stackedOpened.awaitingReaction.action.abilityIndex)}`);
  }

  const stackedHandBefore = stackedOpened.next.players.ai.hand.length;
  const stackedManaBefore = stackedOpened.next.players.ai.mana;
  const stackedResolved = applyStackedActionWithAi(
    stackedOpened.next,
    stackedOpened.awaitingReaction.action,
    "skip",
    null,
    aiChooseReaction,
  );
  if (stackedResolved.awaitingReaction) {
    throw new Error("Explicit skip reopened the proactive activated ability reaction window");
  }
  if (stackedResolved.next === stackedOpened.next) {
    throw new Error("Skipped proactive activated ability resolved as a no-op");
  }
  if (stackedResolved.next.players.ai.mana !== stackedManaBefore - 2) {
    throw new Error(`Stacked activated ability did not pay its mana cost: ${stackedResolved.next.players.ai.mana}`);
  }
  if (stackedResolved.next.players.ai.hand.length !== stackedHandBefore + 1) {
    throw new Error("Stacked activated ability did not resolve its draw effect");
  }
  const stackedResolvedSource = stackedResolved.next.players.ai.bench.find((unit) => unit.instanceId === stackedSource.instanceId);
  if (!stackedResolvedSource?.hasAttackedThisTurn) {
    throw new Error("Stacked activated ability did not pay its exhaust cost");
  }
  if ((stackedResolvedSource.activatedAbilityUses?.["0"]?.count ?? 0) !== 1) {
    throw new Error("Stacked activated ability did not consume exactly one per-round use");
  }

  const stackedContinued = applyGameAction(stackedResolved.next, { type: "aiStep" });
  if (stackedContinued.awaitingReaction?.action.instanceId === stackedSource.instanceId) {
    throw new Error("Resolved exhausted ability reopened the same reaction window");
  }
  if (stackedContinued.next === stackedResolved.next && !stackedContinued.awaitingReaction) {
    throw new Error("AI failed to make authoritative progress after stacked activated ability resolution");
  }

  // #159: countering a proactive battlefield activation prevents only its
  // effect. Mana, exhaust and the per-round usage budget remain committed.
  const counteredState = createCustomGame("Countered Activated AI", deck, deck, {
    skipMulligan: true,
    playerGoesFirst: false,
    aiBench: ["van_tide_u15"],
    playerStartingHand: 0,
    aiStartingHand: 0,
    playerStartingMana: 10,
    aiStartingMana: 10,
    seed: 989898,
  });
  counteredState.phase = "main";
  counteredState.activePlayer = "ai";
  counteredState.players.player.mana = 10;
  counteredState.players.player.maxMana = 10;
  counteredState.players.player.spellMana = 0;
  counteredState.players.player.hand = [{ instanceId: "counter-player-deny", defId: "tide_deny" }];
  counteredState.players.ai.mana = 10;
  counteredState.players.ai.maxMana = 10;

  const counteredSource = counteredState.players.ai.bench.find((unit) => unit.defId === "van_tide_u15");
  if (!counteredSource) throw new Error("Countered activation fixture lost van_tide_u15");
  const counterOpened = applyGameAction(counteredState, { type: "aiStep" });
  if (!counterOpened.awaitingReaction) throw new Error("Countered activation failed to open a reaction window");
  if (counterOpened.awaitingReaction.action.abilityIndex !== 0) throw new Error("Countered activation lost its exact ability index");

  const counterManaBefore = counterOpened.next.players.ai.mana;
  const counterHandBefore = counterOpened.next.players.ai.hand.length;
  const counterResponse: CardAction = {
    kind: "spell",
    player: "player",
    instanceId: "counter-player-deny",
    defId: "tide_deny",
    targetInstanceId: counterOpened.awaitingReaction.action.instanceId,
  };
  const counterResolved = applyStackedActionWithAi(
    counterOpened.next,
    counterOpened.awaitingReaction.action,
    "react",
    counterResponse,
    aiChooseReaction,
  );
  if (counterResolved.awaitingReaction) throw new Error("Countered activation reopened reaction priority");
  if (counterResolved.next.players.ai.mana !== counterManaBefore - 2) {
    throw new Error(`Counter refunded proactive activation mana: ${counterResolved.next.players.ai.mana}`);
  }
  if (counterResolved.next.players.ai.hand.length !== counterHandBefore) {
    throw new Error("Countered proactive activation still resolved its draw effect");
  }
  const counteredSourceAfter = counterResolved.next.players.ai.bench.find((unit) => unit.instanceId === counteredSource.instanceId);
  if (!counteredSourceAfter?.hasAttackedThisTurn) throw new Error("Counter refunded proactive activation exhaust cost");
  if ((counteredSourceAfter.activatedAbilityUses?.["0"]?.count ?? 0) !== 1) {
    throw new Error("Counter refunded proactive activation per-round usage");
  }
  if (counterResolved.next.players.player.hand.some((card) => card.instanceId === "counter-player-deny")) {
    throw new Error("The successful Tide Deny counter was not consumed");
  }
  const counterContinued = applyGameAction(counterResolved.next, { type: "aiStep" });
  if (counterContinued.awaitingReaction?.action.instanceId === counteredSource.instanceId) {
    throw new Error("Countered exhausted ability reopened the same reaction window");
  }

  // `kind: sentinela` without an abilityIndex is a physical Sentinela card
  // committed from hand. It must keep the normal card-play path rather than be
  // misclassified as a battlefield activation.
  const physicalState = createCustomGame("Physical Sentinela Stack", deck, deck, {
    skipMulligan: true,
    playerGoesFirst: false,
    playerStartingHand: 0,
    aiStartingHand: 0,
    playerStartingMana: 10,
    aiStartingMana: 10,
    seed: 999999,
  });
  physicalState.phase = "main";
  physicalState.activePlayer = "ai";
  physicalState.players.ai.mana = 10;
  physicalState.players.ai.maxMana = 10;
  physicalState.players.ai.hand = [{ instanceId: "physical-sentinela-card", defId: "sent_marinna" }];
  const physicalAction: CardAction = {
    kind: "sentinela",
    player: "ai",
    instanceId: "physical-sentinela-card",
    defId: "sent_marinna",
  };
  const physicalResolved = applyStackedActionWithAi(physicalState, physicalAction, "skip", null, () => null).next;
  if (physicalResolved.players.ai.hand.some((card) => card.instanceId === "physical-sentinela-card")) {
    throw new Error("Physical Sentinela card remained in hand after stack resolution");
  }
  if (!physicalResolved.players.ai.sentinelas.some((sen) => sen.instanceId === "physical-sentinela-card")) {
    throw new Error("Physical Sentinela stack frame was misclassified as an activated ability");
  }

  console.log("REACTION ACTIVATED ABILITIES: PASS");
} finally {
  sourceDef.reactionActivatedAbilities = originalAbilities;
  boltDef.customKeywords = originalBoltRules;
}
