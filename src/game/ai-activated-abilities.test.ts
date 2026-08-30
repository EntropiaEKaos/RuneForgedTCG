import assert from "node:assert/strict";
import { aiChooseAction, applyAiAction } from "./ai";
import { aiChooseActivatedAbilityAction } from "./ai-activated-abilities";
import {
  canBeginActivateAbility,
  createCustomGame,
  makePermanent,
  makeUnit,
  playUnit,
} from "./engine";
import { clearRegisteredCustomCards, registerCustomCards } from "./custom-registry";
import type { CardDef, DeckInput, GameState, PlayerId } from "./types";

const deck: DeckInput = {
  id: "ai-activated-test-deck",
  name: "AI Activated Test Deck",
  cards: Array(20).fill("ember_whelp"),
};

const cards: CardDef[] = [
  {
    defId: "ai_test_channeler",
    name: "AI Channeler",
    region: "Emberhold",
    type: "Unit",
    cost: 2,
    power: 1,
    health: 3,
    rarity: "Common",
    description: "Pay 1 mana: deal 2 to an enemy unit.",
    emoji: "⚡",
    activatedAbilities: [
      {
        description: "Arc Bolt",
        cost: { mana: 1 },
        effect: { kind: "damageUnit", amount: 2, target: "enemyUnit" },
      },
    ],
  },
  {
    defId: "ai_test_target",
    name: "AI Target",
    region: "Ironwood",
    type: "Unit",
    cost: 2,
    power: 4,
    health: 2,
    rarity: "Common",
    description: "Target fixture.",
    emoji: "🎯",
  },
  {
    defId: "ai_test_hexproof",
    name: "AI Hexproof Target",
    region: "Ironwood",
    type: "Unit",
    cost: 4,
    power: 8,
    health: 4,
    rarity: "Rare",
    description: "Must not be selected by enemy targeted abilities.",
    emoji: "🛡",
    keywords: ["Hexproof"],
  },
  {
    defId: "ai_test_breaker",
    name: "AI Relic Breaker",
    region: "Tidecall",
    type: "Artifact",
    cost: 2,
    rarity: "Rare",
    maxHealth: 3,
    description: "Pay 1 mana: destroy an enemy permanent.",
    emoji: "🔨",
    activatedAbilities: [
      {
        description: "Break Relic",
        cost: { mana: 1 },
        effect: { kind: "destroyPermanent", amount: 0, target: "enemyPermanent" },
      },
    ],
  },
  {
    defId: "ai_test_enemy_relic",
    name: "Enemy Relic",
    region: "Voidborn",
    type: "Artifact",
    cost: 3,
    rarity: "Common",
    maxHealth: 4,
    description: "Enemy permanent fixture.",
    emoji: "◈",
  },
  {
    defId: "ai_test_sanctum",
    name: "AI Sanctum",
    region: "Ironwood",
    type: "Enchantment",
    cost: 2,
    rarity: "Common",
    maxHealth: 4,
    description: "Pay 1 mana: heal the Nexus by 3.",
    emoji: "✚",
    activatedAbilities: [
      {
        description: "Renew Nexus",
        cost: { mana: 1 },
        effect: { kind: "healNexus", amount: 3, target: "none" },
      },
    ],
  },
  {
    defId: "ai_test_blood_archive",
    name: "AI Blood Archive",
    region: "Voidborn",
    type: "Artifact",
    cost: 2,
    rarity: "Rare",
    maxHealth: 3,
    description: "A deliberately dangerous draw activation.",
    emoji: "🩸",
    activatedAbilities: [
      {
        description: "Desperate Knowledge",
        cost: { nexusHealth: 5, sacrificeSelf: true },
        effect: { kind: "draw", amount: 1, target: "none" },
      },
    ],
  },
  {
    defId: "ai_test_hybrid_sentinel",
    name: "AI Hybrid Sentinel",
    region: "Emberhold",
    type: "Sentinela",
    cost: 3,
    rarity: "Rare",
    description: "Classic and generic abilities compete under one AI policy.",
    emoji: "◆",
    sentinela: {
      startingLoyalty: 3,
      abilities: [
        {
          cost: 1,
          description: "+1: draw a card",
          effect: { kind: "draw", amount: 1, target: "none" },
        },
      ],
    },
    activatedAbilities: [
      {
        description: "Finishing Pulse",
        cost: { mana: 1 },
        effect: { kind: "damageNexus", amount: 4, target: "none" },
      },
    ],
  },
];

function game(): GameState {
  const state = createCustomGame("AI Test", deck, deck, {
    skipMulligan: true,
    playerGoesFirst: true,
    seed: 515151,
  });
  state.phase = "main";
  state.activePlayer = "ai";
  state.players.ai.hand = [];
  state.players.player.hand = [];
  state.players.ai.mana = 5;
  state.players.ai.maxMana = 5;
  return state;
}

function addUnit(state: GameState, defId: string, owner: PlayerId) {
  const unit = makeUnit(state, defId, owner);
  unit.summonedThisTurn = false;
  state.players[owner].bench.push(unit);
  return unit;
}

function addPermanent(state: GameState, defId: string, owner: PlayerId) {
  const permanent = makePermanent(state, defId, owner);
  state.players[owner].permanents.push(permanent);
  return permanent;
}

registerCustomCards(cards);

try {
  {
    const state = game();
    const source = addUnit(state, "ai_test_channeler", "ai");
    const hexproof = addUnit(state, "ai_test_hexproof", "player");
    const legalTarget = addUnit(state, "ai_test_target", "player");

    const action = aiChooseAction(state, "ai");
    assert.ok(action, "AI should find the generic Unit activation");
    assert.equal(action.kind, "sentinela", "wire-compatible activation opcode is reused");
    assert.equal(action.instanceId, source.instanceId, "Unit is selected as the activated source");
    assert.equal(action.abilityIndex, 0);
    assert.equal(action.targetInstanceId, legalTarget.instanceId, "Hexproof threat is skipped in favor of a legal target");
    assert.notEqual(action.targetInstanceId, hexproof.instanceId);

    const next = applyAiAction(state, action, "ai");
    const targetAfter = next.players.player.bench.find((unit) => unit.instanceId === legalTarget.instanceId);
    assert.equal(next.players.ai.mana, 4, "AI pays the same regular-mana cost as a human activation");
    assert.equal(targetAfter?.health, 0, "generic Unit ability resolves through the authoritative executor");
    assert.equal(next.players.player.bench.some((unit) => unit.instanceId === legalTarget.instanceId), false, "lethal target is cleaned up immediately");
  }

  {
    const state = game();
    addUnit(state, "ai_test_channeler", "ai");
    addUnit(state, "ai_test_hexproof", "player");
    assert.equal(aiChooseActivatedAbilityAction(state, "ai"), null, "AI does not fabricate a target when every enemy unit is Hexproof");
  }

  {
    const state = game();
    const source = addPermanent(state, "ai_test_breaker", "ai");
    const target = addPermanent(state, "ai_test_enemy_relic", "player");
    const action = aiChooseAction(state, "ai");
    assert.ok(action);
    assert.equal(action.instanceId, source.instanceId, "Artifact activation participates in normal AI decisions");
    assert.equal(action.targetInstanceId, target.instanceId);
    const next = applyAiAction(state, action, "ai");
    assert.equal(next.players.player.permanents.some((perm) => perm.instanceId === target.instanceId), false, "AI can destroy an enemy permanent with a generic Artifact ability");
  }

  {
    const state = game();
    const source = addPermanent(state, "ai_test_sanctum", "ai");
    state.players.ai.nexusHealth = 10;
    const action = aiChooseAction(state, "ai");
    assert.ok(action);
    assert.equal(action.instanceId, source.instanceId, "Enchantment activation participates in normal AI decisions");
    const next = applyAiAction(state, action, "ai");
    assert.equal(next.players.ai.nexusHealth, 13, "AI resolves a useful Enchantment heal");
  }

  {
    const state = game();
    addPermanent(state, "ai_test_blood_archive", "ai");
    state.players.ai.nexusHealth = 7;
    assert.equal(
      aiChooseActivatedAbilityAction(state, "ai"),
      null,
      "conservative policy refuses a low-value sacrifice that would leave the AI at critical Nexus health",
    );
  }

  {
    let state = game();
    state.players.ai.hand = [{ instanceId: "hybrid-card", defId: "ai_test_hybrid_sentinel" }];
    state.players.ai.mana = 5;
    state.players.player.nexusHealth = 4;
    state = playUnit(state, "ai", "hybrid-card");
    const sentinel = state.players.ai.sentinelas[0];
    assert.ok(sentinel);

    const action = aiChooseAction(state, "ai");
    assert.ok(action);
    assert.equal(action.instanceId, sentinel.instanceId);
    assert.equal(action.abilityIndex, 1, "generic lethal activation beats the classic +loyalty fallback");

    state = applyAiAction(state, action, "ai");
    assert.equal(state.players.player.nexusHealth, 0, "generic Sentinela ability can finish the match");
    assert.equal(state.players.ai.sentinelas[0].activatedThisTurn, true, "generic activation consumes the shared Sentinela round budget");
    assert.equal(canBeginActivateAbility(state, "ai", sentinel.instanceId, 0), false, "classic ability cannot bypass the shared budget afterward");
  }

  console.log("AI GENERIC ACTIVATED ABILITIES: PASS");
} finally {
  clearRegisteredCustomCards();
}
