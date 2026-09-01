import assert from "node:assert/strict";
import "./aura-2-types";
import {
  ABILITY_GRAMMAR_CATALOG,
  blueprintFromPermanentStatAura,
} from "./ability-system";
import {
  CONDITIONAL_AURA_CONTRACT,
  auraConditionMatches,
} from "./aura-condition-contract";
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
  createGame,
  endTurn,
  makePermanent,
  makeUnit,
  mechanicConditionMatches,
  recomputeContinuousAuras,
} from "./engine";
import { validateAuthorableCardWithSemanticTypes } from "./semantic-card-type-authoring";
import type { CardDef, PermanentStatAura } from "./types";

const unitCard = (
  defId: string,
  mechanics?: CardDef["mechanics"],
): CardDef => ({
  defId,
  name: defId,
  region: "Ironwood",
  type: "Unit",
  cost: 1,
  power: 2,
  health: 4,
  race: "Spirit",
  ...(mechanics?.length ? { mechanics } : {}),
  description: "Condition 2.5 round-threshold test unit.",
  rarity: "Common",
  emoji: "⏳",
});

const auraCard = (aura: PermanentStatAura, defId: string): CardDef => ({
  defId,
  name: defId,
  region: "Ironwood",
  type: "Enchantment",
  cost: 2,
  maxHealth: 4,
  aura,
  description: "Condition 2.5 round-threshold Aura.",
  rarity: "Rare",
  emoji: "⌛",
});

assert.equal(MECHANIC_CONDITION_KINDS.includes("roundAtLeast"), true);
assert.equal(CONDITION_RUNTIME_SUPPORT.roundAtLeast, "supported");
assert.equal(conditionKindsAtDepth(0).includes("roundAtLeast"), true);
assert.equal(ABILITY_GRAMMAR_CATALOG.conditions.includes("roundAtLeast"), true);
assert.equal(ABILITY_GRAMMAR_CATALOG.conditionContracts.roundAtLeast, "supported");
assert.deepEqual(CONDITIONAL_AURA_CONTRACT.matchScopedConditions, ["roundAtLeast"]);

assert.deepEqual(
  sanitizeMechanicCondition({ kind: "roundAtLeast", amount: 0 }),
  { kind: "roundAtLeast", amount: 1 },
  "round threshold cannot target a pre-game round",
);
assert.deepEqual(
  sanitizeMechanicCondition({ kind: "roundAtLeast", amount: 9999 }),
  { kind: "roundAtLeast", amount: 2000 },
  "round threshold shares the authoritative max-round configuration envelope",
);
assert.deepEqual(
  sanitizeMechanicCondition({ kind: "not", child: { kind: "roundAtLeast", amount: 4 } }),
  { kind: "not", child: { kind: "roundAtLeast", amount: 4 } },
  "NOT expresses before-round-N without a redundant roundBelow leaf",
);

// Round is match-scoped: player and AI sources observe the same authoritative clock.
withRegisteredCardSnapshot([unitCard("test_condition25_clock_source")], () => {
  const state = createGame("Condition 2.5 Match Scope", DECKS[3], DECKS[2], true, 625001);
  state.players.player.bench = [makeUnit(state, "test_condition25_clock_source", "player")];
  state.players.ai.bench = [makeUnit(state, "test_condition25_clock_source", "ai")];
  const playerSource = state.players.player.bench[0];
  const aiSource = state.players.ai.bench[0];
  state.round = 4;

  assert.equal(mechanicConditionMatches(state, playerSource, { kind: "roundAtLeast", amount: 4 }), true);
  assert.equal(mechanicConditionMatches(state, aiSource, { kind: "roundAtLeast", amount: 4 }), true);
  assert.equal(mechanicConditionMatches(state, playerSource, { kind: "roundAtLeast", amount: 5 }), false);
  assert.equal(auraConditionMatches(state, "player", { kind: "roundAtLeast", amount: 4 }), true);
  assert.equal(auraConditionMatches(state, "ai", { kind: "roundAtLeast", amount: 4 }), true);
  assert.equal(
    mechanicConditionMatches(state, playerSource, { kind: "not", child: { kind: "roundAtLeast", amount: 5 } }),
    true,
  );
});

// Real round progression activates a continuous Aura at the exact authoritative boundary.
withRegisteredCardSnapshot([
  auraCard({ buffPower: 2, buffHealth: 0, condition: { kind: "roundAtLeast", amount: 3 } }, "test_condition25_round_aura"),
  unitCard("test_condition25_round_ally"),
], () => {
  const state = createGame("Condition 2.5 Round Lifecycle", DECKS[3], DECKS[2], true, 625002);
  state.players.player.bench = [];
  state.players.player.permanents = [makePermanent(state, "test_condition25_round_aura", "player")];
  const ally = makeUnit(state, "test_condition25_round_ally", "player");
  state.players.player.bench.push(ally);
  state.activePlayer = "player";
  state.attackToken = "player";
  state.phase = "main";
  recomputeContinuousAuras(state);

  assert.equal(state.round, 1);
  assert.equal(ally.power, 2, "round-three Aura begins inactive");

  const aiTurnRound1 = endTurn(state, "player");
  const round2 = endTurn(aiTurnRound1, "ai");
  const round2Ally = round2.players.player.bench.find((unit) => unit.instanceId === ally.instanceId)!;
  assert.equal(round2.round, 2);
  assert.equal(round2Ally.power, 2, "Aura remains inactive during round two");

  const aiTurnRound2 = endTurn(round2, "player");
  const round3 = endTurn(aiTurnRound2, "ai");
  const round3Ally = round3.players.player.bench.find((unit) => unit.instanceId === ally.instanceId)!;
  assert.equal(round3.round, 3);
  assert.equal(round3Ally.power, 4, "round transition recomputes and activates the Aura at round three");
});

// Authoring preserves round thresholds for both Mechanics and Continuous Auras.
const mechanicAuthored = validateAuthorableCard(unitCard("valid_condition25_mechanic", [{
  key: "late_game_engine",
  name: "Late Game Engine",
  trigger: "onRoundStart",
  condition: { kind: "roundAtLeast", amount: 6 },
  effect: { kind: "draw", amount: 1, target: "none" },
}]));
assert.equal(mechanicAuthored.ok, true);
assert.ok(mechanicAuthored.ok);
assert.deepEqual(mechanicAuthored.card.mechanics?.[0].condition, { kind: "roundAtLeast", amount: 6 });

const auraAuthored = validateAuthorableCardWithSemanticTypes(auraCard({
  buffPower: 1,
  buffHealth: 0,
  condition: {
    kind: "and",
    children: [
      { kind: "roundAtLeast", amount: 5 },
      { kind: "not", child: { kind: "enemyUnitsAtLeast", min: 6 } },
    ],
  },
}, "valid_condition25_aura"));
assert.equal(auraAuthored.ok, true);
assert.ok(auraAuthored.ok);
assert.deepEqual(auraAuthored.card.aura?.condition, {
  kind: "and",
  children: [
    { kind: "roundAtLeast", amount: 5 },
    { kind: "not", child: { kind: "enemyUnitsAtLeast", min: 6 } },
  ],
});

const blueprint = blueprintFromPermanentStatAura(auraAuthored.card);
assert.ok(blueprint);
assert.deepEqual(blueprint.condition, auraAuthored.card.aura?.condition);
assert.equal(blueprint.features.includes("conditional"), true);

console.log("CONDITION SYSTEM 2.5: PASS — match-scoped round thresholds, 1..2000 authoring, composition, authoritative round transition, Studio/Grammar integration certified");
