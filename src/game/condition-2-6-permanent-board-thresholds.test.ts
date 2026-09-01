import assert from "node:assert/strict";
import "./aura-2-types";
import {
  ABILITY_GRAMMAR_CATALOG,
  blueprintFromPermanentStatAura,
} from "./ability-system";
import { auraConditionMatches } from "./aura-condition-contract";
import {
  MECHANIC_CONDITION_KINDS,
  sanitizeMechanicCondition,
  validateAuthorableCard,
} from "./card-authoring";
import {
  CONDITION_RUNTIME_SUPPORT,
  conditionKindsAtDepth,
} from "./condition-contract";
import { withRegisteredCardSnapshot } from "./custom-registry";
import { DECKS } from "./decks";
import {
  cleanupDead,
  createGame,
  makePermanent,
  makeUnit,
  mechanicConditionMatches,
  playUnit,
  recomputeContinuousAuras,
} from "./engine";
import { validateAuthorableCardWithSemanticTypes } from "./semantic-card-type-authoring";
import type { CardDef, MechanicCondition, PermanentStatAura } from "./types";

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
  description: "Condition 2.6 permanent-board threshold test unit.",
  rarity: "Common",
  emoji: "🛡️",
});

const permanentCard = (
  defId: string,
  type: "Artifact" | "Enchantment" = "Artifact",
  aura?: PermanentStatAura,
  structure = false,
): CardDef => ({
  defId,
  name: defId,
  region: "Ironwood",
  type,
  cost: 1,
  maxHealth: 4,
  ...(aura ? { aura } : {}),
  ...(structure ? { archetypeKey: "structure", archetypeName: "Estrutura" } : {}),
  description: "Condition 2.6 test Permanent.",
  rarity: "Common",
  emoji: structure ? "🏰" : "⚙️",
});

assert.equal(MECHANIC_CONDITION_KINDS.includes("allyPermanentsAtLeast"), true);
assert.equal(MECHANIC_CONDITION_KINDS.includes("enemyPermanentsAtLeast"), true);
assert.equal(CONDITION_RUNTIME_SUPPORT.allyPermanentsAtLeast, "supported");
assert.equal(CONDITION_RUNTIME_SUPPORT.enemyPermanentsAtLeast, "supported");
assert.equal(conditionKindsAtDepth(0).includes("allyPermanentsAtLeast"), true);
assert.equal(conditionKindsAtDepth(0).includes("enemyPermanentsAtLeast"), true);
assert.equal(ABILITY_GRAMMAR_CATALOG.conditions.includes("allyPermanentsAtLeast"), true);
assert.equal(ABILITY_GRAMMAR_CATALOG.conditions.includes("enemyPermanentsAtLeast"), true);
assert.equal(ABILITY_GRAMMAR_CATALOG.conditionContracts.allyPermanentsAtLeast, "supported");
assert.equal(ABILITY_GRAMMAR_CATALOG.conditionContracts.enemyPermanentsAtLeast, "supported");

assert.deepEqual(
  sanitizeMechanicCondition({ kind: "allyPermanentsAtLeast", min: 99 }),
  { kind: "allyPermanentsAtLeast", min: 8 },
  "Permanent threshold follows the configurable permanentsCap authoring envelope 1..8",
);
assert.deepEqual(
  sanitizeMechanicCondition({ kind: "enemyPermanentsAtLeast", min: 0 }),
  { kind: "enemyPermanentsAtLeast", min: 1 },
);
assert.deepEqual(
  sanitizeMechanicCondition({ kind: "not", child: { kind: "enemyPermanentsAtLeast", min: 3 } }),
  { kind: "not", child: { kind: "enemyPermanentsAtLeast", min: 3 } },
);

// Generic Mechanics is controller-oriented, counts only living Permanents, includes Structures,
// and never reads Sentinelas because they live in their own zone.
withRegisteredCardSnapshot([
  unitCard("test_condition26_source"),
  permanentCard("test_condition26_artifact"),
  permanentCard("test_condition26_structure", "Artifact", undefined, true),
  permanentCard("test_condition26_enemy_a", "Enchantment"),
  permanentCard("test_condition26_enemy_b", "Artifact"),
], () => {
  const state = createGame("Condition 2.6 Mechanics Orientation", DECKS[3], DECKS[2], true, 626001);
  const playerSource = makeUnit(state, "test_condition26_source", "player");
  const aiSource = makeUnit(state, "test_condition26_source", "ai");
  state.players.player.bench = [playerSource];
  state.players.ai.bench = [aiSource];
  state.players.player.permanents = [
    makePermanent(state, "test_condition26_artifact", "player"),
    makePermanent(state, "test_condition26_structure", "player"),
  ];
  state.players.ai.permanents = [
    makePermanent(state, "test_condition26_enemy_a", "ai"),
    makePermanent(state, "test_condition26_enemy_b", "ai"),
  ];
  state.players.player.sentinelas = [{
    instanceId: "condition26_sentinela",
    defId: "irrelevant_sentinela",
    owner: "player",
    loyalty: 5,
    activatedThisTurn: false,
  }];

  assert.equal(mechanicConditionMatches(state, playerSource, { kind: "allyPermanentsAtLeast", min: 2 }), true, "Artifact-backed Structure counts as a Permanent");
  assert.equal(mechanicConditionMatches(state, playerSource, { kind: "allyPermanentsAtLeast", min: 3 }), false, "Sentinela remains outside the Permanent count");
  assert.equal(mechanicConditionMatches(state, playerSource, { kind: "enemyPermanentsAtLeast", min: 2 }), true);
  assert.equal(mechanicConditionMatches(state, aiSource, { kind: "enemyPermanentsAtLeast", min: 2 }), true, "AI observes the player Permanent board symmetrically");

  state.players.ai.permanents[1].health = 0;
  assert.equal(mechanicConditionMatches(state, playerSource, { kind: "enemyPermanentsAtLeast", min: 2 }), false, "lethal Permanent does not count before physical cleanup");
  const composed: MechanicCondition = {
    kind: "and",
    children: [
      { kind: "allyPermanentsAtLeast", min: 2 },
      { kind: "not", child: { kind: "enemyPermanentsAtLeast", min: 2 } },
    ],
  };
  assert.equal(mechanicConditionMatches(state, playerSource, composed), true);
});

// Aura evaluator shares the same controller/opponent orientation and living-Permanent rule.
withRegisteredCardSnapshot([
  permanentCard("test_condition26_aura_probe"),
  permanentCard("test_condition26_aura_enemy", "Enchantment"),
], () => {
  const state = createGame("Condition 2.6 Aura Orientation", DECKS[3], DECKS[2], true, 626002);
  state.players.player.permanents = [makePermanent(state, "test_condition26_aura_probe", "player")];
  state.players.ai.permanents = [makePermanent(state, "test_condition26_aura_enemy", "ai")];
  assert.equal(auraConditionMatches(state, "player", { kind: "allyPermanentsAtLeast", min: 1 }), true);
  assert.equal(auraConditionMatches(state, "player", { kind: "enemyPermanentsAtLeast", min: 1 }), true);
  state.players.ai.permanents[0].health = 0;
  assert.equal(auraConditionMatches(state, "player", { kind: "enemyPermanentsAtLeast", min: 1 }), false);
});

// A real Structure entry crosses the threshold immediately; cleanupDead crosses it back down
// and recomputes the Aura in the same stabilization cycle.
withRegisteredCardSnapshot([
  permanentCard("test_condition26_threshold_aura", "Enchantment", {
    buffPower: 2,
    buffHealth: 0,
    condition: { kind: "allyPermanentsAtLeast", min: 2 },
  }),
  permanentCard("test_condition26_entering_structure", "Artifact", undefined, true),
  unitCard("test_condition26_ally"),
], () => {
  const state = createGame("Condition 2.6 Permanent Lifecycle", DECKS[3], DECKS[2], true, 626003);
  state.players.player.bench = [];
  state.players.player.permanents = [makePermanent(state, "test_condition26_threshold_aura", "player")];
  const ally = makeUnit(state, "test_condition26_ally", "player");
  state.players.player.bench.push(ally);
  state.players.player.hand = [{ instanceId: "condition26_structure_hand", defId: "test_condition26_entering_structure" }];
  state.players.player.mana = 10;
  state.players.player.maxMana = 10;
  state.activePlayer = "player";
  state.phase = "main";
  recomputeContinuousAuras(state);
  assert.equal(ally.power, 2, "Aura source alone is one living Permanent and leaves threshold 2 inactive");

  const resolved = playUnit(state, "player", "condition26_structure_hand");
  const powered = resolved.players.player.bench.find((unit) => unit.instanceId === ally.instanceId)!;
  assert.equal(resolved.players.player.permanents.filter((permanent) => permanent.health > 0).length, 2);
  assert.equal(powered.power, 4, "Structure entry activates the Aura in the returned authoritative state");

  const structure = resolved.players.player.permanents.find((permanent) => permanent.defId === "test_condition26_entering_structure")!;
  structure.health = 0;
  cleanupDead(resolved);
  const stabilized = resolved.players.player.bench.find((unit) => unit.instanceId === ally.instanceId)!;
  assert.equal(resolved.players.player.permanents.filter((permanent) => permanent.health > 0).length, 1);
  assert.equal(stabilized.power, 2, "cleanupDead removes the lethal Permanent and disables the Aura in the same stabilization cycle");
});

// Authoring + Ability Grammar preserve both Permanent-threshold leaves through composition.
const mechanicAuthored = validateAuthorableCard(unitCard("valid_condition26_mechanic", [{
  key: "fortress_watch",
  name: "Fortress Watch",
  trigger: "onRoundStart",
  condition: { kind: "enemyPermanentsAtLeast", min: 3 },
  effect: { kind: "draw", amount: 1, target: "none" },
}]));
assert.equal(mechanicAuthored.ok, true);
assert.ok(mechanicAuthored.ok);
assert.deepEqual(mechanicAuthored.card.mechanics?.[0].condition, { kind: "enemyPermanentsAtLeast", min: 3 });

const auraAuthored = validateAuthorableCardWithSemanticTypes(permanentCard(
  "valid_condition26_aura",
  "Enchantment",
  {
    buffPower: 1,
    buffHealth: 0,
    condition: {
      kind: "and",
      children: [
        { kind: "allyPermanentsAtLeast", min: 2 },
        { kind: "not", child: { kind: "enemyPermanentsAtLeast", min: 5 } },
      ],
    },
  },
));
assert.equal(auraAuthored.ok, true);
assert.ok(auraAuthored.ok);
assert.deepEqual(auraAuthored.card.aura?.condition, {
  kind: "and",
  children: [
    { kind: "allyPermanentsAtLeast", min: 2 },
    { kind: "not", child: { kind: "enemyPermanentsAtLeast", min: 5 } },
  ],
});
const blueprint = blueprintFromPermanentStatAura(auraAuthored.card);
assert.ok(blueprint);
assert.deepEqual(blueprint.condition, auraAuthored.card.aura?.condition);
assert.equal(blueprint.features.includes("conditional"), true);

console.log("CONDITION SYSTEM 2.6: PASS — living allied/enemy Permanent thresholds, 1..8 authoring envelope, Structures, Sentinela exclusion, composition, immediate entry/cleanup Aura lifecycle, authoring and Ability Grammar certified");
