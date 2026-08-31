import { aiChooseReaction } from "./ai";
import { getCard } from "./cards";
import {
  applyStackedAction,
  applyStackedActionWithAi,
  createCustomGame,
  eligibleReactionActivatedAbilities,
  type CardAction,
} from "./engine";
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

  console.log("REACTION ACTIVATED ABILITIES: PASS");
} finally {
  sourceDef.reactionActivatedAbilities = originalAbilities;
  boltDef.customKeywords = originalBoltRules;
}
