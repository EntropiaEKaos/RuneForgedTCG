import assert from "node:assert/strict";
import "./aura-2-types";
import { blueprintFromPermanentStatAura } from "./ability-system";
import {
  UNIT_SOURCE_SELF_DAMAGED_AURA_CONTRACT,
  auraConditionMatches,
  sanitizeAuraCondition,
  unitSourceAuraConditionTreeSupported,
} from "./aura-condition-contract";
import { withRegisteredCardSnapshot } from "./custom-registry";
import { DECKS } from "./decks";
import {
  applyDamageToUnit,
  cleanupDead,
  createGame,
  makePermanent,
  makeUnit,
  permanentAuraBonusForUnit,
  recomputeContinuousAuras,
} from "./engine";
import { validateAuthorableCardWithSemanticTypes } from "./semantic-card-type-authoring";
import type { CardDef, MechanicCondition, PermanentStatAura, Race, SentinelaInstance } from "./types";

const unitAuraCard = (
  aura: PermanentStatAura,
  defId = "test_aura27_source",
): CardDef => ({
  defId,
  name: "Scarred Standard Bearer",
  region: "Ironwood",
  type: "Unit",
  cost: 3,
  power: 3,
  health: 5,
  race: "Beast",
  aura,
  description: "Its continuous command awakens while the source is damaged.",
  rarity: "Rare",
  emoji: "🩸",
});

const unitCard = (
  defId: string,
  race: Race = "Spirit",
  power = 2,
  health = 4,
): CardDef => ({
  defId,
  name: defId,
  region: "Ironwood",
  type: "Unit",
  cost: 2,
  power,
  health,
  race,
  description: "Aura 2.7 test unit.",
  rarity: "Common",
  emoji: "🧪",
});

const permanentAuraCard = (
  aura: PermanentStatAura,
  defId = "test_aura27_permanent",
): CardDef => ({
  defId,
  name: defId,
  region: "Ironwood",
  type: "Enchantment",
  cost: 2,
  maxHealth: 4,
  aura,
  description: "Aura 2.7 permanent test source.",
  rarity: "Rare",
  emoji: "🜁",
});

const sentinelaAuraCard = (
  aura: PermanentStatAura,
  defId = "test_aura27_sentinela",
): CardDef => ({
  defId,
  name: defId,
  region: "Ironwood",
  type: "Sentinela",
  cost: 4,
  aura,
  description: "Aura 2.7 Sentinela test source.",
  rarity: "Legend",
  emoji: "🜲",
  sentinela: {
    startingLoyalty: 4,
    abilities: [{ cost: 1, description: "+1: compre 1.", effect: { kind: "draw", amount: 1, target: "none" } }],
  },
});

const sentinelaInstance = (defId: string, owner: "player" | "ai"): SentinelaInstance => ({
  instanceId: `sen_${defId}_${owner}`,
  defId,
  owner,
  loyalty: 4,
  activatedThisTurn: false,
});

assert.deepEqual(UNIT_SOURCE_SELF_DAMAGED_AURA_CONTRACT, {
  rule: "unitSourceSelfDamagedAuraCondition",
  sources: ["Unit"],
  sourceZone: "bench",
  condition: "selfDamaged",
  predicate: "sourceUnit.health < sourceUnit.maxHealth",
  composition: ["and", "or", "not"],
  permanentSources: "unsupportedFailClosed",
  sentinelaSources: "unsupportedFailClosed",
  lifecycle: "recomputeWhenAuthoritativeStateChanges",
  support: "supported",
});

// The source-relative evaluator is only meaningful with the actual live Unit source.
withRegisteredCardSnapshot([
  unitAuraCard({ buffPower: 1, buffHealth: 0, condition: { kind: "selfDamaged" } }),
], () => {
  const state = createGame("Aura 2.7 Predicate", DECKS[3], DECKS[2], true, 647001);
  state.players.player.bench = [];
  const source = makeUnit(state, "test_aura27_source", "player");
  state.players.player.bench.push(source);

  assert.equal(auraConditionMatches(state, "player", { kind: "selfDamaged" }), false, "missing Unit source fails closed");
  assert.equal(auraConditionMatches(state, "player", { kind: "selfDamaged" }, source), false, "full-health source is inactive");
  applyDamageToUnit(source, 1);
  assert.equal(auraConditionMatches(state, "player", { kind: "selfDamaged" }, source), true, "marked source damage activates the predicate");
  assert.equal(auraConditionMatches(state, "ai", { kind: "selfDamaged" }, source), false, "source ownership mismatch fails closed");
});

// Runtime lifecycle: damage activates the Unit Lord Aura; healing to full removes only its continuous layer.
withRegisteredCardSnapshot([
  unitAuraCard({ buffPower: 2, buffHealth: 1, keywords: ["Flying"], condition: { kind: "selfDamaged" } }),
  unitCard("test_aura27_ally", "Spirit", 2, 4),
], () => {
  const state = createGame("Aura 2.7 Lifecycle", DECKS[3], DECKS[2], true, 647002);
  state.players.player.bench = [];
  const source = makeUnit(state, "test_aura27_source", "player");
  const ally = makeUnit(state, "test_aura27_ally", "player");
  state.players.player.bench.push(source, ally);
  recomputeContinuousAuras(state);

  assert.equal(ally.power, 2);
  assert.equal(ally.maxHealth, 4);
  assert.equal(ally.keywords.includes("Flying"), false);
  assert.equal(source.power, 3, "Unit source remains self-excluded even when its condition later activates");

  applyDamageToUnit(source, 2);
  recomputeContinuousAuras(state);
  assert.equal(source.health, source.maxHealth - 2);
  assert.equal(ally.power, 4, "damaged Unit source activates the entire Aura payload");
  assert.equal(ally.maxHealth, 5);
  assert.equal(ally.keywords.includes("Flying"), true);
  assert.deepEqual(permanentAuraBonusForUnit(state, ally), { power: 2, health: 1, sources: 1 });
  assert.equal(source.power, 3, "source still cannot buff itself");

  source.health = source.maxHealth;
  recomputeContinuousAuras(state);
  assert.equal(ally.power, 2, "healing source to full disables the Aura immediately on recompute");
  assert.equal(ally.maxHealth, 4);
  assert.equal(ally.keywords.includes("Flying"), false);
});

// +Health from another Aura does not invent source damage; existing marked damage survives that layer entering/leaving.
withRegisteredCardSnapshot([
  unitAuraCard({ buffPower: 1, buffHealth: 0, condition: { kind: "selfDamaged" } }),
  permanentAuraCard({ buffPower: 0, buffHealth: 2 }, "test_aura27_health_aura"),
  unitCard("test_aura27_health_ally", "Spirit", 2, 4),
], () => {
  const state = createGame("Aura 2.7 Damage Mark", DECKS[3], DECKS[2], true, 647003);
  state.players.player.bench = [];
  const source = makeUnit(state, "test_aura27_source", "player");
  const ally = makeUnit(state, "test_aura27_health_ally", "player");
  state.players.player.bench.push(source, ally);
  state.players.player.permanents = [makePermanent(state, "test_aura27_health_aura", "player")];
  recomputeContinuousAuras(state);

  assert.equal(source.maxHealth, 7);
  assert.equal(source.health, 7, "+Health entering on a full source preserves zero marked damage");
  assert.equal(ally.power, 2, "larger maxHealth alone does not satisfy selfDamaged");

  applyDamageToUnit(source, 2);
  recomputeContinuousAuras(state);
  assert.equal(source.maxHealth - source.health, 2);
  assert.equal(ally.power, 3);

  state.players.player.permanents[0].health = 0;
  cleanupDead(state);
  assert.equal(source.maxHealth, 5);
  assert.equal(source.health, 3, "removing +Health preserves the same two points of marked damage");
  assert.equal(ally.power, 3, "selfDamaged remains true because damage mark, not Aura maxHealth, drives it");
});

// Boolean composition may include selfDamaged only for Unit-source trees.
const nested: MechanicCondition = {
  kind: "and",
  children: [
    { kind: "selfDamaged" },
    { kind: "not", child: { kind: "manaAtLeast", amount: 9 } },
  ],
};
assert.equal(unitSourceAuraConditionTreeSupported(nested), true);
assert.deepEqual(sanitizeAuraCondition(nested, true), nested);
assert.equal(sanitizeAuraCondition(nested), null, "Aura 2.5/non-Unit boundary still rejects nested selfDamaged");

// Canonical authoring accepts Unit-source selfDamaged and rejects the same payload on other source families.
const validUnit = validateAuthorableCardWithSemanticTypes(unitAuraCard({
  buffPower: 1,
  buffHealth: 0,
  condition: nested,
}, "valid_aura27_unit"));
assert.equal(validUnit.ok, true);
assert.ok(validUnit.ok);
assert.deepEqual(validUnit.card.aura?.condition, nested);

const invalidPermanent = validateAuthorableCardWithSemanticTypes(permanentAuraCard({
  buffPower: 1,
  buffHealth: 0,
  condition: { kind: "selfDamaged" },
}, "invalid_aura27_permanent"));
assert.equal(invalidPermanent.ok, false, "Permanent selfDamaged remains fail-closed");

const invalidSentinela = validateAuthorableCardWithSemanticTypes(sentinelaAuraCard({
  buffPower: 1,
  buffHealth: 0,
  condition: { kind: "selfDamaged" },
}, "invalid_aura27_sentinela"));
assert.equal(invalidSentinela.ok, false, "Sentinela selfDamaged remains fail-closed");

// Malformed/bypassed non-Unit runtime payload never acquires Unit semantics.
withRegisteredCardSnapshot([
  permanentAuraCard({ buffPower: 9, buffHealth: 0, condition: { kind: "selfDamaged" } }, "test_aura27_unsafe_permanent"),
  sentinelaAuraCard({ buffPower: 9, buffHealth: 0, condition: { kind: "selfDamaged" } }, "test_aura27_unsafe_sentinela"),
  unitCard("test_aura27_runtime_ally", "Spirit", 2, 4),
], () => {
  const state = createGame("Aura 2.7 Fail Closed", DECKS[3], DECKS[2], true, 647004);
  state.players.player.bench = [];
  const ally = makeUnit(state, "test_aura27_runtime_ally", "player");
  state.players.player.bench.push(ally);
  state.players.player.permanents = [makePermanent(state, "test_aura27_unsafe_permanent", "player")];
  state.players.player.sentinelas = [sentinelaInstance("test_aura27_unsafe_sentinela", "player")];
  recomputeContinuousAuras(state);
  assert.equal(ally.power, 2);
  assert.deepEqual(permanentAuraBonusForUnit(state, ally), { power: 0, health: 0, sources: 0 });
});

// Ability Grammar 2.6 projection already carries the certified source condition unchanged.
const blueprint = blueprintFromPermanentStatAura(unitAuraCard({
  buffPower: 1,
  buffHealth: 0,
  condition: { kind: "selfDamaged" },
}, "test_aura27_blueprint"));
assert.ok(blueprint);
assert.deepEqual(blueprint.condition, { kind: "selfDamaged" });
assert.deepEqual(blueprint.rule?.kind === "permanentStatAura" ? blueprint.rule.aura.condition : undefined, { kind: "selfDamaged" });
assert.equal(blueprint.features.includes("conditional"), true);

console.log("AURA 2.7 UNIT SOURCE SELF-DAMAGED: PASS — source damage lifecycle, damage-mark stability, authoring scope and fail-closed non-Unit boundaries certified");
