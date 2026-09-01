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
  SENTINELA_SOURCE_AURA_CONTRACT,
  createGame,
  makeUnit,
  permanentAuraBonusForUnit,
  permanentAuraKeywordsForUnit,
  permanentAuraSuppressedKeywordsForUnit,
  playUnit,
  recomputeContinuousAuras,
} from "./engine";
import { cleanupSentinelas } from "./engine/sentinela-state";
import { validateAuthorableCardWithSemanticTypes } from "./semantic-card-type-authoring";
import type { CardDef, PermanentStatAura, Race, SentinelaInstance } from "./types";

const commandCard = (
  aura: PermanentStatAura,
  defId = "test_aura24_command",
): CardDef => ({
  defId,
  name: "Command Sentinel",
  region: "Ironwood",
  type: "Sentinela",
  cost: 4,
  aura,
  description: "A Sentinela projects a continuous command Aura.",
  rarity: "Legend",
  emoji: "🜲",
  sentinela: {
    startingLoyalty: 4,
    abilities: [
      {
        cost: 1,
        description: "+1: compre 1.",
        effect: { kind: "draw", amount: 1, target: "none" },
      },
    ],
  },
});

const unitCard = (
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
  description: "Aura 2.4 test unit.",
  rarity: "Common",
  emoji: "🧪",
});

const sentinelaInstance = (
  defId: string,
  owner: "player" | "ai",
  loyalty = 4,
  instanceId = `sen_${defId}_${owner}`,
): SentinelaInstance => ({
  instanceId,
  defId,
  owner,
  loyalty,
  activatedThisTurn: false,
});

assert.deepEqual(SENTINELA_SOURCE_AURA_CONTRACT, {
  rule: "sentinelaSourceAura",
  sources: ["Sentinela"],
  sourceZone: "sentinelas",
  targets: ["allyUnit", "enemyUnit"],
  alliedEffects: ["nonNegativeStats", "keywordGrants"],
  enemyEffects: ["nonPositiveStats", "keywordSuppressions"],
  lifecycle: "whileSourceHasPositiveLoyalty",
  statStacking: "additive",
  keywordStacking: "setUnion",
  support: "supported",
});

// Allied Command Aura: stats, keyword grants and filters reuse the certified Aura layers.
withRegisteredCardSnapshot([
  commandCard({ buffPower: 1, buffHealth: 1, keywords: ["Flying"], races: ["Beast"] }),
  unitCard("test_aura24_beast", "Beast", 3, 4),
  unitCard("test_aura24_spirit", "Spirit", 3, 4),
], () => {
  const state = createGame("Aura 2.4 Command", DECKS[3], DECKS[2], true, 644001);
  state.players.player.bench = [];
  state.players.ai.bench = [];
  state.players.player.permanents = [];
  state.players.ai.permanents = [];
  state.players.player.sentinelas = [sentinelaInstance("test_aura24_command", "player")];
  state.players.ai.sentinelas = [];

  const matching = makeUnit(state, "test_aura24_beast", "player");
  const wrongRace = makeUnit(state, "test_aura24_spirit", "player");
  state.players.player.bench.push(matching, wrongRace);
  recomputeContinuousAuras(state);

  assert.equal(matching.power, 4);
  assert.equal(matching.maxHealth, 5);
  assert.equal(matching.keywords.includes("Flying"), true);
  assert.deepEqual(permanentAuraBonusForUnit(state, matching), { power: 1, health: 1, sources: 1 });
  assert.deepEqual(permanentAuraKeywordsForUnit(state, matching), ["Flying"]);
  assert.equal(wrongRace.power, 3, "race filter excludes non-matching allies");
  assert.equal(wrongRace.keywords.includes("Flying"), false);
});

// Real play path: a Sentinela command source applies immediately after successful play.
withRegisteredCardSnapshot([
  commandCard({ buffPower: 1, buffHealth: 0 }, "test_aura24_play_command"),
  unitCard("test_aura24_play_ally", "Spirit", 2, 4),
], () => {
  const state = createGame("Aura 2.4 Play", DECKS[3], DECKS[2], true, 644002);
  state.players.player.bench = [makeUnit(state, "test_aura24_play_ally", "player")];
  state.players.player.sentinelas = [];
  state.players.player.hand = [{ instanceId: "aura24_sentinel_card", defId: "test_aura24_play_command" }];
  state.players.player.mana = 10;
  state.activePlayer = "player";
  state.phase = "main";

  const next = playUnit(state, "player", "aura24_sentinel_card");
  assert.equal(next.players.player.sentinelas.length, 1, "Sentinela enters through authoritative play path");
  assert.equal(next.players.player.bench[0].power, 3, "command Aura is recomputed immediately on entry");
});

// Loyalty-zero cleanup removes the source and reverses Health/keyword layers in the same transition.
withRegisteredCardSnapshot([
  commandCard({ buffPower: 0, buffHealth: 2, keywords: ["Flying"] }, "test_aura24_lifecycle_command"),
  unitCard("test_aura24_damaged_ally", "Spirit", 2, 5),
], () => {
  const state = createGame("Aura 2.4 Loyalty", DECKS[3], DECKS[2], true, 644003);
  state.players.player.bench = [];
  const ally = makeUnit(state, "test_aura24_damaged_ally", "player");
  state.players.player.bench.push(ally);
  state.players.player.sentinelas = [sentinelaInstance("test_aura24_lifecycle_command", "player", 1)];
  recomputeContinuousAuras(state);
  assert.equal(ally.maxHealth, 7);
  assert.equal(ally.keywords.includes("Flying"), true);
  ally.health -= 2;
  const markedDamage = ally.maxHealth - ally.health;

  state.players.player.sentinelas[0].loyalty = 0;
  cleanupSentinelas(state);

  assert.equal(state.players.player.sentinelas.length, 0, "zero-loyalty command source is removed");
  assert.equal(ally.maxHealth, 5, "Health Aura disappears immediately with the Sentinela");
  assert.equal(ally.maxHealth - ally.health, markedDamage, "marked damage is preserved when command Health leaves");
  assert.equal(ally.keywords.includes("Flying"), false, "source-bound keyword grant disappears in the same cleanup transition");
});

// A zero-loyalty source never contributes even before cleanup has physically removed it.
withRegisteredCardSnapshot([
  commandCard({ buffPower: 5, buffHealth: 0 }, "test_aura24_zero_command"),
  unitCard("test_aura24_zero_ally", "Spirit", 2, 4),
], () => {
  const state = createGame("Aura 2.4 Zero", DECKS[3], DECKS[2], true, 644004);
  state.players.player.bench = [makeUnit(state, "test_aura24_zero_ally", "player")];
  state.players.player.sentinelas = [sentinelaInstance("test_aura24_zero_command", "player", 0)];
  recomputeContinuousAuras(state);
  assert.equal(state.players.player.bench[0].power, 2, "non-positive loyalty sources fail closed at derivation time");
  assert.equal(permanentAuraBonusForUnit(state, state.players.player.bench[0]).sources, 0);
});

// Hostile command Aura reuses enemy stat debuff and keyword-suppression semantics.
withRegisteredCardSnapshot([
  commandCard({
    buffPower: -1,
    buffHealth: 0,
    affects: "enemies",
    suppressKeywords: ["Hexproof"],
  }, "test_aura24_hostile_command"),
  unitCard("test_aura24_hexproof_enemy", "Spirit", 3, 5, ["Hexproof"]),
], () => {
  const state = createGame("Aura 2.4 Hostile", DECKS[3], DECKS[2], true, 644005);
  state.players.player.sentinelas = [sentinelaInstance("test_aura24_hostile_command", "player")];
  state.players.ai.bench = [makeUnit(state, "test_aura24_hexproof_enemy", "ai")];
  const victim = state.players.ai.bench[0];
  recomputeContinuousAuras(state);

  assert.equal(victim.power, 2);
  assert.equal(victim.keywords.includes("Hexproof"), false);
  assert.deepEqual(permanentAuraSuppressedKeywordsForUnit(state, victim), ["Hexproof"]);

  state.players.player.sentinelas[0].loyalty = 0;
  cleanupSentinelas(state);
  assert.equal(victim.power, 3);
  assert.equal(victim.keywords.includes("Hexproof"), true, "durable keyword restores when hostile command ends");
});

// Canonical semantic authoring accepts Sentinela command Auras, preserving the legacy validator boundary.
const validCommand = validateAuthorableCardWithSemanticTypes(commandCard({
  buffPower: 1,
  buffHealth: 1,
  keywords: ["Tough"],
  races: ["Beast"],
  classes: ["guardian"],
}, "valid_aura24_command"));
assert.equal(validCommand.ok, true, "semantic authoring accepts allied Sentinela command Aura");
assert.ok(validCommand.ok);
assert.deepEqual(validCommand.card.aura, {
  buffPower: 1,
  buffHealth: 1,
  keywords: ["Tough"],
  races: ["Beast"],
  classes: ["guardian"],
});

const validHostileCommand = validateAuthorableCardWithSemanticTypes(commandCard({
  buffPower: 0,
  buffHealth: 0,
  affects: "enemies",
  suppressKeywords: ["Flying"],
}, "valid_aura24_hostile_command"));
assert.equal(validHostileCommand.ok, true, "suppression-only hostile Sentinela Aura is authorable");

const unsafeBarrierCommand = validateAuthorableCardWithSemanticTypes(commandCard({
  buffPower: 0,
  buffHealth: 0,
  keywords: ["Barrier"],
}, "invalid_aura24_barrier_command"));
assert.equal(unsafeBarrierCommand.ok, false, "Sentinela-source Aura keeps Barrier safety boundary");

const invalidSpellSource = validateAuthorableCardWithSemanticTypes({
  defId: "invalid_aura24_spell",
  name: "Invalid Aura Spell",
  region: "Ironwood",
  type: "Spell",
  cost: 1,
  spell: { kind: "draw", amount: 1, target: "none" },
  aura: { buffPower: 1, buffHealth: 0 },
  description: "Invalid source.",
  rarity: "Common",
  emoji: "❌",
});
assert.equal(invalidSpellSource.ok, false);

const grammarCard = commandCard({
  buffPower: 1,
  buffHealth: 0,
  keywords: ["Flying"],
  races: ["Beast"],
}, "aura24_grammar_probe");
const blueprint = blueprintFromPermanentStatAura(grammarCard);
assert.ok(blueprint, "Ability Grammar projects Sentinela command Aura through compatibility envelope");
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
  ABILITY_GRAMMAR_CATALOG.sentinelaSourceAuraContract,
  SENTINELA_SOURCE_AURA_CONTRACT,
  "Ability Grammar publishes the same Sentinela source contract used by runtime/Studio",
);
assert.equal(ABILITY_KIND_SUPPORT.aura, "partial", "generic cross-family continuous layers remain intentionally partial");

console.log("AURA 2.4 SENTINELA COMMAND AURAS: PASS — entry, loyalty lifecycle, filters, suppression, authoring and grammar certified");
