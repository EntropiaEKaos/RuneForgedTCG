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
  castSpell,
  createGame,
  makePermanent,
  makeUnit,
  mechanicConditionMatches,
  playUnit,
  recomputeContinuousAuras,
} from "./engine";
import { validateAuthorableCardWithSemanticTypes } from "./semantic-card-type-authoring";
import type { CardDef, MechanicCondition, PermanentStatAura, Race } from "./types";

const unitCard = (
  defId: string,
  race: Race = "Spirit",
  mechanics?: CardDef["mechanics"],
): CardDef => ({
  defId,
  name: defId,
  region: "Ironwood",
  type: "Unit",
  cost: 1,
  power: 2,
  health: 4,
  race,
  ...(mechanics?.length ? { mechanics } : {}),
  description: "Condition 2.4 living board-size test unit.",
  rarity: "Common",
  emoji: "🛡️",
});

const auraCard = (aura: PermanentStatAura, defId: string): CardDef => ({
  defId,
  name: defId,
  region: "Ironwood",
  type: "Enchantment",
  cost: 2,
  maxHealth: 4,
  aura,
  description: "Condition 2.4 board-size Aura.",
  rarity: "Rare",
  emoji: "⚔️",
});

const killSpell = (defId: string): CardDef => ({
  defId,
  name: defId,
  region: "Voidborn",
  type: "Spell",
  cost: 1,
  spell: { kind: "killUnit", amount: 0, target: "enemyUnit" },
  description: "Condition 2.4 authoritative removal spell.",
  rarity: "Common",
  emoji: "☠️",
});

assert.equal(MECHANIC_CONDITION_KINDS.includes("allyUnitsAtLeast"), true);
assert.equal(MECHANIC_CONDITION_KINDS.includes("enemyUnitsAtLeast"), true);
assert.equal(CONDITION_RUNTIME_SUPPORT.allyUnitsAtLeast, "supported");
assert.equal(CONDITION_RUNTIME_SUPPORT.enemyUnitsAtLeast, "supported");
assert.equal(conditionKindsAtDepth(0).includes("allyUnitsAtLeast"), true);
assert.equal(conditionKindsAtDepth(0).includes("enemyUnitsAtLeast"), true);
assert.equal(ABILITY_GRAMMAR_CATALOG.conditions.includes("allyUnitsAtLeast"), true);
assert.equal(ABILITY_GRAMMAR_CATALOG.conditions.includes("enemyUnitsAtLeast"), true);
assert.equal(ABILITY_GRAMMAR_CATALOG.conditionContracts.allyUnitsAtLeast, "supported");
assert.equal(ABILITY_GRAMMAR_CATALOG.conditionContracts.enemyUnitsAtLeast, "supported");

assert.deepEqual(
  sanitizeMechanicCondition({ kind: "allyUnitsAtLeast", min: 99 }),
  { kind: "allyUnitsAtLeast", min: 6 },
  "allied board-size threshold shares the canonical 1..6 living-board envelope",
);
assert.deepEqual(
  sanitizeMechanicCondition({ kind: "enemyUnitsAtLeast", min: 0 }),
  { kind: "enemyUnitsAtLeast", min: 1 },
);
assert.deepEqual(
  sanitizeMechanicCondition({ kind: "not", child: { kind: "enemyUnitsAtLeast", min: 3 } }),
  { kind: "not", child: { kind: "enemyUnitsAtLeast", min: 3 } },
  "NOT provides the complementary below-board-size predicate without another leaf kind",
);

// Generic Mechanics evaluation is controller-oriented and counts living Units only.
withRegisteredCardSnapshot([
  unitCard("test_condition24_source"),
  unitCard("test_condition24_body_a", "Dragon"),
  unitCard("test_condition24_body_b", "Beast"),
], () => {
  const state = createGame("Condition 2.4 Mechanics Orientation", DECKS[3], DECKS[2], true, 624001);
  const playerSource = makeUnit(state, "test_condition24_source", "player");
  const playerBody = makeUnit(state, "test_condition24_body_a", "player");
  const aiSource = makeUnit(state, "test_condition24_source", "ai");
  const aiBody = makeUnit(state, "test_condition24_body_b", "ai");
  state.players.player.bench = [playerSource, playerBody];
  state.players.ai.bench = [aiSource, aiBody];

  assert.equal(mechanicConditionMatches(state, playerSource, { kind: "allyUnitsAtLeast", min: 2 }), true);
  assert.equal(mechanicConditionMatches(state, playerSource, { kind: "enemyUnitsAtLeast", min: 2 }), true);
  assert.equal(mechanicConditionMatches(state, aiSource, { kind: "enemyUnitsAtLeast", min: 2 }), true, "AI source reads the player board symmetrically");

  aiBody.health = 0;
  assert.equal(
    mechanicConditionMatches(state, playerSource, { kind: "enemyUnitsAtLeast", min: 2 }),
    false,
    "a lethal enemy body does not count before physical cleanup",
  );
  assert.equal(
    mechanicConditionMatches(state, aiSource, { kind: "allyUnitsAtLeast", min: 2 }),
    false,
    "a lethal allied body does not count for the AI controller either",
  );

  const playerBelowThree: MechanicCondition = { kind: "not", child: { kind: "allyUnitsAtLeast", min: 3 } };
  assert.equal(mechanicConditionMatches(state, playerSource, playerBelowThree), true);
});

// Aura evaluation uses the same living-unit and controller/opponent orientation.
withRegisteredCardSnapshot([
  unitCard("test_condition24_aura_player"),
  unitCard("test_condition24_aura_ai", "Dragon"),
], () => {
  const state = createGame("Condition 2.4 Aura Orientation", DECKS[3], DECKS[2], true, 624002);
  const p1 = makeUnit(state, "test_condition24_aura_player", "player");
  const p2 = makeUnit(state, "test_condition24_aura_player", "player");
  const a1 = makeUnit(state, "test_condition24_aura_ai", "ai");
  const a2 = makeUnit(state, "test_condition24_aura_ai", "ai");
  state.players.player.bench = [p1, p2];
  state.players.ai.bench = [a1, a2];

  assert.equal(auraConditionMatches(state, "player", { kind: "allyUnitsAtLeast", min: 2 }), true);
  assert.equal(auraConditionMatches(state, "player", { kind: "enemyUnitsAtLeast", min: 2 }), true);
  assert.equal(auraConditionMatches(state, "ai", { kind: "enemyUnitsAtLeast", min: 2 }), true);
  a2.health = 0;
  assert.equal(auraConditionMatches(state, "player", { kind: "enemyUnitsAtLeast", min: 2 }), false);
});

// A real summon crosses upward through the allied board threshold and activates the Aura immediately.
withRegisteredCardSnapshot([
  auraCard({ buffPower: 2, buffHealth: 0, condition: { kind: "allyUnitsAtLeast", min: 2 } }, "test_condition24_swarm_aura"),
  unitCard("test_condition24_swarm_ally"),
  unitCard("test_condition24_swarm_summon", "Beast"),
], () => {
  const state = createGame("Condition 2.4 Swarm Transition", DECKS[3], DECKS[2], true, 624003);
  state.players.player.bench = [];
  state.players.player.permanents = [makePermanent(state, "test_condition24_swarm_aura", "player")];
  const ally = makeUnit(state, "test_condition24_swarm_ally", "player");
  state.players.player.bench.push(ally);
  state.players.player.hand = [{ instanceId: "condition24_summon", defId: "test_condition24_swarm_summon" }];
  state.players.player.mana = 10;
  state.players.player.maxMana = 10;
  state.activePlayer = "player";
  state.phase = "main";
  recomputeContinuousAuras(state);
  assert.equal(ally.power, 2, "one living ally leaves the swarm Aura inactive");

  const resolved = playUnit(state, "player", "condition24_summon");
  const resolvedAlly = resolved.players.player.bench.find((unit) => unit.instanceId === ally.instanceId)!;
  assert.equal(resolved.players.player.bench.filter((unit) => unit.health > 0).length, 2);
  assert.equal(resolvedAlly.power, 4, "summoning the second living Unit activates the Aura in the returned state");
});

// A real removal crosses downward through the enemy threshold and disables anti-swarm in the same resolution.
withRegisteredCardSnapshot([
  auraCard({ buffPower: 0, buffHealth: 0, keywords: ["Flying"], condition: { kind: "enemyUnitsAtLeast", min: 2 } }, "test_condition24_antiswarm_aura"),
  unitCard("test_condition24_antiswarm_ally"),
  unitCard("test_condition24_enemy_a", "Dragon"),
  unitCard("test_condition24_enemy_b", "Beast"),
  killSpell("test_condition24_kill"),
], () => {
  const state = createGame("Condition 2.4 Anti-Swarm Transition", DECKS[3], DECKS[2], true, 624004);
  state.players.player.bench = [];
  state.players.ai.bench = [];
  state.players.player.permanents = [makePermanent(state, "test_condition24_antiswarm_aura", "player")];
  const ally = makeUnit(state, "test_condition24_antiswarm_ally", "player");
  const enemyA = makeUnit(state, "test_condition24_enemy_a", "ai");
  const enemyB = makeUnit(state, "test_condition24_enemy_b", "ai");
  state.players.player.bench.push(ally);
  state.players.ai.bench.push(enemyA, enemyB);
  state.players.player.hand = [{ instanceId: "condition24_kill", defId: "test_condition24_kill" }];
  state.players.player.mana = 10;
  state.players.player.maxMana = 10;
  state.activePlayer = "player";
  state.phase = "main";
  recomputeContinuousAuras(state);
  assert.equal(ally.keywords.includes("Flying"), true, "two living enemies activate anti-swarm");

  const resolved = castSpell(state, "player", "condition24_kill", enemyB.instanceId);
  const resolvedAlly = resolved.players.player.bench.find((unit) => unit.instanceId === ally.instanceId)!;
  assert.equal(resolved.players.ai.bench.filter((unit) => unit.health > 0).length, 1);
  assert.equal(resolvedAlly.keywords.includes("Flying"), false, "removing one enemy disables the source-bound grant in the same resolution");
});

// Authoring preserves board-size conditions for Mechanics and Continuous Auras.
const mechanicAuthored = validateAuthorableCard(unitCard("valid_condition24_mechanic", "Spirit", [{
  key: "crowd_watch",
  name: "Crowd Watch",
  trigger: "onRoundStart",
  condition: { kind: "enemyUnitsAtLeast", min: 3 },
  effect: { kind: "draw", amount: 1, target: "none" },
}]));
assert.equal(mechanicAuthored.ok, true);
assert.ok(mechanicAuthored.ok);
assert.deepEqual(mechanicAuthored.card.mechanics?.[0].condition, { kind: "enemyUnitsAtLeast", min: 3 });

const auraAuthored = validateAuthorableCardWithSemanticTypes(auraCard({
  buffPower: 1,
  buffHealth: 0,
  condition: {
    kind: "and",
    children: [
      { kind: "allyUnitsAtLeast", min: 2 },
      { kind: "not", child: { kind: "enemyUnitsAtLeast", min: 5 } },
    ],
  },
}, "valid_condition24_aura"));
assert.equal(auraAuthored.ok, true);
assert.ok(auraAuthored.ok);
assert.deepEqual(auraAuthored.card.aura?.condition, {
  kind: "and",
  children: [
    { kind: "allyUnitsAtLeast", min: 2 },
    { kind: "not", child: { kind: "enemyUnitsAtLeast", min: 5 } },
  ],
});
const blueprint = blueprintFromPermanentStatAura(auraAuthored.card);
assert.ok(blueprint);
assert.deepEqual(blueprint.condition, auraAuthored.card.aura?.condition);
assert.equal(blueprint.features.includes("conditional"), true);

console.log("CONDITION SYSTEM 2.4: PASS — living allied/enemy board-size thresholds, controller orientation, lethal-body semantics, composition, authoritative summon/removal transitions, authoring and Ability Grammar certified");
