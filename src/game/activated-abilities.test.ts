import assert from "node:assert/strict";
import {
  activateAbility,
  activateSentinelaAbility,
  canActivateSentinela,
  canBeginActivateAbility,
  createCustomGame,
  endTurn,
  makePermanent,
  makeUnit,
  validateActivatedAbilityActivation,
} from "./engine";
import { applyGameAction } from "./reducer";
import { validateGameActionSemantics } from "./action-validator";
import { validateAuthorableCardWithActivatedAbilities } from "./activated-ability-authoring";
import { clearRegisteredCustomCards, registerCustomCards } from "./custom-registry";
import type { CardDef, DeckInput, GameState } from "./types";

const baseDeck: DeckInput = {
  id: "activated-test-deck",
  name: "Activated Test Deck",
  cards: Array(20).fill("ember_whelp"),
};

const cards: CardDef[] = [
  {
    defId: "test_arc_tender",
    name: "Arc Tender",
    region: "Emberhold",
    type: "Unit",
    cost: 2,
    power: 1,
    health: 3,
    rarity: "Common",
    description: "Exhaust and pay 2 mana: deal 2 to an enemy unit.",
    emoji: "⚡",
    activatedAbilities: [
      {
        description: "Canalizar Arco",
        cost: { mana: 2, exhaustSelf: true },
        effect: { kind: "damageUnit", amount: 2, target: "enemyUnit" },
      },
    ],
  },
  {
    defId: "test_target_dummy",
    name: "Target Dummy",
    region: "Ironwood",
    type: "Unit",
    cost: 1,
    power: 0,
    health: 5,
    rarity: "Common",
    description: "Neutral test target without damage mitigation.",
    emoji: "🎯",
    keywords: [],
  },
  {
    defId: "test_blood_reliquary",
    name: "Blood Reliquary",
    region: "Voidborn",
    type: "Artifact",
    cost: 2,
    rarity: "Rare",
    maxHealth: 3,
    description: "Pay 3 Nexus health and sacrifice: draw 2.",
    emoji: "🩸",
    activatedAbilities: [
      {
        description: "Último Tributo",
        cost: { nexusHealth: 3, sacrificeSelf: true },
        effect: { kind: "draw", amount: 2, target: "none" },
      },
    ],
  },
  {
    defId: "test_repeat_core",
    name: "Repeat Core",
    region: "Tidecall",
    type: "Artifact",
    cost: 1,
    rarity: "Common",
    maxHealth: 3,
    description: "Pay 1 mana: deal 1 to the enemy Nexus. Unlimited while mana remains.",
    emoji: "🔁",
    activatedAbilities: [
      {
        description: "Pulso Contínuo",
        cost: { mana: 1 },
        maxUsesPerRound: null,
        effect: { kind: "damageNexus", amount: 1, target: "none" },
      },
    ],
  },
  {
    defId: "test_unsafe_loop",
    name: "Unsafe Loop",
    region: "Tidecall",
    type: "Artifact",
    cost: 1,
    rarity: "Common",
    maxHealth: 3,
    description: "Invalid regression fixture: zero-cost unlimited damage.",
    emoji: "∞",
    activatedAbilities: [
      {
        description: "Loop Infinito",
        maxUsesPerRound: null,
        effect: { kind: "damageNexus", amount: 1, target: "none" },
      },
    ],
  },
  {
    defId: "test_death_scribe",
    name: "Death Scribe",
    region: "Voidborn",
    type: "Unit",
    cost: 2,
    power: 1,
    health: 1,
    rarity: "Rare",
    description: "Sacrifice: draw 1. Last Breath: draw 1.",
    emoji: "☠",
    trigger: { when: "onDeath", effect: { kind: "draw", amount: 1, target: "none" } },
    activatedAbilities: [
      {
        description: "Escrever o Fim",
        cost: { sacrificeSelf: true },
        effect: { kind: "draw", amount: 1, target: "none" },
      },
    ],
  },
  {
    defId: "test_relic_breaker",
    name: "Relic Breaker",
    region: "Ironwood",
    type: "Unit",
    cost: 3,
    power: 2,
    health: 3,
    rarity: "Rare",
    description: "Destroy an enemy permanent.",
    emoji: "🔨",
    activatedAbilities: [
      {
        description: "Quebrar Relíquia",
        effect: { kind: "destroyPermanent", amount: 0, target: "enemyPermanent" },
      },
    ],
  },
  {
    defId: "test_hybrid_sentinel",
    name: "Hybrid Sentinel",
    region: "Emberhold",
    type: "Sentinela",
    cost: 3,
    rarity: "Rare",
    description: "Legacy and generic abilities share one activation budget.",
    emoji: "◆",
    sentinela: {
      startingLoyalty: 3,
      abilities: [
        { cost: 1, description: "+1: ping Nexus", effect: { kind: "damageNexus", amount: 1, target: "none" } },
      ],
    },
    activatedAbilities: [
      {
        description: "Comprar conhecimento",
        cost: { mana: 1 },
        effect: { kind: "draw", amount: 1, target: "none" },
      },
    ],
  },
];

function game(): GameState {
  return createCustomGame("P", baseDeck, baseDeck, {
    skipMulligan: true,
    playerGoesFirst: true,
    seed: 424242,
  });
}

function readyUnit(state: GameState, defId: string, owner: "player" | "ai") {
  const unit = makeUnit(state, defId, owner);
  unit.summonedThisTurn = false;
  state.players[owner].bench.push(unit);
  return unit;
}

registerCustomCards(cards);

try {
  {
    let state = game();
    state.players.player.mana = 3;
    state.players.player.maxMana = 3;
    const source = readyUnit(state, "test_arc_tender", "player");
    const target = readyUnit(state, "test_target_dummy", "ai");
    const beforeHealth = target.health;

    assert.equal(canBeginActivateAbility(state, "player", source.instanceId, 0), true);
    assert.equal(validateActivatedAbilityActivation(state, "player", source.instanceId, 0, target.instanceId).ok, true);

    state = activateAbility(state, "player", source.instanceId, 0, target.instanceId);
    const sourceAfter = state.players.player.bench.find((unit) => unit.instanceId === source.instanceId)!;
    const targetAfter = state.players.ai.bench.find((unit) => unit.instanceId === target.instanceId)!;
    assert.equal(state.players.player.mana, 1, "regular mana is paid");
    assert.equal(sourceAfter.hasAttackedThisTurn, true, "exhaust cost consumes attack readiness");
    assert.equal(targetAfter.health, beforeHealth - 2, "targeted effect resolves without unrelated keyword mitigation");
    assert.equal(canBeginActivateAbility(state, "player", source.instanceId, 0), false, "once-per-round limit blocks reuse");

    state = endTurn(state, "player");
    state = endTurn(state, "ai");
    state.activePlayer = "player";
    state.players.player.mana = 3;
    assert.equal(canBeginActivateAbility(state, "player", source.instanceId, 0), true, "new round naturally resets usage/exhaustion");
  }

  {
    let state = game();
    const permanent = makePermanent(state, "test_blood_reliquary", "player");
    state.players.player.permanents.push(permanent);
    const handBefore = state.players.player.hand.length;

    const action = {
      type: "sentinela" as const,
      player: "player" as const,
      sentinelaId: permanent.instanceId,
      abilityIndex: 0,
    };
    assert.equal(validateGameActionSemantics(state, action, "player").ok, true, "PvP/replay opcode accepts generic permanent ability");

    state = applyGameAction(state, action, false).next;
    assert.equal(state.players.player.nexusHealth, 17, "Nexus health cost is paid");
    assert.equal(state.players.player.permanents.some((item) => item.instanceId === permanent.instanceId), false, "sacrifice removes source before resolution");
    assert.equal(state.players.player.hand.length, handBefore + 2, "ability effect resolves after sacrifice");
  }

  {
    const state = game();
    const permanent = makePermanent(state, "test_blood_reliquary", "player");
    state.players.player.permanents.push(permanent);
    state.players.player.nexusHealth = 3;
    const before = structuredClone(state);
    assert.equal(canBeginActivateAbility(state, "player", permanent.instanceId, 0), false, "lethal life payment is illegal");
    const next = activateAbility(state, "player", permanent.instanceId, 0);
    assert.deepEqual(next, before, "illegal activation is a deterministic no-op");
  }

  {
    let state = game();
    const core = makePermanent(state, "test_repeat_core", "player");
    state.players.player.permanents.push(core);
    state.players.player.mana = 2;
    state.players.player.maxMana = 2;
    const enemyBefore = state.players.ai.nexusHealth;
    state = activateAbility(state, "player", core.instanceId, 0);
    state = activateAbility(state, "player", core.instanceId, 0);
    assert.equal(state.players.ai.nexusHealth, enemyBefore - 2, "paid unlimited ability can repeat while its finite resource remains");
    assert.equal(state.players.player.mana, 0, "each unlimited activation consumes mana");
    assert.equal(canBeginActivateAbility(state, "player", core.instanceId, 0), false, "unlimited ability stops when its consuming resource is exhausted");
  }

  {
    const state = game();
    const unsafe = makePermanent(state, "test_unsafe_loop", "player");
    state.players.player.permanents.push(unsafe);
    const validation = validateActivatedAbilityActivation(state, "player", unsafe.instanceId, 0);
    assert.equal(validation.ok, false, "zero-cost unlimited ability is rejected at runtime");
    assert.match(validation.reason ?? "", /consuming cost/i);

    const authored = validateAuthorableCardWithActivatedAbilities(cards.find((card) => card.defId === "test_unsafe_loop") as CardDef & Record<string, unknown>);
    assert.equal(authored.ok, false, "Studio authoring also rejects zero-cost unlimited loops");
  }

  {
    let state = game();
    const source = readyUnit(state, "test_death_scribe", "player");
    const handBefore = state.players.player.hand.length;
    state = activateAbility(state, "player", source.instanceId, 0);
    assert.equal(state.players.player.bench.some((unit) => unit.instanceId === source.instanceId), false, "sacrificed unit leaves play");
    assert.equal(state.players.player.hand.length, handBefore + 2, "onDeath resolves as sacrifice cost, then activated effect resolves");
  }

  {
    const state = game();
    const source = readyUnit(state, "test_arc_tender", "player");
    state.players.player.mana = 10;
    const hexproof = readyUnit(state, "test_target_dummy", "ai");
    hexproof.keywords.push("Hexproof");
    assert.equal(validateActivatedAbilityActivation(state, "player", source.instanceId, 0, hexproof.instanceId).ok, false, "Hexproof rejects enemy targeted ability");
    assert.equal(canBeginActivateAbility(state, "player", source.instanceId, 0), false, "no legal target disables activation preflight");
  }

  {
    let state = game();
    const source = readyUnit(state, "test_relic_breaker", "player");
    const enemyPermanent = makePermanent(state, "test_repeat_core", "ai");
    state.players.ai.permanents.push(enemyPermanent);
    assert.equal(canBeginActivateAbility(state, "player", source.instanceId, 0), true, "permanent-targeted ability has a legal target");
    state = activateAbility(state, "player", source.instanceId, 0, enemyPermanent.instanceId);
    assert.equal(state.players.ai.permanents.some((perm) => perm.instanceId === enemyPermanent.instanceId), false, "enemy permanent target is destroyed");
  }

  {
    let state = game();
    state.players.player.hand = [{ instanceId: "sen-card", defId: "sent_vulkar" }];
    state.players.player.mana = 10;
    state.players.player.maxMana = 10;
    state = applyGameAction(state, { type: "play", player: "player", instanceId: "sen-card" }, false).next;
    const sentinela = state.players.player.sentinelas[0];
    assert.ok(sentinela, "legacy Sentinela still enters play");
    const loyaltyBefore = sentinela.loyalty;
    assert.equal(canActivateSentinela(state, "player", sentinela.instanceId, 0), true, "legacy eligibility API preserves target-independent timing/cost semantics");
    state = activateSentinelaAbility(state, "player", sentinela.instanceId, 0);
    assert.equal(state.players.player.sentinelas[0].loyalty, loyaltyBefore + 1, "legacy loyalty delta is preserved");
    assert.equal(state.players.player.sentinelas[0].activatedThisTurn, true, "legacy once-per-round flag is preserved");
  }

  {
    let state = game();
    state.players.player.hand = [{ instanceId: "hybrid-card", defId: "test_hybrid_sentinel" }];
    state.players.player.mana = 10;
    state.players.player.maxMana = 10;
    state = applyGameAction(state, { type: "play", player: "player", instanceId: "hybrid-card" }, false).next;
    const sentinela = state.players.player.sentinelas[0];
    state = activateAbility(state, "player", sentinela.instanceId, 0);
    assert.equal(sentinela.defId, "test_hybrid_sentinel");
    assert.equal(canBeginActivateAbility(state, "player", sentinela.instanceId, 1), false, "generic Sentinela ability cannot bypass legacy activation already used this round");

    state = endTurn(state, "player");
    state = endTurn(state, "ai");
    state.activePlayer = "player";
    state.players.player.mana = 10;
    assert.equal(canBeginActivateAbility(state, "player", sentinela.instanceId, 1), true, "generic Sentinela ability becomes available next round");
    state = activateAbility(state, "player", sentinela.instanceId, 1);
    assert.equal(state.players.player.sentinelas[0].activatedThisTurn, true, "generic Sentinela activation consumes shared Sentinela budget");
    assert.equal(canActivateSentinela(state, "player", sentinela.instanceId, 0), false, "legacy ability cannot bypass generic activation in same round");
  }

  console.log("ACTIVATED ABILITIES: PASS");
} finally {
  clearRegisteredCustomCards();
}
