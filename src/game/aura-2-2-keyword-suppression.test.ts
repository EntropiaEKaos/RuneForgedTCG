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
  PERMANENT_KEYWORD_SUPPRESSION_AURA_CONTRACT,
  applyCardEffectForSandbox,
  castSpell,
  cleanupDead,
  createGame,
  makePermanent,
  makeUnit,
  permanentAuraSuppressedKeywordsForUnit,
  recomputeContinuousAuras,
} from "./engine";
import { AURA_SUPPRESSIBLE_KEYWORDS } from "./keywords";
import { validateAuthorableCardWithSemanticTypes } from "./semantic-card-type-authoring";
import type { CardDef, PermanentStatAura } from "./types";

const enemyAuraCard = (
  aura: PermanentStatAura,
  defId = "test_keyword_suppression_aura",
): CardDef => ({
  defId,
  name: "Keyword Suppression Aura",
  region: "Voidborn",
  type: "Enchantment",
  cost: 3,
  maxHealth: 3,
  aura,
  description: "Continuous hostile keyword suppression.",
  rarity: "Rare",
  emoji: "🕸",
});

const hexproofUnit: CardDef = {
  defId: "test_aura22_hexproof_unit",
  name: "Veiled Witness",
  region: "Tidecall",
  type: "Unit",
  cost: 2,
  power: 2,
  health: 4,
  race: "Spirit",
  keywords: ["Hexproof"],
  description: "Hexproof test unit.",
  rarity: "Common",
  emoji: "🔮",
};

const pingSpell: CardDef = {
  defId: "test_aura22_ping",
  name: "Piercing Spark",
  region: "Emberhold",
  type: "Spell",
  cost: 0,
  spell: { kind: "damageUnit", amount: 1, target: "enemyUnit" },
  description: "Deal 1 to an enemy unit.",
  rarity: "Common",
  emoji: "✨",
};

assert.equal(PERMANENT_KEYWORD_SUPPRESSION_AURA_CONTRACT.rule, "permanentKeywordSuppressionAura");
assert.equal(PERMANENT_KEYWORD_SUPPRESSION_AURA_CONTRACT.target, "enemyUnit");
assert.equal(PERMANENT_KEYWORD_SUPPRESSION_AURA_CONTRACT.precedence, "afterDurableAndAuraGrants");
assert.equal(PERMANENT_KEYWORD_SUPPRESSION_AURA_CONTRACT.restoration, "automaticWhenSourceLeaves");
assert.equal(AURA_SUPPRESSIBLE_KEYWORDS.includes("Flying"), true);
assert.equal(AURA_SUPPRESSIBLE_KEYWORDS.includes("Barrier"), false, "consumable Barrier state is outside plain keyword suppression");
assert.equal(AURA_SUPPRESSIBLE_KEYWORDS.includes("LastBreath"), false, "trigger-bound LastBreath is outside plain keyword suppression");

// Printed keyword: suppression hides the effective keyword without erasing its durable origin.
withRegisteredCardSnapshot([
  enemyAuraCard({ buffPower: 0, buffHealth: 0, affects: "enemies", suppressKeywords: ["Flying"] }),
], () => {
  const state = createGame("Aura 2.2 Printed", DECKS[3], DECKS[2], true, 642001);
  state.players.player.bench = [];
  state.players.ai.bench = [];
  state.players.player.permanents = [makePermanent(state, "test_keyword_suppression_aura", "player")];
  state.players.ai.permanents = [];

  const victim = makeUnit(state, "convergence_eclipse_herald", "ai");
  state.players.ai.bench.push(victim);

  assert.equal(victim.durableKeywords?.includes("Flying"), true, "printed Flying remains durable under suppression");
  assert.deepEqual(victim.auraSuppressedKeywords, ["Flying"]);
  assert.equal(victim.keywords.includes("Flying"), false, "suppressed printed keyword is absent from the effective runtime view");

  state.players.player.permanents[0].health = 0;
  cleanupDead(state);
  const restored = state.players.ai.bench.find((unit) => unit.instanceId === victim.instanceId)!;
  assert.equal(restored.keywords.includes("Flying"), true, "printed keyword automatically returns when suppressing source leaves");
  assert.deepEqual(restored.auraSuppressedKeywords, []);
});

// Allied Aura grant and hostile suppression overlap: suppression wins, then restoration re-exposes the grant.
withRegisteredCardSnapshot([
  enemyAuraCard({ buffPower: 0, buffHealth: 0, affects: "enemies", suppressKeywords: ["Flying"] }, "test_flying_suppressor"),
  {
    defId: "test_flying_grant_aura",
    name: "Flying Grant Aura",
    region: "Ironwood",
    type: "Enchantment",
    cost: 2,
    maxHealth: 3,
    aura: { buffPower: 0, buffHealth: 0, keywords: ["Flying"] },
    description: "Allies have Flying.",
    rarity: "Common",
    emoji: "🪽",
  },
], () => {
  const state = createGame("Aura 2.2 Layers", DECKS[3], DECKS[2], true, 642002);
  state.players.player.bench = [];
  state.players.ai.bench = [];
  state.players.player.permanents = [makePermanent(state, "test_flying_suppressor", "player")];
  state.players.ai.permanents = [makePermanent(state, "test_flying_grant_aura", "ai")];

  const victim = makeUnit(state, "wood_cub", "ai");
  state.players.ai.bench.push(victim);
  assert.deepEqual(victim.auraKeywords, ["Flying"], "underlying allied Aura grant is preserved as provenance");
  assert.deepEqual(victim.auraSuppressedKeywords, ["Flying"]);
  assert.equal(victim.keywords.includes("Flying"), false, "hostile suppression wins after allied Aura grants");

  state.players.player.permanents[0].health = 0;
  cleanupDead(state);
  assert.equal(victim.keywords.includes("Flying"), true, "grant reappears while its allied source still exists");

  state.players.ai.permanents[0].health = 0;
  cleanupDead(state);
  assert.equal(victim.keywords.includes("Flying"), false, "grant does not survive after its own source also leaves");
});

// A durable one-shot grant made while suppressed must be remembered and become effective later.
withRegisteredCardSnapshot([
  enemyAuraCard({ buffPower: 0, buffHealth: 0, affects: "enemies", suppressKeywords: ["Flying"] }),
], () => {
  const state = createGame("Aura 2.2 Durable", DECKS[3], DECKS[2], true, 642003);
  state.players.player.bench = [];
  state.players.ai.bench = [];
  state.players.player.permanents = [makePermanent(state, "test_keyword_suppression_aura", "player")];
  const victim = makeUnit(state, "wood_cub", "ai");
  state.players.ai.bench.push(victim);

  const granted = applyCardEffectForSandbox(
    state,
    "ai",
    { kind: "grantKeyword", amount: 0, target: "allyUnit", keyword: "Flying" },
    victim.instanceId,
  );
  const grantedVictim = granted.players.ai.bench.find((unit) => unit.instanceId === victim.instanceId)!;
  assert.equal(grantedVictim.durableKeywords?.includes("Flying"), true, "durable grant is recorded beneath suppression");
  assert.equal(grantedVictim.keywords.includes("Flying"), false, "suppression remains authoritative while source is alive");

  granted.players.player.permanents[0].health = 0;
  cleanupDead(granted);
  assert.equal(grantedVictim.keywords.includes("Flying"), true, "durable grant becomes effective when suppression ends");
});

// Effective runtime integration: suppressing Hexproof changes authoritative targeting legality.
withRegisteredCardSnapshot([
  enemyAuraCard({ buffPower: 0, buffHealth: 0, affects: "enemies", suppressKeywords: ["Hexproof"] }, "test_hexproof_suppressor"),
  hexproofUnit,
  pingSpell,
], () => {
  const state = createGame("Aura 2.2 Targeting", DECKS[3], DECKS[2], true, 642004);
  state.players.player.bench = [];
  state.players.ai.bench = [];
  state.players.player.permanents = [];
  state.players.ai.permanents = [];
  const victim = makeUnit(state, hexproofUnit.defId, "ai");
  state.players.ai.bench.push(victim);
  state.players.player.hand = [{ instanceId: "aura22_ping_card", defId: pingSpell.defId }];
  state.players.player.mana = 10;
  const baselineHealth = victim.health;

  const blocked = castSpell(state, "player", "aura22_ping_card", victim.instanceId);
  assert.equal(blocked, state, "targeted spell fails closed while printed Hexproof is effective");
  assert.equal(victim.health, baselineHealth);

  state.players.player.permanents.push(makePermanent(state, "test_hexproof_suppressor", "player"));
  recomputeContinuousAuras(state);
  assert.equal(victim.keywords.includes("Hexproof"), false, "Aura suppression removes Hexproof from the effective targeting view");

  const resolved = castSpell(state, "player", "aura22_ping_card", victim.instanceId);
  const hit = resolved.players.ai.bench.find((unit) => unit.instanceId === victim.instanceId)!;
  assert.equal(hit.health, baselineHealth - 1, "same targeted spell resolves once Hexproof is continuously suppressed");
  assert.equal(resolved.players.player.hand.some((card) => card.instanceId === "aura22_ping_card"), false);
});

// Runtime also filters malformed unsafe suppression payloads that somehow bypass authoring.
withRegisteredCardSnapshot([
  enemyAuraCard({
    buffPower: 0,
    buffHealth: 0,
    affects: "enemies",
    suppressKeywords: ["Barrier", "LastBreath", "Flying"],
  }, "test_malformed_suppressor"),
], () => {
  const state = createGame("Aura 2.2 Runtime Guard", DECKS[3], DECKS[2], true, 642005);
  state.players.player.permanents = [makePermanent(state, "test_malformed_suppressor", "player")];
  const victim = makeUnit(state, "convergence_eclipse_herald", "ai");
  assert.deepEqual(
    permanentAuraSuppressedKeywordsForUnit(state, victim),
    ["Flying"],
    "runtime ignores unsafe Barrier/LastBreath suppression even when payload bypasses authoring",
  );
});

const validSuppressionOnly = validateAuthorableCardWithSemanticTypes(enemyAuraCard({
  buffPower: 0,
  buffHealth: 0,
  affects: "enemies",
  suppressKeywords: ["Flying", "Hexproof", "Flying"],
}, "valid_suppression_only"));
assert.equal(validSuppressionOnly.ok, true, "semantic authoring accepts suppression-only hostile Aura");
assert.ok(validSuppressionOnly.ok);
assert.deepEqual(validSuppressionOnly.card.aura, {
  buffPower: 0,
  buffHealth: 0,
  suppressKeywords: ["Flying", "Hexproof"],
  affects: "enemies",
});

const validMixed = validateAuthorableCardWithSemanticTypes(enemyAuraCard({
  buffPower: -2,
  buffHealth: -1,
  affects: "enemies",
  suppressKeywords: ["Tough"],
  races: ["Beast"],
}, "valid_mixed_suppression"));
assert.equal(validMixed.ok, true, "hostile Aura may combine certified stat debuffs and keyword suppression");

for (const [label, aura] of [
  ["Barrier suppression", { buffPower: 0, buffHealth: 0, affects: "enemies", suppressKeywords: ["Barrier"] }],
  ["LastBreath suppression", { buffPower: 0, buffHealth: 0, affects: "enemies", suppressKeywords: ["LastBreath"] }],
  ["unknown suppression", { buffPower: 0, buffHealth: 0, affects: "enemies", suppressKeywords: ["NotAKeyword"] }],
  ["enemy keyword grant", { buffPower: -1, buffHealth: 0, affects: "enemies", keywords: ["Flying"] }],
  ["allied suppression", { buffPower: 1, buffHealth: 0, affects: "allies", suppressKeywords: ["Flying"] }],
  ["empty hostile Aura", { buffPower: 0, buffHealth: 0, affects: "enemies" }],
] as const) {
  const result = validateAuthorableCardWithSemanticTypes(enemyAuraCard(
    aura as unknown as PermanentStatAura,
    `invalid_${label.toLowerCase().replace(/[^a-z]+/g, "_")}`,
  ));
  assert.equal(result.ok, false, `${label} must fail closed`);
}

const grammarCard = enemyAuraCard({
  buffPower: 0,
  buffHealth: 0,
  affects: "enemies",
  suppressKeywords: ["Flying", "Hexproof"],
  classes: ["guardian"],
}, "aura22_grammar_probe");
const blueprint = blueprintFromPermanentStatAura(grammarCard);
assert.ok(blueprint);
assert.equal(blueprint.target, "enemyUnit");
assert.deepEqual(blueprint.features, ["conditional"]);
assert.deepEqual(blueprint.rule, {
  kind: "permanentStatAura",
  aura: {
    buffPower: 0,
    buffHealth: 0,
    affects: "enemies",
    suppressKeywords: ["Flying", "Hexproof"],
    classes: ["guardian"],
  },
});
assert.deepEqual(
  ABILITY_GRAMMAR_CATALOG.permanentKeywordSuppressionAuraContract,
  PERMANENT_KEYWORD_SUPPRESSION_AURA_CONTRACT,
  "Ability Grammar publishes the same suppression contract consumed by runtime and Studio",
);
assert.equal(ABILITY_KIND_SUPPORT.aura, "partial", "generic continuous layers/replacement effects remain outside this certified slice");

console.log("AURA 2.2 KEYWORD SUPPRESSION: PASS — provenance, precedence, targeting, authoring safety and grammar certified");
