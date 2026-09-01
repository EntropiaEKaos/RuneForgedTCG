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
import type { CardDef, MechanicCondition, PermanentStatAura, PlayerId } from "./types";

const unitCard = (defId: string): CardDef => ({
  defId,
  name: defId,
  region: "Ironwood",
  type: "Unit",
  cost: 2,
  power: 2,
  health: 4,
  race: "Spirit",
  description: "Condition 2.1 test unit.",
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
  description: "Condition 2.1 threshold Aura.",
  rarity: "Rare",
  emoji: "🜁",
});

const damageSpell = (defId: string, amount: number): CardDef => ({
  defId,
  name: defId,
  region: "Emberhold",
  type: "Spell",
  cost: 1,
  spell: { kind: "damageNexus", amount, target: "none" },
  description: "Condition 2.1 transition spell.",
  rarity: "Common",
  emoji: "🔥",
});

assert.equal(MECHANIC_CONDITION_KINDS.includes("opponentNexusBelow"), true);
assert.equal(CONDITION_RUNTIME_SUPPORT.opponentNexusBelow, "supported");
assert.equal(conditionKindsAtDepth(0).includes("opponentNexusBelow"), true);
assert.equal(ABILITY_GRAMMAR_CATALOG.conditions.includes("opponentNexusBelow"), true);
assert.equal(ABILITY_GRAMMAR_CATALOG.conditionContracts.opponentNexusBelow, "supported");

assert.deepEqual(
  sanitizeMechanicCondition({ kind: "opponentNexusBelow", amount: 99 }),
  { kind: "opponentNexusBelow", amount: 20 },
  "opponent threshold shares the canonical 0..20 clamp",
);
assert.deepEqual(
  sanitizeMechanicCondition({ kind: "opponentNexusBelow", amount: -4 }),
  { kind: "opponentNexusBelow", amount: 0 },
);
assert.equal(sanitizeMechanicCondition({ kind: "opponentNexusUnknown", amount: 10 }), null);

// Generic Mechanics conditions are oriented from the source Unit's controller.
withRegisteredCardSnapshot([unitCard("test_condition21_unit")], () => {
  const state = createGame("Condition 2.1 Orientation", DECKS[3], DECKS[2], true, 621001);
  state.players.player.bench = [];
  state.players.ai.bench = [];
  const playerUnit = makeUnit(state, "test_condition21_unit", "player");
  const aiUnit = makeUnit(state, "test_condition21_unit", "ai");
  state.players.player.bench.push(playerUnit);
  state.players.ai.bench.push(aiUnit);
  state.players.player.nexusHealth = 7;
  state.players.ai.nexusHealth = 12;

  const threshold: MechanicCondition = { kind: "opponentNexusBelow", amount: 10 };
  assert.equal(mechanicConditionMatches(state, playerUnit, threshold), false, "player source reads AI Nexus, not its own");
  assert.equal(mechanicConditionMatches(state, aiUnit, threshold), true, "AI source reads player Nexus");

  state.players.ai.nexusHealth = 10;
  assert.equal(mechanicConditionMatches(state, playerUnit, threshold), true, "threshold is inclusive");
  state.players.player.nexusHealth = 20;
  assert.equal(mechanicConditionMatches(state, playerUnit, threshold), true, "changing the controller's own Nexus does not change opponentNexusBelow");

  const composite: MechanicCondition = {
    kind: "and",
    children: [
      { kind: "opponentNexusBelow", amount: 10 },
      { kind: "not", child: { kind: "nexusBelow", amount: 5 } },
    ],
  };
  assert.equal(mechanicConditionMatches(state, playerUnit, composite), true, "new leaf composes through AND/NOT without a second evaluator");
});

// Aura controller orientation works symmetrically for player-owned and AI-owned sources.
withRegisteredCardSnapshot([
  auraCard({ buffPower: 2, buffHealth: 0, condition: { kind: "opponentNexusBelow", amount: 10 } }, "test_condition21_player_aura"),
  auraCard({ buffPower: 1, buffHealth: 1, condition: { kind: "opponentNexusBelow", amount: 8 } }, "test_condition21_ai_aura"),
  unitCard("test_condition21_ally"),
], () => {
  const state = createGame("Condition 2.1 Aura Direction", DECKS[3], DECKS[2], true, 621002);
  state.players.player.bench = [];
  state.players.ai.bench = [];
  state.players.player.permanents = [makePermanent(state, "test_condition21_player_aura", "player")];
  state.players.ai.permanents = [makePermanent(state, "test_condition21_ai_aura", "ai")];
  const playerAlly = makeUnit(state, "test_condition21_ally", "player");
  const aiAlly = makeUnit(state, "test_condition21_ally", "ai");
  state.players.player.bench.push(playerAlly);
  state.players.ai.bench.push(aiAlly);
  state.players.player.nexusHealth = 9;
  state.players.ai.nexusHealth = 11;
  recomputeContinuousAuras(state);

  assert.equal(playerAlly.power, 2, "player Aura is inactive while AI Nexus is above its threshold");
  assert.equal(aiAlly.power, 2, "AI Aura is inactive while player Nexus is above its threshold");

  state.players.ai.nexusHealth = 10;
  state.players.player.nexusHealth = 8;
  recomputeContinuousAuras(state);
  assert.equal(playerAlly.power, 4, "player Aura activates from AI Nexus threshold");
  assert.equal(aiAlly.power, 3, "AI Aura activates from player Nexus threshold");
  assert.equal(aiAlly.maxHealth, 5);

  assert.equal(auraConditionMatches(state, "player", { kind: "nexusBelow", amount: 8 }), true, "legacy nexusBelow still reads the controller's own Nexus");
  assert.equal(auraConditionMatches(state, "player", { kind: "opponentNexusBelow", amount: 8 }), false, "opponentNexusBelow remains distinct from own-Nexus state");
});

// Real authoritative damage crosses the threshold and activates the source in the same resolved action.
withRegisteredCardSnapshot([
  auraCard({ buffPower: 0, buffHealth: 0, keywords: ["Flying"], condition: { kind: "opponentNexusBelow", amount: 17 } }, "test_condition21_transition_aura"),
  unitCard("test_condition21_transition_ally"),
  damageSpell("test_condition21_damage", 3),
], () => {
  const state = createGame("Condition 2.1 Transition", DECKS[3], DECKS[2], true, 621003);
  state.players.player.bench = [];
  state.players.ai.bench = [];
  state.players.player.permanents = [makePermanent(state, "test_condition21_transition_aura", "player")];
  const ally = makeUnit(state, "test_condition21_transition_ally", "player");
  state.players.player.bench.push(ally);
  state.players.ai.nexusHealth = 20;
  state.players.player.mana = 10;
  state.players.player.maxMana = 10;
  state.players.player.hand = [{ instanceId: "condition21_damage", defId: "test_condition21_damage" }];
  state.activePlayer = "player";
  state.phase = "main";
  recomputeContinuousAuras(state);
  assert.equal(ally.keywords.includes("Flying"), false);

  const resolved = castSpell(state, "player", "condition21_damage");
  const resolvedAlly = resolved.players.player.bench.find((unit) => unit.instanceId === ally.instanceId)!;
  assert.equal(resolved.players.ai.nexusHealth, 17);
  assert.equal(resolvedAlly.keywords.includes("Flying"), true, "spell resolution recomputes and activates opponent threshold Aura immediately");
});

// Semantic authoring and Ability Grammar preserve the exact new leaf.
const authored = validateAuthorableCardWithSemanticTypes(auraCard({
  buffPower: 1,
  buffHealth: 0,
  condition: {
    kind: "and",
    children: [
      { kind: "opponentNexusBelow", amount: 10 },
      { kind: "not", child: { kind: "manaAtLeast", amount: 8 } },
    ],
  },
}, "valid_condition21_aura"));
assert.equal(authored.ok, true);
assert.ok(authored.ok);
assert.deepEqual(authored.card.aura?.condition, {
  kind: "and",
  children: [
    { kind: "opponentNexusBelow", amount: 10 },
    { kind: "not", child: { kind: "manaAtLeast", amount: 8 } },
  ],
});
const blueprint = blueprintFromPermanentStatAura(authored.card);
assert.ok(blueprint);
assert.deepEqual(blueprint.condition, authored.card.aura?.condition);
assert.equal(blueprint.features.includes("conditional"), true);

// Direct source-owner evaluator is symmetric independent of a target Unit.
{
  const state = createGame("Condition 2.1 Pure Aura", DECKS[3], DECKS[2], true, 621004);
  const check = (owner: PlayerId, opponentHealth: number) => {
    const opponent: PlayerId = owner === "player" ? "ai" : "player";
    state.players[opponent].nexusHealth = opponentHealth;
    return auraConditionMatches(state, owner, { kind: "opponentNexusBelow", amount: 9 });
  };
  assert.equal(check("player", 9), true);
  assert.equal(check("player", 10), false);
  assert.equal(check("ai", 9), true);
  assert.equal(check("ai", 10), false);
}

console.log("CONDITION SYSTEM 2.1: PASS — opponent Nexus thresholds, controller orientation, composition, Aura/Mechanics runtime, Studio contract and Ability Grammar certified");
