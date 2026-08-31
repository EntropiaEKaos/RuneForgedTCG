import assert from "node:assert/strict";
import { abilityCostsFromActivatedCost } from "./ability-system";
import {
  activateAbility,
  canBeginActivateAbility,
  createCustomGame,
  makeUnit,
  validateActivatedAbilityActivation,
} from "./engine";
import { aiChooseActivatedAbilityAction } from "./ai-activated-abilities";
import { validateAuthorableCardWithActivatedAbilities } from "./activated-ability-authoring";
import {
  activatedAbilityCostDescription,
  activatedAbilityCostLabel,
  activatedAbilityUiState,
} from "./activated-ability-presentation";
import { clearRegisteredCustomCards, registerCustomCards } from "./custom-registry";
import type { CardDef, DeckInput, GameState } from "./types";

const deck: DeckInput = {
  id: "expanded-cost-test",
  name: "Expanded Cost Test",
  cards: Array(20).fill("ember_whelp"),
};

const cards: CardDef[] = [
  {
    defId: "test_spell_mana_relay",
    name: "Spell Mana Relay",
    region: "Tidecall",
    type: "Unit",
    cost: 2,
    power: 1,
    health: 3,
    rarity: "Rare",
    description: "Spend spell mana and Barrier to discharge the relay.",
    emoji: "✦",
    keywords: ["Barrier"],
    activatedAbilities: [
      {
        description: "Discharge Relay",
        cost: { spellMana: 2, consumeBarrier: true },
        maxUsesPerRound: null,
        effect: { kind: "damageNexus", amount: 4, target: "none" },
      },
    ],
  },
  {
    defId: "test_atomic_cost_targeter",
    name: "Atomic Cost Targeter",
    region: "Tidecall",
    type: "Unit",
    cost: 2,
    power: 1,
    health: 3,
    rarity: "Rare",
    description: "Expanded costs are paid only after target legality succeeds.",
    emoji: "◈",
    keywords: ["Barrier"],
    activatedAbilities: [
      {
        description: "Atomic Bolt",
        cost: { mana: 1, spellMana: 1, consumeBarrier: true },
        effect: { kind: "damageUnit", amount: 2, target: "enemyUnit" },
      },
    ],
  },
  {
    defId: "test_expanded_cost_dummy",
    name: "Expanded Cost Dummy",
    region: "Ironwood",
    type: "Unit",
    cost: 1,
    power: 0,
    health: 5,
    rarity: "Common",
    description: "Target fixture.",
    emoji: "🎯",
  },
];

function game(playerGoesFirst = true): GameState {
  return createCustomGame("Expanded Costs", deck, deck, {
    skipMulligan: true,
    playerGoesFirst,
    seed: 91573,
  });
}

function addReadyUnit(state: GameState, defId: string, owner: "player" | "ai") {
  const unit = makeUnit(state, defId, owner);
  unit.summonedThisTurn = false;
  state.players[owner].bench.push(unit);
  return unit;
}

registerCustomCards(cards);

try {
  {
    const state = game();
    const source = addReadyUnit(state, "test_spell_mana_relay", "player");
    state.players.player.mana = 10;
    state.players.player.spellMana = 1;
    const before = structuredClone(state);

    const validation = validateActivatedAbilityActivation(state, "player", source.instanceId, 0);
    assert.equal(validation.ok, false, "regular mana never substitutes for a spell-mana cost");
    assert.match(validation.reason ?? "", /not enough spell mana/i);
    assert.deepEqual(activateAbility(state, "player", source.instanceId, 0), before, "failed spell-mana payment is an exact no-op");

    const ui = activatedAbilityUiState(state, "player", source.instanceId, 0);
    assert.equal(ui.canUse, false);
    assert.match(ui.reason ?? "", /Mana de feitiço insuficiente/i);
  }

  {
    let state = game();
    const source = addReadyUnit(state, "test_spell_mana_relay", "player");
    state.players.player.mana = 7;
    state.players.player.spellMana = 2;
    const enemyBefore = state.players.ai.nexusHealth;

    assert.equal(canBeginActivateAbility(state, "player", source.instanceId, 0), true);
    state = activateAbility(state, "player", source.instanceId, 0);
    const sourceAfter = state.players.player.bench.find((unit) => unit.instanceId === source.instanceId)!;
    assert.equal(state.players.player.spellMana, 0, "spell mana is paid from its dedicated pool");
    assert.equal(state.players.player.mana, 7, "regular mana remains untouched");
    assert.equal(sourceAfter.barrier, false, "Barrier is consumed before the effect resolves");
    assert.equal(state.players.ai.nexusHealth, enemyBefore - 4, "effect resolves after all expanded costs are paid");
    assert.equal(canBeginActivateAbility(state, "player", source.instanceId, 0), false, "an unlimited Barrier-cost ability cannot repeat after Barrier is gone");
  }

  {
    let state = game();
    const source = addReadyUnit(state, "test_atomic_cost_targeter", "player");
    state.players.player.mana = 3;
    state.players.player.spellMana = 2;
    const before = structuredClone(state);

    assert.equal(canBeginActivateAbility(state, "player", source.instanceId, 0), false, "missing target blocks activation before any cost is paid");
    assert.deepEqual(activateAbility(state, "player", source.instanceId, 0), before, "target failure preserves mana, spell mana and Barrier atomically");

    const target = addReadyUnit(state, "test_expanded_cost_dummy", "ai");
    const targetBefore = target.health;
    state = activateAbility(state, "player", source.instanceId, 0, target.instanceId);
    const sourceAfter = state.players.player.bench.find((unit) => unit.instanceId === source.instanceId)!;
    const targetAfter = state.players.ai.bench.find((unit) => unit.instanceId === target.instanceId)!;
    assert.equal(state.players.player.mana, 2);
    assert.equal(state.players.player.spellMana, 1);
    assert.equal(sourceAfter.barrier, false);
    assert.equal(targetAfter.health, targetBefore - 2);
  }

  {
    const accepted = validateAuthorableCardWithActivatedAbilities({
      ...cards[0],
      activatedAbilities: cards[0].activatedAbilities,
    } as CardDef & Record<string, unknown>);
    assert.equal(accepted.ok, true, "Unit authoring accepts spell mana + Barrier costs");
    if (accepted.ok) {
      assert.deepEqual(accepted.card.activatedAbilities?.[0].cost, { spellMana: 2, consumeBarrier: true });
    }

    const rejected = validateAuthorableCardWithActivatedAbilities({
      defId: "bad_barrier_artifact",
      name: "Bad Barrier Artifact",
      region: "Tidecall",
      type: "Artifact",
      cost: 1,
      rarity: "Common",
      maxHealth: 3,
      description: "Invalid Barrier cost source.",
      emoji: "×",
      activatedAbilities: [{
        description: "Invalid",
        cost: { consumeBarrier: true },
        effect: { kind: "draw", amount: 1, target: "none" },
      }],
    } as CardDef & Record<string, unknown>);
    assert.equal(rejected.ok, false, "non-Unit authoring rejects consumeBarrier");
    if (!rejected.ok) assert.match(rejected.error, /Only Unit sources/i);
  }

  {
    assert.deepEqual(
      abilityCostsFromActivatedCost({ mana: 1, spellMana: 2, consumeBarrier: true }),
      [
        { kind: "mana", amount: 1 },
        { kind: "spellMana", amount: 2 },
        { kind: "consumeBarrier" },
      ],
      "Ability Blueprint projection preserves the expanded cost vocabulary",
    );

    const ability = cards[0].activatedAbilities![0];
    assert.match(activatedAbilityCostLabel(ability), /✦2/);
    assert.match(activatedAbilityCostLabel(ability), /◈/);
    assert.match(activatedAbilityCostDescription(ability), /mana de feitiço/i);
    assert.match(activatedAbilityCostDescription(ability), /Barrier ativa/i);
  }

  {
    const state = game(false);
    const source = addReadyUnit(state, "test_spell_mana_relay", "ai");
    state.activePlayer = "ai";
    state.phase = "main";
    state.players.ai.spellMana = 2;
    const action = aiChooseActivatedAbilityAction(state, "ai");
    assert.equal(action?.instanceId, source.instanceId, "AI can select a useful expanded-cost activation when all costs are payable");

    state.players.ai.spellMana = 0;
    assert.equal(aiChooseActivatedAbilityAction(state, "ai"), null, "AI does not propose an activation whose spell-mana cost cannot be paid");
  }

  console.log("EXPANDED ACTIVATED ABILITY COSTS: PASS — spell mana, Barrier, atomic payment, Studio grammar, presentation and AI certified");
} finally {
  clearRegisteredCustomCards();
}
