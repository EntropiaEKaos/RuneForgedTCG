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
  description: "Condition 2.3 hand-size test unit.",
  rarity: "Common",
  emoji: "🖐️",
});

const auraCard = (aura: PermanentStatAura, defId: string): CardDef => ({
  defId,
  name: defId,
  region: "Ironwood",
  type: "Enchantment",
  cost: 2,
  maxHealth: 4,
  aura,
  description: "Condition 2.3 hand-size Aura.",
  rarity: "Rare",
  emoji: "📚",
});

const drawSpell = (defId: string, amount: number): CardDef => ({
  defId,
  name: defId,
  region: "Tidecall",
  type: "Spell",
  cost: 1,
  spell: { kind: "draw", amount, target: "none" },
  description: "Condition 2.3 authoritative draw spell.",
  rarity: "Common",
  emoji: "✨",
});

assert.equal(MECHANIC_CONDITION_KINDS.includes("handAtLeast"), true);
assert.equal(MECHANIC_CONDITION_KINDS.includes("opponentHandAtLeast"), true);
assert.equal(CONDITION_RUNTIME_SUPPORT.handAtLeast, "supported");
assert.equal(CONDITION_RUNTIME_SUPPORT.opponentHandAtLeast, "supported");
assert.equal(conditionKindsAtDepth(0).includes("handAtLeast"), true);
assert.equal(conditionKindsAtDepth(0).includes("opponentHandAtLeast"), true);
assert.equal(ABILITY_GRAMMAR_CATALOG.conditions.includes("handAtLeast"), true);
assert.equal(ABILITY_GRAMMAR_CATALOG.conditions.includes("opponentHandAtLeast"), true);
assert.equal(ABILITY_GRAMMAR_CATALOG.conditionContracts.handAtLeast, "supported");
assert.equal(ABILITY_GRAMMAR_CATALOG.conditionContracts.opponentHandAtLeast, "supported");

assert.deepEqual(
  sanitizeMechanicCondition({ kind: "handAtLeast", amount: 99 }),
  { kind: "handAtLeast", amount: 20 },
  "hand threshold shares the canonical 0..20 numeric envelope",
);
assert.deepEqual(
  sanitizeMechanicCondition({ kind: "opponentHandAtLeast", amount: -4 }),
  { kind: "opponentHandAtLeast", amount: 0 },
);
assert.deepEqual(
  sanitizeMechanicCondition({ kind: "not", child: { kind: "handAtLeast", amount: 4 } }),
  { kind: "not", child: { kind: "handAtLeast", amount: 4 } },
  "NOT provides the complementary less-than hand-size predicate without another leaf kind",
);

// Generic Mechanics evaluation is controller-oriented and observes only hand counts.
withRegisteredCardSnapshot([
  unitCard("test_condition23_source"),
  unitCard("test_condition23_hidden_a", "Dragon"),
  unitCard("test_condition23_hidden_b", "Beast"),
], () => {
  const state = createGame("Condition 2.3 Mechanics Orientation", DECKS[3], DECKS[2], true, 623001);
  state.players.player.bench = [makeUnit(state, "test_condition23_source", "player")];
  state.players.ai.bench = [makeUnit(state, "test_condition23_source", "ai")];
  const playerSource = state.players.player.bench[0];
  const aiSource = state.players.ai.bench[0];
  state.players.player.hand = [
    { instanceId: "p1", defId: "test_condition23_hidden_a" },
    { instanceId: "p2", defId: "test_condition23_hidden_b" },
    { instanceId: "p3", defId: "test_condition23_hidden_a" },
  ];
  state.players.ai.hand = [
    { instanceId: "a1", defId: "test_condition23_hidden_b" },
    { instanceId: "a2", defId: "test_condition23_hidden_a" },
    { instanceId: "a3", defId: "test_condition23_hidden_b" },
    { instanceId: "a4", defId: "test_condition23_hidden_a" },
    { instanceId: "a5", defId: "test_condition23_hidden_b" },
  ];

  assert.equal(mechanicConditionMatches(state, playerSource, { kind: "handAtLeast", amount: 3 }), true);
  assert.equal(mechanicConditionMatches(state, playerSource, { kind: "handAtLeast", amount: 4 }), false);
  assert.equal(mechanicConditionMatches(state, playerSource, { kind: "opponentHandAtLeast", amount: 5 }), true);
  assert.equal(mechanicConditionMatches(state, aiSource, { kind: "opponentHandAtLeast", amount: 3 }), true, "AI source reads player hand count symmetrically");

  const lessThanFour: MechanicCondition = { kind: "not", child: { kind: "handAtLeast", amount: 4 } };
  assert.equal(mechanicConditionMatches(state, playerSource, lessThanFour), true);

  state.players.ai.hand = state.players.ai.hand.map((card, index) => ({
    ...card,
    defId: index % 2 === 0 ? "test_condition23_hidden_a" : "test_condition23_hidden_b",
  }));
  assert.equal(
    mechanicConditionMatches(state, playerSource, { kind: "opponentHandAtLeast", amount: 5 }),
    true,
    "opponent hand predicate is invariant to hidden card identities when count is unchanged",
  );
});

// Aura evaluation uses the same controller/opponent hand orientation.
{
  const state = createGame("Condition 2.3 Aura Orientation", DECKS[3], DECKS[2], true, 623002);
  state.players.player.hand = Array.from({ length: 2 }, (_, index) => ({ instanceId: `p_${index}`, defId: DECKS[3].cards[0] }));
  state.players.ai.hand = Array.from({ length: 4 }, (_, index) => ({ instanceId: `a_${index}`, defId: DECKS[2].cards[0] }));
  assert.equal(auraConditionMatches(state, "player", { kind: "handAtLeast", amount: 2 }), true);
  assert.equal(auraConditionMatches(state, "player", { kind: "opponentHandAtLeast", amount: 4 }), true);
  assert.equal(auraConditionMatches(state, "ai", { kind: "opponentHandAtLeast", amount: 2 }), true);
}

// Playing a card crosses below the threshold and disables the Aura in the same authoritative action.
withRegisteredCardSnapshot([
  auraCard({ buffPower: 2, buffHealth: 0, condition: { kind: "handAtLeast", amount: 2 } }, "test_condition23_spend_aura"),
  unitCard("test_condition23_spend_ally"),
  unitCard("test_condition23_spend_card", "Beast"),
  unitCard("test_condition23_filler", "Dragon"),
], () => {
  const state = createGame("Condition 2.3 Spend Transition", DECKS[3], DECKS[2], true, 623003);
  state.players.player.bench = [];
  state.players.player.permanents = [makePermanent(state, "test_condition23_spend_aura", "player")];
  const ally = makeUnit(state, "test_condition23_spend_ally", "player");
  state.players.player.bench.push(ally);
  state.players.player.hand = [
    { instanceId: "condition23_spend", defId: "test_condition23_spend_card" },
    { instanceId: "condition23_filler", defId: "test_condition23_filler" },
  ];
  state.players.player.mana = 10;
  state.players.player.maxMana = 10;
  state.activePlayer = "player";
  state.phase = "main";
  recomputeContinuousAuras(state);
  assert.equal(ally.power, 4, "two-card hand activates the inclusive threshold");

  const resolved = playUnit(state, "player", "condition23_spend");
  const resolvedAlly = resolved.players.player.bench.find((unit) => unit.instanceId === ally.instanceId)!;
  assert.equal(resolved.players.player.hand.length, 1);
  assert.equal(resolvedAlly.power, 2, "playing down to one card removes the conditional Aura in the returned state");
});

// A real draw can cross upward through the threshold after the spell itself leaves hand.
withRegisteredCardSnapshot([
  auraCard({ buffPower: 0, buffHealth: 0, keywords: ["Flying"], condition: { kind: "handAtLeast", amount: 3 } }, "test_condition23_draw_aura"),
  unitCard("test_condition23_draw_ally"),
  unitCard("test_condition23_draw_filler", "Dragon"),
  drawSpell("test_condition23_draw_spell", 2),
], () => {
  const state = createGame("Condition 2.3 Draw Transition", DECKS[3], DECKS[2], true, 623004);
  state.players.player.bench = [];
  state.players.player.permanents = [makePermanent(state, "test_condition23_draw_aura", "player")];
  const ally = makeUnit(state, "test_condition23_draw_ally", "player");
  state.players.player.bench.push(ally);
  state.players.player.hand = [
    { instanceId: "condition23_draw", defId: "test_condition23_draw_spell" },
    { instanceId: "condition23_draw_filler", defId: "test_condition23_draw_filler" },
  ];
  state.players.player.mana = 10;
  state.players.player.maxMana = 10;
  state.activePlayer = "player";
  state.phase = "main";
  recomputeContinuousAuras(state);
  assert.equal(ally.keywords.includes("Flying"), false);

  const resolved = castSpell(state, "player", "condition23_draw");
  const resolvedAlly = resolved.players.player.bench.find((unit) => unit.instanceId === ally.instanceId)!;
  assert.equal(resolved.players.player.hand.length, 3, "cast removes one card and draw 2 crosses upward to three cards");
  assert.equal(resolvedAlly.keywords.includes("Flying"), true, "draw transition activates the source-bound keyword in the same resolution");
});

// Authoring preserves hand conditions for both Mechanics and Continuous Auras.
const mechanicAuthored = validateAuthorableCard(unitCard("valid_condition23_mechanic", "Spirit", [{
  key: "hand_watch",
  name: "Hand Watch",
  trigger: "onRoundStart",
  condition: { kind: "opponentHandAtLeast", amount: 2 },
  effect: { kind: "draw", amount: 1, target: "none" },
}]));
assert.equal(mechanicAuthored.ok, true);
assert.ok(mechanicAuthored.ok);
assert.deepEqual(mechanicAuthored.card.mechanics?.[0].condition, { kind: "opponentHandAtLeast", amount: 2 });

const auraAuthored = validateAuthorableCardWithSemanticTypes(auraCard({
  buffPower: 1,
  buffHealth: 0,
  condition: {
    kind: "and",
    children: [
      { kind: "handAtLeast", amount: 3 },
      { kind: "not", child: { kind: "opponentHandAtLeast", amount: 6 } },
    ],
  },
}, "valid_condition23_aura"));
assert.equal(auraAuthored.ok, true);
assert.ok(auraAuthored.ok);
assert.deepEqual(auraAuthored.card.aura?.condition, {
  kind: "and",
  children: [
    { kind: "handAtLeast", amount: 3 },
    { kind: "not", child: { kind: "opponentHandAtLeast", amount: 6 } },
  ],
});
const blueprint = blueprintFromPermanentStatAura(auraAuthored.card);
assert.ok(blueprint);
assert.deepEqual(blueprint.condition, auraAuthored.card.aura?.condition);
assert.equal(blueprint.features.includes("conditional"), true);

console.log("CONDITION SYSTEM 2.3: PASS — hand/opponent-hand thresholds, hidden-content independence, controller orientation, composition, authoritative spend/draw transitions, authoring and Ability Grammar certified");
