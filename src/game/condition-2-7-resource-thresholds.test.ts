import assert from "node:assert/strict";
import "./aura-2-types";
import { ABILITY_GRAMMAR_CATALOG, blueprintFromPermanentStatAura } from "./ability-system";
import { auraConditionMatches } from "./aura-condition-contract";
import { MECHANIC_CONDITION_KINDS, sanitizeMechanicCondition, validateAuthorableCard } from "./card-authoring";
import { CONDITION_RUNTIME_SUPPORT, conditionKindsAtDepth } from "./condition-contract";
import { withRegisteredCardSnapshot } from "./custom-registry";
import { DECKS } from "./decks";
import { castSpell, createGame, endTurn, makePermanent, makeUnit, mechanicConditionMatches, recomputeContinuousAuras } from "./engine";
import { validateAuthorableCardWithSemanticTypes } from "./semantic-card-type-authoring";
import type { CardDef, MechanicCondition, PermanentStatAura } from "./types";

const unitCard = (defId: string, mechanics?: CardDef["mechanics"]): CardDef => ({
  defId, name: defId, region: "Tidecall", type: "Unit", cost: 1, power: 2, health: 4, race: "Spirit",
  ...(mechanics?.length ? { mechanics } : {}), description: "Condition 2.7 resource threshold test unit.", rarity: "Common", emoji: "💧",
});
const auraCard = (aura: PermanentStatAura, defId: string): CardDef => ({
  defId, name: defId, region: "Tidecall", type: "Enchantment", cost: 1, maxHealth: 4, aura,
  description: "Condition 2.7 resource threshold Aura.", rarity: "Rare", emoji: "🔷",
});
const spellCard = (defId: string, cost = 2): CardDef => ({
  defId, name: defId, region: "Tidecall", type: "Spell", cost,
  spell: { kind: "draw", amount: 0, target: "none" }, description: "Condition 2.7 spell-mana spend probe.", rarity: "Common", emoji: "✨",
});

for (const kind of ["opponentManaAtLeast", "spellManaAtLeast", "opponentSpellManaAtLeast"] as const) {
  assert.equal(MECHANIC_CONDITION_KINDS.includes(kind), true);
  assert.equal(CONDITION_RUNTIME_SUPPORT[kind], "supported");
  assert.equal(conditionKindsAtDepth(0).includes(kind), true);
  assert.equal(ABILITY_GRAMMAR_CATALOG.conditions.includes(kind), true);
  assert.equal(ABILITY_GRAMMAR_CATALOG.conditionContracts[kind], "supported");
}
assert.deepEqual(sanitizeMechanicCondition({ kind: "opponentManaAtLeast", amount: 99 }), { kind: "opponentManaAtLeast", amount: 20 });
assert.deepEqual(sanitizeMechanicCondition({ kind: "spellManaAtLeast", amount: 99 }), { kind: "spellManaAtLeast", amount: 10 });
assert.deepEqual(sanitizeMechanicCondition({ kind: "opponentSpellManaAtLeast", amount: -4 }), { kind: "opponentSpellManaAtLeast", amount: 0 });

withRegisteredCardSnapshot([unitCard("test_condition27_source")], () => {
  const state = createGame("Condition 2.7 Orientation", DECKS[3], DECKS[2], true, 627001);
  const playerSource = makeUnit(state, "test_condition27_source", "player");
  const aiSource = makeUnit(state, "test_condition27_source", "ai");
  state.players.player.bench = [playerSource];
  state.players.ai.bench = [aiSource];
  state.players.player.mana = 4;
  state.players.player.spellMana = 2;
  state.players.ai.mana = 3;
  state.players.ai.spellMana = 1;
  assert.equal(mechanicConditionMatches(state, playerSource, { kind: "opponentManaAtLeast", amount: 3 }), true);
  assert.equal(mechanicConditionMatches(state, playerSource, { kind: "spellManaAtLeast", amount: 2 }), true);
  assert.equal(mechanicConditionMatches(state, playerSource, { kind: "opponentSpellManaAtLeast", amount: 2 }), false);
  assert.equal(mechanicConditionMatches(state, aiSource, { kind: "opponentManaAtLeast", amount: 4 }), true, "AI reads player mana symmetrically");
  assert.equal(mechanicConditionMatches(state, aiSource, { kind: "opponentSpellManaAtLeast", amount: 2 }), true, "AI reads player spell mana symmetrically");
  const composed: MechanicCondition = { kind: "and", children: [
    { kind: "opponentManaAtLeast", amount: 3 },
    { kind: "not", child: { kind: "opponentSpellManaAtLeast", amount: 2 } },
  ] };
  assert.equal(mechanicConditionMatches(state, playerSource, composed), true);
  assert.equal(auraConditionMatches(state, "player", { kind: "opponentManaAtLeast", amount: 3 }), true);
  assert.equal(auraConditionMatches(state, "player", { kind: "spellManaAtLeast", amount: 2 }), true);
  assert.equal(auraConditionMatches(state, "ai", { kind: "opponentSpellManaAtLeast", amount: 2 }), true);
});

withRegisteredCardSnapshot([
  auraCard({ buffPower: 2, buffHealth: 0, condition: { kind: "spellManaAtLeast", amount: 2 } }, "test_condition27_resource_aura"),
  unitCard("test_condition27_ally"),
  spellCard("test_condition27_spend_spell", 2),
], () => {
  const state = createGame("Condition 2.7 Resource Lifecycle", DECKS[3], DECKS[2], true, 627002);
  state.players.player.bench = [];
  state.players.player.permanents = [makePermanent(state, "test_condition27_resource_aura", "player")];
  const ally = makeUnit(state, "test_condition27_ally", "player");
  state.players.player.bench.push(ally);
  state.players.player.mana = 2;
  state.players.player.maxMana = 2;
  state.players.player.spellMana = 0;
  state.players.ai.mana = 0;
  state.players.ai.spellMana = 0;
  state.activePlayer = "player";
  state.attackToken = "player";
  state.phase = "main";
  recomputeContinuousAuras(state);
  assert.equal(ally.power, 2, "spell-mana Aura begins inactive");
  const aiTurn = endTurn(state, "player");
  const round2 = endTurn(aiTurn, "ai");
  const chargedAlly = round2.players.player.bench.find((unit) => unit.instanceId === ally.instanceId)!;
  assert.equal(round2.players.player.spellMana, 2, "unused mana is banked by authoritative round refresh");
  assert.equal(chargedAlly.power, 4, "banking spell mana activates the Aura in the returned state");
  round2.players.player.mana = 0;
  round2.players.player.hand = [{ instanceId: "condition27_spell", defId: "test_condition27_spend_spell" }];
  round2.activePlayer = "player";
  round2.phase = "main";
  const spent = castSpell(round2, "player", "condition27_spell");
  const spentAlly = spent.players.player.bench.find((unit) => unit.instanceId === ally.instanceId)!;
  assert.equal(spent.players.player.spellMana, 0, "spell cost falls through to spell mana when normal mana is empty");
  assert.equal(spentAlly.power, 2, "spending below the threshold disables the Aura in the same resolution");
});

const mechanicAuthored = validateAuthorableCard(unitCard("valid_condition27_mechanic", [{
  key: "resource_read", name: "Resource Read", trigger: "onRoundStart",
  condition: { kind: "opponentManaAtLeast", amount: 4 }, effect: { kind: "draw", amount: 1, target: "none" },
}]));
assert.equal(mechanicAuthored.ok, true);
assert.ok(mechanicAuthored.ok);
assert.deepEqual(mechanicAuthored.card.mechanics?.[0].condition, { kind: "opponentManaAtLeast", amount: 4 });

const auraAuthored = validateAuthorableCardWithSemanticTypes(auraCard({
  buffPower: 1, buffHealth: 0,
  condition: { kind: "and", children: [
    { kind: "spellManaAtLeast", amount: 2 },
    { kind: "not", child: { kind: "opponentSpellManaAtLeast", amount: 3 } },
  ] },
}, "valid_condition27_aura"));
assert.equal(auraAuthored.ok, true);
assert.ok(auraAuthored.ok);
const blueprint = blueprintFromPermanentStatAura(auraAuthored.card);
assert.ok(blueprint);
assert.deepEqual(blueprint.condition, auraAuthored.card.aura?.condition);
assert.equal(blueprint.features.includes("conditional"), true);

console.log("CONDITION SYSTEM 2.7: PASS — opponent normal mana plus own/opponent spell-mana thresholds, symmetric public-resource orientation, 0..20/0..10 authoring envelopes, composition, authoritative bank/spend Aura lifecycle, authoring and Ability Grammar certified");
