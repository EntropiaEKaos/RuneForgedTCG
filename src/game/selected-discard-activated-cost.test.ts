import assert from "node:assert/strict";
import { abilityCostsFromActivatedCost } from "./ability-system";
import { applyAiAction } from "./ai";
import { aiChooseActivatedAbilityAction } from "./ai-activated-abilities";
import {
  activateAbility,
  canBeginActivateAbility,
  createCustomGame,
  makeUnit,
  validateActivatedAbilityActivation,
} from "./engine";
import { validateAuthorableCardWithActivatedAbilities } from "./activated-ability-authoring";
import {
  activatedAbilityCostDescription,
  activatedAbilityCostLabel,
  activatedAbilityUiState,
} from "./activated-ability-presentation";
import { validateGameActionSemantics } from "./action-validator";
import { applyGameAction, type GameAction } from "./reducer";
import { clearRegisteredCustomCards, registerCustomCards } from "./custom-registry";
import type { CardDef, CardInstance, DeckInput, GameState, PlayerId } from "./types";

const deck: DeckInput = {
  id: "selected-discard-cost-test",
  name: "Selected Discard Cost Test",
  cards: Array(20).fill("ember_whelp"),
};

const cards: CardDef[] = [
  {
    defId: "test_discard_channeler",
    name: "Discard Channeler",
    region: "Voidborn",
    type: "Unit",
    cost: 2,
    power: 2,
    health: 3,
    rarity: "Rare",
    description: "Discard chosen cards to damage the enemy Nexus.",
    emoji: "🜏",
    activatedAbilities: [{
      description: "Feed the Void",
      cost: { discardFromHand: 2 },
      maxUsesPerRound: null,
      effect: { kind: "damageNexus", amount: 5, target: "none" },
    }],
  },
  {
    defId: "test_discard_targeter",
    name: "Discard Targeter",
    region: "Voidborn",
    type: "Unit",
    cost: 2,
    power: 1,
    health: 3,
    rarity: "Rare",
    description: "Target failure must not consume selected discard cards.",
    emoji: "🎯",
    activatedAbilities: [{
      description: "Pitch Bolt",
      cost: { discardFromHand: 1 },
      effect: { kind: "damageUnit", amount: 2, target: "enemyUnit" },
    }],
  },
  {
    defId: "test_discard_target_dummy",
    name: "Discard Target Dummy",
    region: "Ironwood",
    type: "Unit",
    cost: 1,
    power: 0,
    health: 5,
    rarity: "Common",
    description: "Target fixture.",
    emoji: "🛡️",
  },
  {
    defId: "test_discard_low",
    name: "Low Value Fodder",
    region: "Voidborn",
    type: "Spell",
    cost: 1,
    rarity: "Common",
    description: "Low AI discard value.",
    emoji: "1️⃣",
    spell: { kind: "draw", amount: 1, target: "none" },
  },
  {
    defId: "test_discard_mid",
    name: "Mid Value Fodder",
    region: "Voidborn",
    type: "Spell",
    cost: 3,
    rarity: "Common",
    description: "Mid AI discard value.",
    emoji: "3️⃣",
    spell: { kind: "draw", amount: 1, target: "none" },
  },
  {
    defId: "test_discard_high",
    name: "High Value Fodder",
    region: "Voidborn",
    type: "Spell",
    cost: 7,
    rarity: "Rare",
    description: "High AI discard value.",
    emoji: "7️⃣",
    spell: { kind: "draw", amount: 1, target: "none" },
  },
];

function game(playerGoesFirst = true): GameState {
  return createCustomGame("Selected Discard", deck, deck, {
    skipMulligan: true,
    playerGoesFirst,
    seed: 771923,
  });
}

function addReadyUnit(state: GameState, defId: string, owner: PlayerId) {
  const unit = makeUnit(state, defId, owner);
  unit.summonedThisTurn = false;
  state.players[owner].bench.push(unit);
  return unit;
}

function paymentHand(prefix: string): CardInstance[] {
  return [
    { instanceId: `${prefix}-low`, defId: "test_discard_low" },
    { instanceId: `${prefix}-mid`, defId: "test_discard_mid" },
    { instanceId: `${prefix}-high`, defId: "test_discard_high" },
  ];
}

registerCustomCards(cards);

try {
  {
    const state = game();
    const source = addReadyUnit(state, "test_discard_channeler", "player");
    state.players.player.hand = paymentHand("p");

    assert.equal(canBeginActivateAbility(state, "player", source.instanceId, 0), true, "preflight is ready when enough hand cards exist");
    const missingSelection = validateActivatedAbilityActivation(state, "player", source.instanceId, 0);
    assert.equal(missingSelection.ok, false, "authoritative activation still requires the concrete selected ids");
    assert.match(missingSelection.reason ?? "", /requires explicit hand selection/i);

    const ui = activatedAbilityUiState(state, "player", source.instanceId, 0);
    assert.deepEqual(ui, { canUse: true, status: "ready", reason: null }, "UI may offer activation before the cost picker chooses exact cards");
  }

  {
    const state = game();
    const source = addReadyUnit(state, "test_discard_channeler", "player");
    state.players.player.hand = paymentHand("dup");
    const before = structuredClone(state);

    assert.equal(
      validateActivatedAbilityActivation(state, "player", source.instanceId, 0, undefined, undefined, ["dup-low", "dup-low"]).ok,
      false,
      "duplicate discard ids fail closed",
    );
    assert.deepEqual(
      activateAbility(state, "player", source.instanceId, 0, undefined, undefined, ["dup-low", "dup-low"]),
      before,
      "duplicate discard payment is an exact no-op",
    );

    assert.equal(
      validateActivatedAbilityActivation(state, "player", source.instanceId, 0, undefined, undefined, ["dup-low", "foreign-card"]).ok,
      false,
      "cards outside the actor hand cannot be paid",
    );
    assert.equal(
      validateActivatedAbilityActivation(state, "player", source.instanceId, 0, undefined, undefined, ["dup-low"]).ok,
      false,
      "selection must contain exactly the configured number of cards",
    );
  }

  {
    let state = game();
    const source = addReadyUnit(state, "test_discard_channeler", "player");
    state.players.player.hand = paymentHand("ok");
    const enemyBefore = state.players.ai.nexusHealth;

    state = activateAbility(state, "player", source.instanceId, 0, undefined, undefined, ["ok-mid", "ok-low"]);
    assert.equal(state.players.player.hand.length, 1, "exactly two selected hand cards are removed as cost");
    assert.equal(state.players.player.hand[0]?.instanceId, "ok-high", "unselected card remains in hand");
    assert.equal(state.players.ai.nexusHealth, enemyBefore - 5, "effect resolves after selected discard payment");
    assert.equal(
      canBeginActivateAbility(state, "player", source.instanceId, 0),
      false,
      "repeatable discard-cost ability becomes unavailable when the hand cannot pay again",
    );
  }

  {
    const state = game();
    const source = addReadyUnit(state, "test_discard_targeter", "player");
    state.players.player.hand = paymentHand("atomic");
    const before = structuredClone(state);

    const invalidTarget = "missing-target";
    assert.deepEqual(
      activateAbility(state, "player", source.instanceId, 0, invalidTarget, undefined, ["atomic-low"]),
      before,
      "invalid target preserves the selected hand card atomically",
    );

    const target = addReadyUnit(state, "test_discard_target_dummy", "ai");
    const targetBefore = target.health;
    const next = activateAbility(state, "player", source.instanceId, 0, target.instanceId, undefined, ["atomic-low"]);
    assert.equal(next.players.player.hand.some((card) => card.instanceId === "atomic-low"), false);
    assert.equal(next.players.ai.bench.find((unit) => unit.instanceId === target.instanceId)?.health, targetBefore - 2);
  }

  {
    const state = game();
    const source = addReadyUnit(state, "test_discard_channeler", "player");
    state.players.player.hand = paymentHand("wire");
    const action: GameAction = {
      type: "sentinela",
      player: "player",
      sentinelaId: source.instanceId,
      abilityIndex: 0,
      costDiscardInstanceIds: ["wire-low", "wire-mid"],
    };
    assert.deepEqual(validateGameActionSemantics(state, action, "player"), { ok: true }, "PvP semantic validator accepts exact selected discard payload");

    const duplicateAction: GameAction = { ...action, costDiscardInstanceIds: ["wire-low", "wire-low"] };
    assert.equal(validateGameActionSemantics(state, duplicateAction, "player").ok, false, "PvP semantic validation rejects duplicate selected ids");

    const reduced = applyGameAction(state, action, false).next;
    assert.deepEqual(
      reduced.players.player.hand.map((card) => card.instanceId),
      ["wire-high"],
      "versioned sentinela reducer opcode forwards selected discard ids to the generic executor",
    );
  }

  {
    const accepted = validateAuthorableCardWithActivatedAbilities({
      ...cards[0],
      activatedAbilities: cards[0].activatedAbilities,
    } as CardDef & Record<string, unknown>);
    assert.equal(accepted.ok, true, "Studio authoring accepts selected hand discard costs");
    if (accepted.ok) assert.deepEqual(accepted.card.activatedAbilities?.[0].cost, { discardFromHand: 2 });

    const rejected = validateAuthorableCardWithActivatedAbilities({
      ...cards[0],
      defId: "test_discard_too_many",
      activatedAbilities: [{
        description: "Invalid",
        cost: { discardFromHand: 11 },
        effect: { kind: "draw", amount: 1, target: "none" },
      }],
    } as CardDef & Record<string, unknown>);
    assert.equal(rejected.ok, false, "authoring caps selected discard costs at 10 cards");
    if (!rejected.ok) assert.match(rejected.error, /discardFromHand.*0 to 10/i);
  }

  {
    assert.deepEqual(
      abilityCostsFromActivatedCost({ discardFromHand: 2 }),
      [{ kind: "discardFromHand", amount: 2, selection: "explicitInstanceIds" }],
      "Ability Blueprint preserves that discard payment requires explicit instance ids",
    );
    const ability = cards[0].activatedAbilities![0];
    assert.match(activatedAbilityCostLabel(ability), /🎴2/);
    assert.match(activatedAbilityCostDescription(ability), /descartar 2 cartas escolhidas da mão/i);
  }

  {
    const state = game(false);
    const source = addReadyUnit(state, "test_discard_channeler", "ai");
    state.activePlayer = "ai";
    state.phase = "main";
    state.players.ai.hand = paymentHand("ai");

    const action = aiChooseActivatedAbilityAction(state, "ai");
    assert.equal(action?.instanceId, source.instanceId, "AI can choose a useful selected-discard activation");
    assert.deepEqual(action?.costDiscardInstanceIds, ["ai-low", "ai-mid"], "AI deterministically selects the lowest-cost hand cards");

    const next = action ? applyAiAction(state, action, "ai") : state;
    assert.deepEqual(next.players.ai.hand.map((card) => card.instanceId), ["ai-high"], "AI executor pays the exact selected discard ids");

    const insufficient = game(false);
    const insufficientSource = addReadyUnit(insufficient, "test_discard_channeler", "ai");
    insufficient.activePlayer = "ai";
    insufficient.phase = "main";
    insufficient.players.ai.hand = [{ instanceId: "only-one", defId: "test_discard_low" }];
    assert.equal(canBeginActivateAbility(insufficient, "ai", insufficientSource.instanceId, 0), false);
    assert.equal(aiChooseActivatedAbilityAction(insufficient, "ai"), null, "AI never proposes a selected-discard ability it cannot pay");
  }

  console.log("SELECTED DISCARD ACTIVATED COST: PASS — explicit selection, atomic payment, replay/PvP, Studio grammar, presentation and AI certified");
} finally {
  clearRegisteredCustomCards();
}
