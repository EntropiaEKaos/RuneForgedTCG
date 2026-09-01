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
  recomputeContinuousAuras,
} from "./engine";
import { validateAuthorableCardWithSemanticTypes } from "./semantic-card-type-authoring";
import type { CardDef, MechanicCondition, PermanentStatAura, Race } from "./types";

const unitCard = (
  defId: string,
  race: Race,
  classes: string[] = [],
  secondaryRaces: Race[] = [],
): CardDef => ({
  defId,
  name: defId,
  region: "Ironwood",
  type: "Unit",
  cost: 2,
  power: 2,
  health: 4,
  race,
  ...(secondaryRaces.length ? { secondaryRaces } : {}),
  ...(classes.length ? { classes } : {}),
  description: "Condition 2.2 board identity test unit.",
  rarity: "Common",
  emoji: "🧭",
});

const auraCard = (aura: PermanentStatAura, defId: string): CardDef => ({
  defId,
  name: defId,
  region: "Ironwood",
  type: "Enchantment",
  cost: 2,
  maxHealth: 4,
  aura,
  description: "Condition 2.2 enemy-board Aura.",
  rarity: "Rare",
  emoji: "🜁",
});

const killSpell = (defId: string): CardDef => ({
  defId,
  name: defId,
  region: "Voidborn",
  type: "Spell",
  cost: 1,
  spell: { kind: "killUnit", amount: 0, target: "enemyUnit" },
  description: "Condition 2.2 authoritative removal spell.",
  rarity: "Common",
  emoji: "☠️",
});

assert.equal(MECHANIC_CONDITION_KINDS.includes("enemyRace"), true);
assert.equal(MECHANIC_CONDITION_KINDS.includes("enemyClass"), true);
assert.equal(CONDITION_RUNTIME_SUPPORT.enemyRace, "supported");
assert.equal(CONDITION_RUNTIME_SUPPORT.enemyClass, "supported");
assert.equal(conditionKindsAtDepth(0).includes("enemyRace"), true);
assert.equal(conditionKindsAtDepth(0).includes("enemyClass"), true);
assert.equal(ABILITY_GRAMMAR_CATALOG.conditions.includes("enemyRace"), true);
assert.equal(ABILITY_GRAMMAR_CATALOG.conditions.includes("enemyClass"), true);
assert.equal(ABILITY_GRAMMAR_CATALOG.conditionContracts.enemyRace, "supported");
assert.equal(ABILITY_GRAMMAR_CATALOG.conditionContracts.enemyClass, "supported");

assert.deepEqual(
  sanitizeMechanicCondition({ kind: "enemyRace", race: "Dragon", min: 99 }),
  { kind: "enemyRace", race: "Dragon", min: 6 },
  "enemy race shares the canonical 1..6 board-count clamp",
);
assert.deepEqual(
  sanitizeMechanicCondition({ kind: "enemyRace", race: "Dragon", min: 0 }),
  { kind: "enemyRace", race: "Dragon", min: 1 },
);
assert.deepEqual(
  sanitizeMechanicCondition({ kind: "enemyClass", classKey: "guardian", min: 2 }),
  { kind: "enemyClass", classKey: "guardian", min: 2 },
);
assert.equal(sanitizeMechanicCondition({ kind: "enemyRace", race: "UnknownRace", min: 1 }), null);
assert.equal(sanitizeMechanicCondition({ kind: "enemyClass", classKey: "Bad Class!", min: 1 }), null);

// Generic Mechanics conditions are controller-oriented and include multi-race identity.
withRegisteredCardSnapshot([
  unitCard("test_condition22_source", "Dragon", ["seer"]),
  unitCard("test_condition22_enemy_multi", "Spirit", ["guardian"], ["Dragon"]),
  unitCard("test_condition22_enemy_other", "Beast", ["warrior"]),
], () => {
  const state = createGame("Condition 2.2 Mechanics Orientation", DECKS[3], DECKS[2], true, 622001);
  state.players.player.bench = [];
  state.players.ai.bench = [];
  const playerSource = makeUnit(state, "test_condition22_source", "player");
  const aiSource = makeUnit(state, "test_condition22_source", "ai");
  const aiMulti = makeUnit(state, "test_condition22_enemy_multi", "ai");
  const playerMulti = makeUnit(state, "test_condition22_enemy_multi", "player");
  state.players.player.bench.push(playerSource, playerMulti);
  state.players.ai.bench.push(aiSource, aiMulti);

  assert.equal(
    mechanicConditionMatches(state, playerSource, { kind: "enemyRace", race: "Dragon", min: 1 }),
    true,
    "player source reads AI bench and recognizes secondary race identity",
  );
  assert.equal(
    mechanicConditionMatches(state, playerSource, { kind: "enemyClass", classKey: "guardian", min: 1 }),
    true,
    "player source reads enemy classes",
  );
  assert.equal(
    mechanicConditionMatches(state, aiSource, { kind: "enemyRace", race: "Dragon", min: 2 }),
    true,
    "AI source symmetrically reads the player bench",
  );

  aiMulti.health = 0;
  assert.equal(
    mechanicConditionMatches(state, playerSource, { kind: "enemyClass", classKey: "guardian", min: 1 }),
    false,
    "a lethal Unit no longer satisfies enemy identity before physical cleanup",
  );
  assert.equal(
    mechanicConditionMatches(state, playerSource, { kind: "enemyRace", race: "Dragon", min: 2 }),
    false,
    "the controller's own Dragon never counts toward enemyRace",
  );
});

// Boolean composition can combine allied and enemy board identity without a second evaluator.
withRegisteredCardSnapshot([
  unitCard("test_condition22_composite_source", "Spirit", ["mage"]),
  unitCard("test_condition22_composite_enemy", "Dragon", ["guardian"]),
], () => {
  const state = createGame("Condition 2.2 Composition", DECKS[3], DECKS[2], true, 622002);
  state.players.player.bench = [makeUnit(state, "test_condition22_composite_source", "player")];
  state.players.ai.bench = [makeUnit(state, "test_condition22_composite_enemy", "ai")];
  const source = state.players.player.bench[0];
  const condition: MechanicCondition = {
    kind: "and",
    children: [
      { kind: "allyClass", classKey: "mage", min: 1 },
      { kind: "enemyRace", race: "Dragon", min: 1 },
      { kind: "not", child: { kind: "enemyClass", classKey: "assassin", min: 1 } },
    ],
  };
  assert.equal(mechanicConditionMatches(state, source, condition), true);
  state.players.ai.bench[0].classes = ["guardian", "assassin"];
  assert.equal(mechanicConditionMatches(state, source, condition), false);
});

// Aura evaluation is symmetric for both controllers and ignores dead enemy Units.
withRegisteredCardSnapshot([
  unitCard("test_condition22_aura_ally", "Spirit"),
  unitCard("test_condition22_aura_enemy", "Dragon", ["guardian"]),
], () => {
  const state = createGame("Condition 2.2 Aura Orientation", DECKS[3], DECKS[2], true, 622003);
  state.players.player.bench = [makeUnit(state, "test_condition22_aura_ally", "player")];
  state.players.ai.bench = [makeUnit(state, "test_condition22_aura_enemy", "ai")];
  assert.equal(auraConditionMatches(state, "player", { kind: "enemyRace", race: "Dragon", min: 1 }), true);
  assert.equal(auraConditionMatches(state, "player", { kind: "enemyClass", classKey: "guardian", min: 1 }), true);
  assert.equal(auraConditionMatches(state, "ai", { kind: "enemyRace", race: "Spirit", min: 1 }), true);

  state.players.ai.bench[0].health = 0;
  assert.equal(auraConditionMatches(state, "player", { kind: "enemyRace", race: "Dragon", min: 1 }), false);
});

// Real authoritative removal crosses the board-identity boundary and disables the Aura in the same action.
withRegisteredCardSnapshot([
  auraCard({
    buffPower: 0,
    buffHealth: 0,
    keywords: ["Flying"],
    condition: { kind: "enemyRace", race: "Dragon", min: 1 },
  }, "test_condition22_transition_aura"),
  unitCard("test_condition22_transition_ally", "Spirit"),
  unitCard("test_condition22_transition_dragon", "Dragon", ["guardian"]),
  killSpell("test_condition22_kill"),
], () => {
  const state = createGame("Condition 2.2 Removal Transition", DECKS[3], DECKS[2], true, 622004);
  state.players.player.bench = [];
  state.players.ai.bench = [];
  state.players.player.permanents = [makePermanent(state, "test_condition22_transition_aura", "player")];
  const ally = makeUnit(state, "test_condition22_transition_ally", "player");
  const enemyDragon = makeUnit(state, "test_condition22_transition_dragon", "ai");
  state.players.player.bench.push(ally);
  state.players.ai.bench.push(enemyDragon);
  state.players.player.hand = [{ instanceId: "condition22_kill_card", defId: "test_condition22_kill" }];
  state.players.player.mana = 10;
  state.players.player.maxMana = 10;
  state.activePlayer = "player";
  state.phase = "main";
  recomputeContinuousAuras(state);
  assert.equal(ally.keywords.includes("Flying"), true, "enemy Dragon activates the source");

  const resolved = castSpell(state, "player", "condition22_kill_card", enemyDragon.instanceId);
  const resolvedAlly = resolved.players.player.bench.find((unit) => unit.instanceId === ally.instanceId)!;
  assert.equal(resolved.players.ai.bench.some((unit) => unit.instanceId === enemyDragon.instanceId), false, "targeted kill removes the qualifying enemy Unit");
  assert.equal(resolvedAlly.keywords.includes("Flying"), false, "same authoritative transition removes the source-bound grant");
});

// Semantic authoring and Ability Grammar preserve enemy board conditions exactly.
const authored = validateAuthorableCardWithSemanticTypes(auraCard({
  buffPower: 1,
  buffHealth: 0,
  condition: {
    kind: "and",
    children: [
      { kind: "enemyRace", race: "Dragon", min: 1 },
      { kind: "enemyClass", classKey: "guardian", min: 1 },
    ],
  },
}, "valid_condition22_aura"));
assert.equal(authored.ok, true);
assert.ok(authored.ok);
assert.deepEqual(authored.card.aura?.condition, {
  kind: "and",
  children: [
    { kind: "enemyRace", race: "Dragon", min: 1 },
    { kind: "enemyClass", classKey: "guardian", min: 1 },
  ],
});
const blueprint = blueprintFromPermanentStatAura(authored.card);
assert.ok(blueprint);
assert.deepEqual(blueprint.condition, authored.card.aura?.condition);
assert.equal(blueprint.features.includes("conditional"), true);

console.log("CONDITION SYSTEM 2.2: PASS — enemy race/class board identity, living-unit semantics, controller orientation, composition, Aura/Mechanics runtime, Studio contract and Ability Grammar certified");
