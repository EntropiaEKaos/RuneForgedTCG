import assert from "node:assert/strict";
import "./aura-2-types";
import { ABILITY_GRAMMAR_CATALOG, blueprintFromPermanentStatAura } from "./ability-system";
import { auraConditionMatches } from "./aura-condition-contract";
import { MECHANIC_CONDITION_KINDS, sanitizeMechanicCondition, validateAuthorableCard } from "./card-authoring";
import { CONDITION_RUNTIME_SUPPORT, conditionKindsAtDepth } from "./condition-contract";
import { withRegisteredCardSnapshot } from "./custom-registry";
import { DECKS } from "./decks";
import { createGame, makePermanent, makeUnit, mechanicConditionMatches, playUnit, recomputeContinuousAuras } from "./engine";
import { cleanupSentinelas } from "./engine/sentinela-state";
import { validateAuthorableCardWithSemanticTypes } from "./semantic-card-type-authoring";
import type { CardDef, PermanentStatAura, SentinelaInstance } from "./types";

const unitCard = (defId: string, mechanics?: CardDef["mechanics"]): CardDef => ({
  defId,
  name: defId,
  region: "Ironwood",
  type: "Unit",
  cost: 1,
  power: 2,
  health: 4,
  race: "Spirit",
  ...(mechanics?.length ? { mechanics } : {}),
  description: "Condition 2.8 Sentinela-board threshold test unit.",
  rarity: "Common",
  emoji: "🛡️",
});

const sentinelaCard = (defId: string, aura?: PermanentStatAura): CardDef => ({
  defId,
  name: defId,
  region: "Ironwood",
  type: "Sentinela",
  cost: 2,
  ...(aura ? { aura } : {}),
  description: "Condition 2.8 test Sentinela.",
  rarity: "Legend",
  emoji: "🜲",
  sentinela: {
    startingLoyalty: 3,
    abilities: [{
      cost: 1,
      description: "+1: compre 1.",
      effect: { kind: "draw", amount: 1, target: "none" },
    }],
  },
});

const permanentCard = (defId: string, aura: PermanentStatAura): CardDef => ({
  defId,
  name: defId,
  region: "Ironwood",
  type: "Enchantment",
  cost: 2,
  maxHealth: 4,
  aura,
  description: "Condition 2.8 threshold Aura.",
  rarity: "Rare",
  emoji: "🔭",
});

const sentinelaInstance = (defId: string, owner: "player" | "ai", loyalty = 3, instanceId = `sen_${defId}_${owner}`): SentinelaInstance => ({
  instanceId,
  defId,
  owner,
  loyalty,
  activatedThisTurn: false,
});

for (const kind of ["allySentinelasAtLeast", "enemySentinelasAtLeast"] as const) {
  assert.equal(MECHANIC_CONDITION_KINDS.includes(kind), true);
  assert.equal(CONDITION_RUNTIME_SUPPORT[kind], "supported");
  assert.equal(conditionKindsAtDepth(0).includes(kind), true);
  assert.equal(ABILITY_GRAMMAR_CATALOG.conditions.includes(kind), true);
  assert.equal(ABILITY_GRAMMAR_CATALOG.conditionContracts[kind], "supported");
}

assert.deepEqual(sanitizeMechanicCondition({ kind: "allySentinelasAtLeast", min: 99 }), { kind: "allySentinelasAtLeast", min: 20 });
assert.deepEqual(sanitizeMechanicCondition({ kind: "enemySentinelasAtLeast", min: 0 }), { kind: "enemySentinelasAtLeast", min: 1 });
assert.deepEqual(
  sanitizeMechanicCondition({ kind: "not", child: { kind: "enemySentinelasAtLeast", min: 2 } }),
  { kind: "not", child: { kind: "enemySentinelasAtLeast", min: 2 } },
);

withRegisteredCardSnapshot([unitCard("test_condition28_source"), sentinelaCard("test_condition28_sentinel")], () => {
  const state = createGame("Condition 2.8 Mechanics", DECKS[3], DECKS[2], true, 628001);
  const playerSource = makeUnit(state, "test_condition28_source", "player");
  const aiSource = makeUnit(state, "test_condition28_source", "ai");
  state.players.player.bench = [playerSource];
  state.players.ai.bench = [aiSource];
  state.players.player.sentinelas = [
    sentinelaInstance("test_condition28_sentinel", "player", 3, "condition28_player_live"),
    sentinelaInstance("test_condition28_sentinel", "player", 0, "condition28_player_zero"),
  ];
  state.players.ai.sentinelas = [
    sentinelaInstance("test_condition28_sentinel", "ai", 2, "condition28_ai_live"),
    sentinelaInstance("test_condition28_sentinel", "ai", 0, "condition28_ai_zero"),
  ];

  assert.equal(mechanicConditionMatches(state, playerSource, { kind: "allySentinelasAtLeast", min: 1 }), true);
  assert.equal(mechanicConditionMatches(state, playerSource, { kind: "allySentinelasAtLeast", min: 2 }), false, "zero-loyalty ally does not count before cleanup");
  assert.equal(mechanicConditionMatches(state, playerSource, { kind: "enemySentinelasAtLeast", min: 1 }), true);
  assert.equal(mechanicConditionMatches(state, aiSource, { kind: "enemySentinelasAtLeast", min: 1 }), true, "AI observes the player Sentinela zone symmetrically");

  state.players.ai.sentinelas[0].loyalty = 0;
  assert.equal(mechanicConditionMatches(state, playerSource, { kind: "enemySentinelasAtLeast", min: 1 }), false, "loyalty zero fails closed before physical cleanup");
  assert.equal(mechanicConditionMatches(state, playerSource, {
    kind: "and",
    children: [
      { kind: "allySentinelasAtLeast", min: 1 },
      { kind: "not", child: { kind: "enemySentinelasAtLeast", min: 1 } },
    ],
  }), true);
});

withRegisteredCardSnapshot([sentinelaCard("test_condition28_aura_probe")], () => {
  const state = createGame("Condition 2.8 Aura Orientation", DECKS[3], DECKS[2], true, 628002);
  state.players.player.sentinelas = [sentinelaInstance("test_condition28_aura_probe", "player", 1)];
  state.players.ai.sentinelas = [sentinelaInstance("test_condition28_aura_probe", "ai", 1)];
  assert.equal(auraConditionMatches(state, "player", { kind: "allySentinelasAtLeast", min: 1 }), true);
  assert.equal(auraConditionMatches(state, "player", { kind: "enemySentinelasAtLeast", min: 1 }), true);
  state.players.ai.sentinelas[0].loyalty = 0;
  assert.equal(auraConditionMatches(state, "player", { kind: "enemySentinelasAtLeast", min: 1 }), false);
});

// A Sentinela Aura source counts itself while loyalty is positive.
withRegisteredCardSnapshot([
  sentinelaCard("test_condition28_self_count_command", {
    buffPower: 2,
    buffHealth: 0,
    condition: { kind: "allySentinelasAtLeast", min: 1 },
  }),
  unitCard("test_condition28_self_count_ally"),
], () => {
  const state = createGame("Condition 2.8 Self Count", DECKS[3], DECKS[2], true, 628003);
  const ally = makeUnit(state, "test_condition28_self_count_ally", "player");
  state.players.player.bench = [ally];
  state.players.player.sentinelas = [sentinelaInstance("test_condition28_self_count_command", "player", 3)];
  recomputeContinuousAuras(state);
  assert.equal(ally.power, 4, "living Sentinela Aura source satisfies allySentinelasAtLeast:1 with itself");
});

// Real entry and exit: playUnit crosses upward; cleanup of a non-Aura Sentinela crosses downward.
withRegisteredCardSnapshot([
  permanentCard("test_condition28_threshold_aura", {
    buffPower: 2,
    buffHealth: 0,
    condition: { kind: "allySentinelasAtLeast", min: 1 },
  }),
  sentinelaCard("test_condition28_entering_sentinel"),
  unitCard("test_condition28_lifecycle_ally"),
], () => {
  const state = createGame("Condition 2.8 Lifecycle", DECKS[3], DECKS[2], true, 628004);
  const ally = makeUnit(state, "test_condition28_lifecycle_ally", "player");
  state.players.player.bench = [ally];
  state.players.player.permanents = [makePermanent(state, "test_condition28_threshold_aura", "player")];
  state.players.player.sentinelas = [];
  state.players.player.hand = [{ instanceId: "condition28_sentinel_hand", defId: "test_condition28_entering_sentinel" }];
  state.players.player.mana = 10;
  state.players.player.maxMana = 10;
  state.activePlayer = "player";
  state.phase = "main";
  recomputeContinuousAuras(state);
  assert.equal(ally.power, 2, "Aura starts inactive with no living Sentinela");

  const entered = playUnit(state, "player", "condition28_sentinel_hand");
  const powered = entered.players.player.bench.find((unit) => unit.instanceId === ally.instanceId)!;
  assert.equal(entered.players.player.sentinelas.filter((sentinela) => sentinela.loyalty > 0).length, 1);
  assert.equal(powered.power, 4, "Sentinela entry activates the conditional Aura in the authoritative returned state");

  entered.players.player.sentinelas[0].loyalty = 0;
  assert.equal(auraConditionMatches(entered, "player", { kind: "allySentinelasAtLeast", min: 1 }), false, "zero loyalty fails before cleanup");
  cleanupSentinelas(entered);
  const stabilized = entered.players.player.bench.find((unit) => unit.instanceId === ally.instanceId)!;
  assert.equal(entered.players.player.sentinelas.length, 0);
  assert.equal(stabilized.power, 2, "cleanup of a non-Aura Sentinela disables threshold Aura in the same transition");
});

const mechanicAuthored = validateAuthorableCard(unitCard("valid_condition28_mechanic", [{
  key: "sentinel_watch",
  name: "Sentinel Watch",
  trigger: "onRoundStart",
  condition: { kind: "enemySentinelasAtLeast", min: 1 },
  effect: { kind: "draw", amount: 1, target: "none" },
}]));
assert.equal(mechanicAuthored.ok, true);
assert.ok(mechanicAuthored.ok);
assert.deepEqual(mechanicAuthored.card.mechanics?.[0].condition, { kind: "enemySentinelasAtLeast", min: 1 });

const auraAuthored = validateAuthorableCardWithSemanticTypes(permanentCard("valid_condition28_aura", {
  buffPower: 1,
  buffHealth: 0,
  condition: {
    kind: "and",
    children: [
      { kind: "allySentinelasAtLeast", min: 1 },
      { kind: "not", child: { kind: "enemySentinelasAtLeast", min: 2 } },
    ],
  },
}));
assert.equal(auraAuthored.ok, true);
assert.ok(auraAuthored.ok);
assert.deepEqual(auraAuthored.card.aura?.condition, {
  kind: "and",
  children: [
    { kind: "allySentinelasAtLeast", min: 1 },
    { kind: "not", child: { kind: "enemySentinelasAtLeast", min: 2 } },
  ],
});

const commandAuthored = validateAuthorableCardWithSemanticTypes(sentinelaCard("valid_condition28_command", {
  buffPower: 1,
  buffHealth: 0,
  condition: { kind: "allySentinelasAtLeast", min: 1 },
}));
assert.equal(commandAuthored.ok, true);
assert.ok(commandAuthored.ok);
assert.deepEqual(commandAuthored.card.aura?.condition, { kind: "allySentinelasAtLeast", min: 1 });
const blueprint = blueprintFromPermanentStatAura(commandAuthored.card);
assert.ok(blueprint);
assert.deepEqual(blueprint.condition, commandAuthored.card.aura?.condition);
assert.equal(blueprint.features.includes("conditional"), true);

console.log("CONDITION SYSTEM 2.8: PASS — living allied/enemy Sentinela thresholds, loyalty > 0 semantics, self-counting command source, real entry/cleanup Aura lifecycle, authoring and Ability Grammar certified");
