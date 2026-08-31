import assert from "node:assert/strict";
import "./aura-2-types";
import { withRegisteredCardSnapshot } from "./custom-registry";
import { DECKS } from "./decks";
import {
  PERMANENT_KEYWORD_AURA_CONTRACT,
  PERMANENT_STAT_AURA_CONTRACT,
  applyCardEffectForSandbox,
  cleanupDead,
  createGame,
  makePermanent,
  makeUnit,
  permanentAuraAppliesToUnit,
  permanentAuraBonusForUnit,
  permanentAuraKeywordsForUnit,
  playUnit,
  recomputeContinuousAuras,
  recomputeHealth,
  recomputeStats,
} from "./engine";
import type { CardDef, PermanentStatAura } from "./types";

const auraCard = (aura: PermanentStatAura, defId = "test_stat_aura"): CardDef => ({
  defId,
  name: "Test Stat Aura",
  region: "Ironwood",
  type: "Enchantment",
  cost: 2,
  maxHealth: 3,
  aura,
  description: "Continuous test aura.",
  rarity: "Common",
  emoji: "◉",
});

assert.deepEqual(PERMANENT_STAT_AURA_CONTRACT, {
  rule: "permanentStatAura",
  sources: ["Enchantment", "Artifact"],
  target: "allyUnit",
  stats: ["power", "health"],
  lifecycle: "whileSourceInPlay",
  stacking: "additive",
  support: "supported",
});
assert.equal(PERMANENT_KEYWORD_AURA_CONTRACT.rule, "permanentKeywordAura");
assert.equal(PERMANENT_KEYWORD_AURA_CONTRACT.stacking, "setUnion");
assert.ok(PERMANENT_KEYWORD_AURA_CONTRACT.keywords.includes("Flying"));
assert.equal(PERMANENT_KEYWORD_AURA_CONTRACT.keywords.includes("Barrier"), false, "consumable Barrier is deliberately not continuously re-grantable");
assert.equal(PERMANENT_KEYWORD_AURA_CONTRACT.keywords.includes("LastBreath"), false, "trigger-bound LastBreath is not a plain Aura grant");

withRegisteredCardSnapshot([auraCard({ buffPower: 2, buffHealth: 3 })], () => {
  const state = createGame("Aura", DECKS[2], DECKS[0], true, 640001);
  state.players.player.bench = [];
  state.players.ai.bench = [];

  const ally = makeUnit(state, "wood_cub", "player");
  const enemy = makeUnit(state, "wood_cub", "ai");
  state.players.player.bench.push(ally);
  state.players.ai.bench.push(enemy);
  const basePower = ally.power;
  const baseMaxHealth = ally.maxHealth;
  ally.health -= 2;
  const markedDamage = ally.maxHealth - ally.health;

  const source = makePermanent(state, "test_stat_aura", "player");
  state.players.player.permanents.push(source);
  recomputeContinuousAuras(state);

  assert.equal(ally.power, basePower + 2, "Aura adds live power without mutating durable buffs");
  assert.equal(ally.maxHealth, baseMaxHealth + 3, "Aura adds live max health");
  assert.equal(ally.maxHealth - ally.health, markedDamage, "Aura entry preserves marked damage instead of healing it");
  assert.equal(ally.powerBuffs, 0, "Aura power never accumulates into durable powerBuffs");
  assert.equal(ally.healthBuffs, 0, "Aura health never accumulates into durable healthBuffs");
  assert.equal(ally.auraPowerBonus, 2);
  assert.equal(ally.auraHealthBonus, 3);
  assert.equal(enemy.auraPowerBonus, 0, "enemy units never receive an opposing player's Aura");
  assert.equal(enemy.auraHealthBonus, 0);
  assert.deepEqual(permanentAuraBonusForUnit(state, ally), { power: 2, health: 3, sources: 1 });

  const second = makePermanent(state, "test_stat_aura", "player");
  state.players.player.permanents.push(second);
  recomputeContinuousAuras(state);
  assert.equal(ally.power, basePower + 4, "multiple active Aura sources stack additively");
  assert.equal(ally.maxHealth, baseMaxHealth + 6);
  assert.equal(ally.maxHealth - ally.health, markedDamage, "stacking Auras preserve damage");

  second.health = 0;
  assert.deepEqual(permanentAuraBonusForUnit(state, ally), { power: 2, health: 3, sources: 1 }, "a dead source stops contributing immediately");
  cleanupDead(state);
  assert.equal(state.players.player.permanents.length, 1, "dead Aura source is removed by cleanup");
  assert.equal(ally.power, basePower + 2);
  assert.equal(ally.maxHealth, baseMaxHealth + 3);
  assert.equal(ally.maxHealth - ally.health, markedDamage, "Aura removal preserves marked damage");

  ally.frostbitten = true;
  recomputeStats(ally);
  assert.equal(ally.power, 0, "Frostbite remains authoritative over Aura power");
  ally.frostbitten = false;
  ally.equipment.push({ instanceId: "aura-eq", defId: "wood_claw" });
  recomputeStats(ally);
  recomputeHealth(ally);
  assert.equal(ally.power, basePower + 3, "Equipment and Aura power compose without overwriting each other");
  assert.equal(ally.maxHealth, baseMaxHealth + 4, "Equipment and Aura health compose without overwriting each other");
  ally.permanentHealthModifier = -1;
  recomputeHealth(ally);
  assert.equal(ally.maxHealth, baseMaxHealth + 3, "Wither/permanent max-health modifiers remain independent from Aura");
});

withRegisteredCardSnapshot([auraCard({ buffPower: 1, buffHealth: 1, races: ["Beast", "Spirit"], classes: ["guardian", "mage"] })], () => {
  const state = createGame("Aura Filters", DECKS[2], DECKS[0], true, 640002);
  state.players.player.permanents = [makePermanent(state, "test_stat_aura", "player")];

  const match = makeUnit(state, "wood_cub", "player");
  match.classes = ["guardian"];
  assert.equal(permanentAuraAppliesToUnit({ buffPower: 1, buffHealth: 1, races: ["Beast", "Spirit"], classes: ["guardian", "mage"] }, match), true);

  const wrongClass = makeUnit(state, "wood_cub", "player");
  wrongClass.classes = ["ranger"];
  assert.equal(permanentAuraBonusForUnit(state, wrongClass).sources, 0, "race + class filter groups combine as AND");

  const secondRace = makeUnit(state, "wood_champion", "player");
  secondRace.classes = ["mage"];
  assert.equal(permanentAuraBonusForUnit(state, secondRace).sources, 1, "values inside each race/class list match as OR");

  const newUnit = makeUnit(state, "wood_cub", "player");
  newUnit.classes = ["guardian"];
  state.players.player.bench.push(newUnit);
  recomputeContinuousAuras(state);
  const baselineState = createGame("Baseline", DECKS[2], DECKS[0], true, 640003);
  baselineState.players.player.permanents = [];
  const baseline = makeUnit(baselineState, "wood_cub", "player");
  assert.equal(newUnit.power, baseline.power + 1, "new units derive live Aura after their authored class identity is present on the battlefield");
  assert.equal(newUnit.maxHealth, baseline.maxHealth + 1);
});

withRegisteredCardSnapshot([auraCard({ buffPower: 0, buffHealth: 3 })], () => {
  const state = createGame("Aura Lethal", DECKS[2], DECKS[0], true, 640004);
  state.players.player.bench = [];
  state.players.player.permanents = [makePermanent(state, "test_stat_aura", "player")];
  const unit = makeUnit(state, "wood_cub", "player");
  state.players.player.bench.push(unit);
  unit.health -= 4;
  assert.ok(unit.health > 0, "fixture survives four damage only because +Health Aura is active");
  state.players.player.permanents[0].health = 0;
  cleanupDead(state);
  assert.equal(state.players.player.permanents.length, 0);
  assert.equal(state.players.player.bench.some((candidate) => candidate.instanceId === unit.instanceId), false, "removing a life-supporting Aura kills a unit whose marked damage becomes lethal");
  assert.equal(state.log.some((line) => line.includes("safety boundary")), false, "ordinary Aura cleanup stabilizes before the bounded-loop guard");
});

withRegisteredCardSnapshot([auraCard({ buffPower: 2, buffHealth: 2 })], () => {
  const state = createGame("Aura Play Path", DECKS[2], DECKS[0], true, 640005);
  state.players.player.bench = [];
  const unit = makeUnit(state, "wood_cub", "player");
  state.players.player.bench.push(unit);
  const basePower = unit.power;
  const baseHealth = unit.maxHealth;
  state.players.player.hand = [{ instanceId: "aura-card-in-hand", defId: "test_stat_aura" }];
  state.players.player.mana = 10;
  state.players.player.spellMana = 0;
  state.activePlayer = "player";

  const played = playUnit(state, "player", "aura-card-in-hand");
  assert.equal(played.players.player.permanents.length, 1, "normal card-play path puts authored Aura source on battlefield");
  assert.equal(played.players.player.bench[0].power, basePower + 2, "normal card-play path immediately derives Aura power");
  assert.equal(played.players.player.bench[0].maxHealth, baseHealth + 2, "normal card-play path immediately derives Aura health");
});

withRegisteredCardSnapshot([
  auraCard({ buffPower: 0, buffHealth: 0, keywords: ["Flying", "Hexproof"] }, "test_keyword_aura"),
], () => {
  const state = createGame("Aura Keywords", DECKS[2], DECKS[0], true, 640006);
  state.players.player.bench = [];
  state.players.ai.bench = [];
  const ally = makeUnit(state, "wood_cub", "player");
  const enemy = makeUnit(state, "wood_cub", "ai");
  state.players.player.bench.push(ally);
  state.players.ai.bench.push(enemy);
  state.players.player.permanents = [makePermanent(state, "test_keyword_aura", "player")];

  recomputeContinuousAuras(state);
  assert.deepEqual(permanentAuraKeywordsForUnit(state, ally).sort(), ["Flying", "Hexproof"]);
  assert.deepEqual(ally.auraKeywords?.sort(), ["Flying", "Hexproof"]);
  assert.equal(ally.keywords.includes("Flying"), true, "Aura keyword becomes effective immediately");
  assert.equal(ally.keywords.includes("Hexproof"), true);
  assert.equal(ally.durableKeywords?.includes("Flying"), false, "Aura keyword is not persisted as a durable grant");
  assert.equal(enemy.keywords.includes("Flying"), false, "enemy units never inherit allied Aura keywords");

  const granted = applyCardEffectForSandbox(
    state,
    "player",
    { kind: "grantKeyword", amount: 0, target: "allyUnit", keyword: "Flying" },
    ally.instanceId,
  );
  const grantedAlly = granted.players.player.bench.find((unit) => unit.instanceId === ally.instanceId)!;
  assert.equal(grantedAlly.durableKeywords?.includes("Flying"), true, "one-shot grant is recorded durably even while the same Aura keyword is active");

  granted.players.player.permanents[0].health = 0;
  cleanupDead(granted);
  assert.equal(grantedAlly.keywords.includes("Flying"), true, "durably granted overlap survives Aura departure");
  assert.equal(grantedAlly.keywords.includes("Hexproof"), false, "Aura-only keyword disappears with its source");
  assert.deepEqual(grantedAlly.auraKeywords, []);
});

console.log("PERMANENT AURA 2.0: PASS — stats, continuous keywords, provenance, stacking, filters, damage preservation, lethal removal and play path certified");
