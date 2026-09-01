import assert from "node:assert/strict";
import "./aura-2-types";
import {
  ABILITY_GRAMMAR_CATALOG,
  blueprintFromPermanentStatAura,
} from "./ability-system";
import { withRegisteredCardSnapshot } from "./custom-registry";
import { DECKS } from "./decks";
import {
  PERMANENT_ENEMY_STAT_AURA_CONTRACT,
  cleanupDead,
  createGame,
  makePermanent,
  makeUnit,
  permanentAuraBonusForUnit,
  permanentAuraKeywordsForUnit,
  recomputeContinuousAuras,
} from "./engine";
import { validateAuthorableCardWithSemanticTypes } from "./semantic-card-type-authoring";
import type { CardDef, PermanentStatAura } from "./types";

const enemyAuraCard = (
  aura: PermanentStatAura,
  defId = "test_enemy_stat_aura",
): CardDef => ({
  defId,
  name: "Enemy Stat Aura",
  region: "Voidborn",
  type: "Enchantment",
  cost: 3,
  maxHealth: 3,
  aura,
  description: "Continuous hostile stat pressure.",
  rarity: "Rare",
  emoji: "☠",
});

assert.deepEqual(PERMANENT_ENEMY_STAT_AURA_CONTRACT, {
  rule: "permanentEnemyStatAura",
  sources: ["Enchantment", "Artifact"],
  target: "enemyUnit",
  stats: ["power", "health"],
  direction: "nonPositive",
  powerFloor: 0,
  lifecycle: "whileSourceInPlay",
  stacking: "additive",
  support: "supported",
});

withRegisteredCardSnapshot([
  enemyAuraCard({ buffPower: -20, buffHealth: -1, affects: "enemies" }),
], () => {
  const state = createGame("Aura 2.1", DECKS[3], DECKS[2], true, 641001);
  state.players.player.bench = [];
  state.players.ai.bench = [];
  state.players.player.permanents = [];
  state.players.ai.permanents = [];

  const ally = makeUnit(state, "wood_cub", "player");
  const enemy = makeUnit(state, "wood_cub", "ai");
  state.players.player.bench.push(ally);
  state.players.ai.bench.push(enemy);
  const allyPower = ally.power;
  const allyMaxHealth = ally.maxHealth;
  const enemyBaseMaxHealth = enemy.maxHealth;
  enemy.health -= 1;
  const markedDamage = enemy.maxHealth - enemy.health;

  state.players.player.permanents.push(makePermanent(state, "test_enemy_stat_aura", "player"));
  recomputeContinuousAuras(state);

  assert.equal(ally.power, allyPower, "hostile Aura never debuffs its source owner's allies");
  assert.equal(ally.maxHealth, allyMaxHealth);
  assert.equal(enemy.power, 0, "oversized continuous Power debuff floors effective Power at zero");
  assert.equal(enemy.maxHealth, enemyBaseMaxHealth - 1, "hostile Aura continuously reduces enemy max health");
  assert.equal(enemy.maxHealth - enemy.health, markedDamage, "Aura entry preserves marked damage instead of dealing/healing damage");
  assert.deepEqual(permanentAuraBonusForUnit(state, enemy), {
    power: -Math.max(0, enemy.basePower + enemy.powerBuffs),
    health: -1,
    sources: 1,
  });

  state.players.player.permanents[0].health = 0;
  cleanupDead(state);
  assert.equal(enemy.maxHealth, enemyBaseMaxHealth, "removing hostile Aura restores max health");
  assert.equal(enemy.maxHealth - enemy.health, markedDamage, "Aura departure preserves the same marked damage");
  assert.equal(enemy.power >= 0, true, "Aura departure cannot leave negative effective Power behind");
});

withRegisteredCardSnapshot([
  enemyAuraCard({ buffPower: -1, buffHealth: -2, affects: "enemies", races: ["Beast"], classes: ["guardian"] }),
], () => {
  const state = createGame("Aura 2.1 Filters", DECKS[3], DECKS[2], true, 641002);
  state.players.player.permanents = [makePermanent(state, "test_enemy_stat_aura", "player")];
  state.players.player.bench = [];
  state.players.ai.bench = [];

  const matching = makeUnit(state, "wood_cub", "ai");
  matching.classes = ["guardian"];
  const wrongClass = makeUnit(state, "wood_cub", "ai");
  wrongClass.classes = ["ranger"];
  const alliedSameIdentity = makeUnit(state, "wood_cub", "player");
  alliedSameIdentity.classes = ["guardian"];

  assert.equal(permanentAuraBonusForUnit(state, matching).sources, 1, "enemy Aura keeps race/class filter semantics");
  assert.equal(permanentAuraBonusForUnit(state, wrongClass).sources, 0, "race + class groups still combine as AND");
  assert.equal(permanentAuraBonusForUnit(state, alliedSameIdentity).sources, 0, "matching filters do not override source/target relationship");
});

withRegisteredCardSnapshot([
  enemyAuraCard({ buffPower: -2, buffHealth: 0, affects: "enemies" }, "test_ai_enemy_aura"),
], () => {
  const state = createGame("Aura 2.1 Direction", DECKS[2], DECKS[3], true, 641003);
  state.players.player.bench = [];
  state.players.ai.bench = [];
  state.players.player.permanents = [];
  state.players.ai.permanents = [makePermanent(state, "test_ai_enemy_aura", "ai")];

  const playerUnit = makeUnit(state, "wood_cub", "player");
  const aiUnit = makeUnit(state, "wood_cub", "ai");
  assert.equal(permanentAuraBonusForUnit(state, playerUnit).sources, 1, "AI-owned hostile Aura debuffs the human player's bench");
  assert.equal(permanentAuraBonusForUnit(state, aiUnit).sources, 0, "AI-owned hostile Aura never debuffs its own bench");
});

withRegisteredCardSnapshot([
  enemyAuraCard({ buffPower: 0, buffHealth: -20, affects: "enemies" }, "test_lethal_enemy_aura"),
], () => {
  const state = createGame("Aura 2.1 Lethal", DECKS[3], DECKS[2], true, 641004);
  state.players.player.bench = [];
  state.players.ai.bench = [];
  state.players.player.permanents = [];
  const victim = makeUnit(state, "wood_cub", "ai");
  state.players.ai.bench.push(victim);
  state.players.player.permanents.push(makePermanent(state, "test_lethal_enemy_aura", "player"));

  recomputeContinuousAuras(state);
  cleanupDead(state);
  assert.equal(state.players.ai.bench.some((unit) => unit.instanceId === victim.instanceId), false, "continuous max-health reduction may become lethal and cleanup resolves it");
});

withRegisteredCardSnapshot([
  enemyAuraCard({ buffPower: -1, buffHealth: 0, affects: "enemies", keywords: ["Flying"] }, "test_malformed_enemy_keyword_aura"),
], () => {
  const state = createGame("Aura 2.1 Runtime Guard", DECKS[3], DECKS[2], true, 641005);
  state.players.player.permanents = [makePermanent(state, "test_malformed_enemy_keyword_aura", "player")];
  const enemy = makeUnit(state, "wood_cub", "ai");
  assert.deepEqual(permanentAuraKeywordsForUnit(state, enemy), [], "runtime ignores malformed enemy keyword payloads even if they bypass authoring");
});

const valid = validateAuthorableCardWithSemanticTypes(enemyAuraCard({
  buffPower: -2,
  buffHealth: -1,
  affects: "enemies",
  races: ["Beast"],
}));
assert.equal(valid.ok, true, "semantic authoring accepts certified hostile stat Aura");
assert.ok(valid.ok);
assert.deepEqual(valid.card.aura, {
  buffPower: -2,
  buffHealth: -1,
  races: ["Beast"],
  affects: "enemies",
});

for (const [label, aura] of [
  ["enemy positive stat", { buffPower: 1, buffHealth: -1, affects: "enemies" }],
  ["enemy zero-zero", { buffPower: 0, buffHealth: 0, affects: "enemies" }],
  ["enemy keyword", { buffPower: -1, buffHealth: 0, affects: "enemies", keywords: ["Flying"] }],
  ["allied negative stat", { buffPower: -1, buffHealth: 0, affects: "allies" }],
  ["invalid audience", { buffPower: -1, buffHealth: 0, affects: "everyone" }],
] as const) {
  const result = validateAuthorableCardWithSemanticTypes(enemyAuraCard(aura as unknown as PermanentStatAura, `invalid_${label.replace(/[^a-z]+/g, "_")}`));
  assert.equal(result.ok, false, `${label} must fail closed`);
}

const grammarCard = enemyAuraCard({ buffPower: -2, buffHealth: -1, affects: "enemies", races: ["Beast"] }, "aura21_grammar_probe");
const blueprint = blueprintFromPermanentStatAura(grammarCard);
assert.ok(blueprint);
assert.equal(blueprint.target, "enemyUnit", "Ability Grammar exposes hostile Aura direction rather than pretending it is allied");
assert.deepEqual(blueprint.rule, {
  kind: "permanentStatAura",
  aura: { buffPower: -2, buffHealth: -1, affects: "enemies", races: ["Beast"] },
});
assert.deepEqual(
  ABILITY_GRAMMAR_CATALOG.permanentEnemyStatAuraContract,
  PERMANENT_ENEMY_STAT_AURA_CONTRACT,
  "Ability Grammar publishes the same hostile Aura contract used by runtime/Studio",
);

console.log("AURA 2.1 ENEMY DEBUFFS: PASS — direction, filters, power floor, health lethality, lifecycle, authoring and grammar certified");
