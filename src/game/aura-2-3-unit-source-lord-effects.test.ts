import assert from "node:assert/strict";
import "./aura-2-types";
import {
  ABILITY_GRAMMAR_CATALOG,
  ABILITY_KIND_SUPPORT,
  blueprintFromPermanentStatAura,
} from "./ability-system";
import { withRegisteredCardSnapshot } from "./custom-registry";
import { DECKS } from "./decks";
import {
  UNIT_SOURCE_AURA_CONTRACT,
  cleanupDead,
  createGame,
  makeUnit,
  permanentAuraBonusForUnit,
  permanentAuraKeywordsForUnit,
  permanentAuraSuppressedKeywordsForUnit,
  playUnit,
  recomputeContinuousAuras,
} from "./engine";
import { validateAuthorableCardWithSemanticTypes } from "./semantic-card-type-authoring";
import type { CardDef, PermanentStatAura, Race } from "./types";

const lordCard = (
  aura: PermanentStatAura,
  defId = "test_aura23_lord",
  race: Race = "Beast",
): CardDef => ({
  defId,
  name: "Aura Lord",
  region: "Ironwood",
  type: "Unit",
  cost: 3,
  power: 2,
  health: 3,
  race,
  aura,
  description: "A living Unit-source continuous Aura.",
  rarity: "Rare",
  emoji: "👑",
});

const testUnit = (
  defId: string,
  race: Race,
  power = 2,
  health = 4,
  keywords?: CardDef["keywords"],
): CardDef => ({
  defId,
  name: defId,
  region: "Ironwood",
  type: "Unit",
  cost: 2,
  power,
  health,
  race,
  ...(keywords?.length ? { keywords } : {}),
  description: "Aura 2.3 test unit.",
  rarity: "Common",
  emoji: "🧪",
});

assert.deepEqual(UNIT_SOURCE_AURA_CONTRACT, {
  rule: "unitSourceAura",
  sources: ["Unit"],
  sourceZone: "bench",
  targets: ["allyUnit", "enemyUnit"],
  selfExclusion: "sourceInstanceAlwaysExcluded",
  alliedEffects: ["nonNegativeStats", "keywordGrants"],
  enemyEffects: ["nonPositiveStats", "keywordSuppressions"],
  lifecycle: "whileSourceAliveOnBench",
  statStacking: "additive",
  keywordStacking: "setUnion",
  support: "supported",
});

// Allied lord: filters apply to other allies, while the source never buffs itself.
withRegisteredCardSnapshot([
  lordCard({ buffPower: 1, buffHealth: 1, races: ["Beast"] }),
  testUnit("test_aura23_beast", "Beast", 3, 4),
  testUnit("test_aura23_spirit", "Spirit", 3, 4),
], () => {
  const state = createGame("Aura 2.3 Lord", DECKS[3], DECKS[2], true, 643001);
  state.players.player.bench = [];
  state.players.ai.bench = [];
  state.players.player.permanents = [];
  state.players.ai.permanents = [];

  const source = makeUnit(state, "test_aura23_lord", "player");
  state.players.player.bench.push(source);
  const matching = makeUnit(state, "test_aura23_beast", "player");
  const wrongRace = makeUnit(state, "test_aura23_spirit", "player");
  state.players.player.bench.push(matching, wrongRace);
  recomputeContinuousAuras(state);

  assert.equal(source.power, 2, "Unit Aura source never receives its own Power bonus");
  assert.equal(source.maxHealth, 3, "Unit Aura source never receives its own Health bonus");
  assert.deepEqual(permanentAuraBonusForUnit(state, source), { power: 0, health: 0, sources: 0 });
  assert.equal(matching.power, 4, "matching ally receives the lord Power bonus");
  assert.equal(matching.maxHealth, 5, "matching ally receives the lord Health bonus");
  assert.deepEqual(permanentAuraBonusForUnit(state, matching), { power: 1, health: 1, sources: 1 });
  assert.equal(wrongRace.power, 3, "race filter still excludes non-matching allies");
  assert.equal(wrongRace.maxHealth, 4);
});

// Two lords may affect one another, but each still excludes only its own instance.
withRegisteredCardSnapshot([
  lordCard({ buffPower: 1, buffHealth: 0 }, "test_aura23_lord_a"),
  lordCard({ buffPower: 1, buffHealth: 0 }, "test_aura23_lord_b"),
], () => {
  const state = createGame("Aura 2.3 Mutual Lords", DECKS[3], DECKS[2], true, 643002);
  state.players.player.bench = [];
  state.players.ai.bench = [];
  const first = makeUnit(state, "test_aura23_lord_a", "player");
  state.players.player.bench.push(first);
  const second = makeUnit(state, "test_aura23_lord_b", "player");
  state.players.player.bench.push(second);
  recomputeContinuousAuras(state);

  assert.equal(first.power, 3, "first lord receives only the second lord's +1");
  assert.equal(second.power, 3, "second lord receives only the first lord's +1");
  assert.equal(permanentAuraBonusForUnit(state, first).sources, 1);
  assert.equal(permanentAuraBonusForUnit(state, second).sources, 1);
});

// Real play path: summoning a lord immediately updates existing allies through cleanup/recompute.
withRegisteredCardSnapshot([
  lordCard({ buffPower: 1, buffHealth: 1 }, "test_aura23_play_lord"),
  testUnit("test_aura23_play_ally", "Spirit", 2, 4),
], () => {
  const state = createGame("Aura 2.3 Play Path", DECKS[3], DECKS[2], true, 643003);
  state.players.player.bench = [];
  state.players.ai.bench = [];
  state.players.player.permanents = [];
  const ally = makeUnit(state, "test_aura23_play_ally", "player");
  state.players.player.bench.push(ally);
  state.players.player.hand = [{ instanceId: "aura23_lord_card", defId: "test_aura23_play_lord" }];
  state.players.player.mana = 10;
  state.activePlayer = "player";
  state.phase = "main";

  const next = playUnit(state, "player", "aura23_lord_card");
  const playedLord = next.players.player.bench.find((unit) => unit.defId === "test_aura23_play_lord");
  const buffedAlly = next.players.player.bench.find((unit) => unit.defId === "test_aura23_play_ally")!;
  assert.ok(playedLord, "lord enters through the authoritative Unit play path");
  assert.equal(playedLord.power, 2, "fresh lord still excludes itself after play cleanup");
  assert.equal(playedLord.maxHealth, 3);
  assert.equal(buffedAlly.power, 3, "existing ally updates immediately when lord enters");
  assert.equal(buffedAlly.maxHealth, 5);
});

// Source death removes the Aura and preserves already marked damage on supported allies.
withRegisteredCardSnapshot([
  lordCard({ buffPower: 0, buffHealth: 2 }, "test_aura23_health_lord"),
  testUnit("test_aura23_damaged_ally", "Spirit", 2, 5),
], () => {
  const state = createGame("Aura 2.3 Death", DECKS[3], DECKS[2], true, 643004);
  state.players.player.bench = [];
  state.players.ai.bench = [];
  const source = makeUnit(state, "test_aura23_health_lord", "player");
  state.players.player.bench.push(source);
  const ally = makeUnit(state, "test_aura23_damaged_ally", "player");
  state.players.player.bench.push(ally);
  recomputeContinuousAuras(state);
  assert.equal(ally.maxHealth, 7);
  ally.health -= 2;
  const markedDamage = ally.maxHealth - ally.health;

  source.health = 0;
  cleanupDead(state);
  const survivor = state.players.player.bench.find((unit) => unit.instanceId === ally.instanceId)!;
  assert.equal(state.players.player.bench.some((unit) => unit.instanceId === source.instanceId), false, "dead Unit source leaves the battlefield");
  assert.equal(survivor.maxHealth, 5, "lord Health bonus disappears with the source");
  assert.equal(survivor.maxHealth - survivor.health, markedDamage, "source departure preserves marked damage");
});

// Keyword lord: source does not gain its own keyword, other allies do, and removal restores the layer.
withRegisteredCardSnapshot([
  lordCard({ buffPower: 0, buffHealth: 0, keywords: ["Flying"] }, "test_aura23_keyword_lord"),
  testUnit("test_aura23_keyword_ally", "Spirit"),
], () => {
  const state = createGame("Aura 2.3 Keyword Lord", DECKS[3], DECKS[2], true, 643005);
  state.players.player.bench = [];
  state.players.ai.bench = [];
  const source = makeUnit(state, "test_aura23_keyword_lord", "player");
  state.players.player.bench.push(source);
  const ally = makeUnit(state, "test_aura23_keyword_ally", "player");
  state.players.player.bench.push(ally);
  recomputeContinuousAuras(state);

  assert.equal(source.keywords.includes("Flying"), false, "lord does not grant its own keyword to itself");
  assert.equal(ally.keywords.includes("Flying"), true, "other ally receives keyword from Unit source");
  assert.deepEqual(permanentAuraKeywordsForUnit(state, ally), ["Flying"]);

  source.health = 0;
  cleanupDead(state);
  assert.equal(ally.keywords.includes("Flying"), false, "keyword grant disappears when Unit source dies");
});

// Hostile Unit source reuses certified enemy stat/suppression layers.
withRegisteredCardSnapshot([
  lordCard({
    buffPower: -1,
    buffHealth: 0,
    affects: "enemies",
    suppressKeywords: ["Hexproof"],
  }, "test_aura23_hostile_lord", "Voidling"),
  testUnit("test_aura23_hexproof_enemy", "Spirit", 3, 5, ["Hexproof"]),
], () => {
  const state = createGame("Aura 2.3 Hostile Lord", DECKS[3], DECKS[2], true, 643006);
  state.players.player.bench = [];
  state.players.ai.bench = [];
  const source = makeUnit(state, "test_aura23_hostile_lord", "player");
  state.players.player.bench.push(source);
  const victim = makeUnit(state, "test_aura23_hexproof_enemy", "ai");
  state.players.ai.bench.push(victim);
  recomputeContinuousAuras(state);

  assert.equal(source.power, 2, "hostile Unit source never affects itself");
  assert.equal(victim.power, 2, "enemy Unit receives hostile stat modifier from Unit source");
  assert.equal(victim.keywords.includes("Hexproof"), false, "enemy Unit loses effective Hexproof while lord lives");
  assert.deepEqual(permanentAuraSuppressedKeywordsForUnit(state, victim), ["Hexproof"]);

  source.health = 0;
  cleanupDead(state);
  assert.equal(victim.power, 3, "hostile stat modifier reverses when source dies");
  assert.equal(victim.keywords.includes("Hexproof"), true, "suppressed durable keyword restores when source dies");
});

// Canonical semantic authoring accepts Unit-source Auras without changing the legacy validator.
const validAlliedLord = validateAuthorableCardWithSemanticTypes(lordCard({
  buffPower: 1,
  buffHealth: 1,
  keywords: ["Tough"],
  races: ["Dragon", "Beast"],
  classes: ["guardian"],
}, "valid_aura23_allied_lord"));
assert.equal(validAlliedLord.ok, true, "semantic authoring accepts allied Unit-source lord Aura");
assert.ok(validAlliedLord.ok);
assert.deepEqual(validAlliedLord.card.aura, {
  buffPower: 1,
  buffHealth: 1,
  keywords: ["Tough"],
  races: ["Dragon", "Beast"],
  classes: ["guardian"],
});

const validHostileLord = validateAuthorableCardWithSemanticTypes(lordCard({
  buffPower: 0,
  buffHealth: 0,
  affects: "enemies",
  suppressKeywords: ["Flying"],
}, "valid_aura23_hostile_lord"));
assert.equal(validHostileLord.ok, true, "semantic authoring accepts suppression-only hostile Unit Aura");
assert.ok(validHostileLord.ok);
assert.deepEqual(validHostileLord.card.aura, {
  buffPower: 0,
  buffHealth: 0,
  suppressKeywords: ["Flying"],
  affects: "enemies",
});

const invalidSpellSource = validateAuthorableCardWithSemanticTypes({
  defId: "invalid_aura23_spell_source",
  name: "Invalid Aura Spell",
  region: "Ironwood",
  type: "Spell",
  cost: 1,
  spell: { kind: "draw", amount: 1, target: "none" },
  aura: { buffPower: 1, buffHealth: 0 },
  description: "Invalid Aura source type.",
  rarity: "Common",
  emoji: "❌",
});
assert.equal(invalidSpellSource.ok, false, "Spell cannot become a continuous Aura source");

const unsafeBarrierLord = validateAuthorableCardWithSemanticTypes(lordCard({
  buffPower: 0,
  buffHealth: 0,
  keywords: ["Barrier"],
}, "invalid_aura23_barrier_lord"));
assert.equal(unsafeBarrierLord.ok, false, "Unit-source Aura keeps Barrier grant safety boundary");

const grammarCard = lordCard({
  buffPower: 1,
  buffHealth: 0,
  keywords: ["Flying"],
  races: ["Beast"],
}, "aura23_grammar_probe");
const blueprint = blueprintFromPermanentStatAura(grammarCard);
assert.ok(blueprint, "Ability Grammar projects Unit-source Aura through the compatibility envelope");
assert.equal(blueprint.target, "allyUnit");
assert.deepEqual(blueprint.features, ["conditional"]);
assert.deepEqual(blueprint.rule, {
  kind: "permanentStatAura",
  aura: {
    buffPower: 1,
    buffHealth: 0,
    keywords: ["Flying"],
    races: ["Beast"],
  },
});
assert.deepEqual(
  ABILITY_GRAMMAR_CATALOG.unitSourceAuraContract,
  UNIT_SOURCE_AURA_CONTRACT,
  "Ability Grammar publishes the Unit-source Aura contract consumed by runtime and Studio",
);
assert.equal(ABILITY_KIND_SUPPORT.aura, "partial", "generic cross-family layer/replacement rules remain outside Aura 2.3");

console.log("AURA 2.3 UNIT-SOURCE LORD EFFECTS: PASS — self exclusion, mutual lords, lifecycle, authoring and grammar certified");
