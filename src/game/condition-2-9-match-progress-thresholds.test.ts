import assert from "node:assert/strict";
import "./aura-2-types";
import { ABILITY_GRAMMAR_CATALOG, blueprintFromPermanentStatAura } from "./ability-system";
import { auraConditionMatches } from "./aura-condition-contract";
import { MECHANIC_CONDITION_KINDS, sanitizeMechanicCondition, validateAuthorableCard } from "./card-authoring";
import { CONDITION_RUNTIME_SUPPORT, conditionKindsAtDepth } from "./condition-contract";
import { withRegisteredCardSnapshot } from "./custom-registry";
import { DECKS } from "./decks";
import {
  castSpell,
  createGame,
  declareAttack,
  makePermanent,
  makeUnit,
  mechanicConditionMatches,
  playUnit,
  recomputeContinuousAuras,
  resolveCombat,
} from "./engine";
import { applyStackedAction } from "./engine/reactions";
import { validateAuthorableCardWithSemanticTypes } from "./semantic-card-type-authoring";
import type { CardDef, PermanentStatAura } from "./types";

const unitCard = (defId: string, extra: Partial<CardDef> = {}): CardDef => ({
  defId,
  name: defId,
  region: "Ironwood",
  type: "Unit",
  cost: 1,
  power: 2,
  health: 4,
  race: "Spirit",
  description: "Condition 2.9 match-progress test unit.",
  rarity: "Common",
  emoji: "📈",
  ...extra,
});

const auraCard = (defId: string, condition: PermanentStatAura["condition"]): CardDef => ({
  defId,
  name: defId,
  region: "Ironwood",
  type: "Enchantment",
  cost: 1,
  maxHealth: 4,
  aura: { buffPower: 2, buffHealth: 0, condition },
  description: "Condition 2.9 progress Aura.",
  rarity: "Rare",
  emoji: "📊",
});

const spellCard = (defId: string, effect: CardDef["spell"], speed?: "Fast" | "Burst"): CardDef => ({
  defId,
  name: defId,
  region: "Tidecall",
  type: "Spell",
  cost: 1,
  spell: effect,
  ...(speed ? { speed } : {}),
  description: "Condition 2.9 test spell.",
  rarity: "Common",
  emoji: "✨",
});

const progressKinds = [
  "spellsCastAtLeast",
  "opponentSpellsCastAtLeast",
  "alliesSummonedAtLeast",
  "opponentAlliesSummonedAtLeast",
  "nexusDamageDealtAtLeast",
  "opponentNexusDamageDealtAtLeast",
] as const;

for (const kind of progressKinds) {
  assert.equal(MECHANIC_CONDITION_KINDS.includes(kind), true);
  assert.equal(CONDITION_RUNTIME_SUPPORT[kind], "supported");
  assert.equal(conditionKindsAtDepth(0).includes(kind), true);
  assert.equal(ABILITY_GRAMMAR_CATALOG.conditions.includes(kind), true);
  assert.equal(ABILITY_GRAMMAR_CATALOG.conditionContracts[kind], "supported");
}

assert.deepEqual(sanitizeMechanicCondition({ kind: "spellsCastAtLeast", amount: -5 }), { kind: "spellsCastAtLeast", amount: 1 });
assert.deepEqual(sanitizeMechanicCondition({ kind: "opponentAlliesSummonedAtLeast", amount: 99999 }), { kind: "opponentAlliesSummonedAtLeast", amount: 2000 });
assert.deepEqual(sanitizeMechanicCondition({ kind: "nexusDamageDealtAtLeast", amount: 7.9 }), { kind: "nexusDamageDealtAtLeast", amount: 7 });

withRegisteredCardSnapshot([unitCard("test_condition29_source")], () => {
  const state = createGame("Condition 2.9 Orientation", DECKS[3], DECKS[2], true, 629001);
  const playerSource = makeUnit(state, "test_condition29_source", "player");
  const aiSource = makeUnit(state, "test_condition29_source", "ai");
  state.players.player.bench = [playerSource];
  state.players.ai.bench = [aiSource];
  state.players.player.stats = { spellsCast: 3, alliesSummoned: 5, nexusDamageDealt: 8 };
  state.players.ai.stats = { spellsCast: 2, alliesSummoned: 4, nexusDamageDealt: 6 };

  assert.equal(mechanicConditionMatches(state, playerSource, { kind: "spellsCastAtLeast", amount: 3 }), true);
  assert.equal(mechanicConditionMatches(state, playerSource, { kind: "opponentSpellsCastAtLeast", amount: 3 }), false);
  assert.equal(mechanicConditionMatches(state, aiSource, { kind: "opponentSpellsCastAtLeast", amount: 3 }), true, "AI reads player progress symmetrically");
  assert.equal(mechanicConditionMatches(state, playerSource, { kind: "alliesSummonedAtLeast", amount: 5 }), true);
  assert.equal(mechanicConditionMatches(state, playerSource, { kind: "opponentAlliesSummonedAtLeast", amount: 5 }), false);
  assert.equal(mechanicConditionMatches(state, playerSource, { kind: "nexusDamageDealtAtLeast", amount: 8 }), true);
  assert.equal(mechanicConditionMatches(state, playerSource, { kind: "opponentNexusDamageDealtAtLeast", amount: 7 }), false);
  assert.equal(mechanicConditionMatches(state, playerSource, {
    kind: "and",
    children: [
      { kind: "spellsCastAtLeast", amount: 3 },
      { kind: "not", child: { kind: "opponentNexusDamageDealtAtLeast", amount: 7 } },
    ],
  }), true);

  assert.equal(auraConditionMatches(state, "player", { kind: "spellsCastAtLeast", amount: 3 }), true);
  assert.equal(auraConditionMatches(state, "player", { kind: "opponentAlliesSummonedAtLeast", amount: 5 }), false);
  assert.equal(auraConditionMatches(state, "ai", { kind: "opponentNexusDamageDealtAtLeast", amount: 8 }), true);
});

// Real spell cast crosses a controller progress threshold in the returned state.
withRegisteredCardSnapshot([
  auraCard("test_condition29_spell_aura", { kind: "spellsCastAtLeast", amount: 1 }),
  unitCard("test_condition29_spell_ally"),
  spellCard("test_condition29_progress_spell", { kind: "draw", amount: 1, target: "none" }),
], () => {
  const state = createGame("Condition 2.9 Spell Lifecycle", DECKS[3], DECKS[2], true, 629002);
  const ally = makeUnit(state, "test_condition29_spell_ally", "player");
  state.players.player.bench = [ally];
  state.players.player.permanents = [makePermanent(state, "test_condition29_spell_aura", "player")];
  state.players.player.hand = [{ instanceId: "condition29_spell", defId: "test_condition29_progress_spell" }];
  state.players.player.mana = 10;
  state.players.player.maxMana = 10;
  state.activePlayer = "player";
  state.phase = "main";
  recomputeContinuousAuras(state);
  assert.equal(ally.power, 2);

  const next = castSpell(state, "player", "condition29_spell");
  assert.equal(next.players.player.stats.spellsCast, 1);
  assert.equal(next.players.player.bench[0].power, 4, "spell-cast progress activates Aura immediately");
});

// Real Unit play crosses alliesSummoned in the returned state.
withRegisteredCardSnapshot([
  auraCard("test_condition29_summon_aura", { kind: "alliesSummonedAtLeast", amount: 1 }),
  unitCard("test_condition29_summon_ally"),
  unitCard("test_condition29_entering_unit"),
], () => {
  const state = createGame("Condition 2.9 Summon Lifecycle", DECKS[3], DECKS[2], true, 629003);
  const ally = makeUnit(state, "test_condition29_summon_ally", "player");
  state.players.player.bench = [ally];
  state.players.player.permanents = [makePermanent(state, "test_condition29_summon_aura", "player")];
  state.players.player.hand = [{ instanceId: "condition29_unit", defId: "test_condition29_entering_unit" }];
  state.players.player.mana = 10;
  state.players.player.maxMana = 10;
  state.activePlayer = "player";
  state.phase = "main";
  recomputeContinuousAuras(state);
  assert.equal(ally.power, 2);

  const next = playUnit(state, "player", "condition29_unit");
  assert.equal(next.players.player.stats.alliesSummoned, 1);
  const existing = next.players.player.bench.find((candidate) => candidate.instanceId === ally.instanceId)!;
  assert.equal(existing.power, 4, "summon progress activates Aura immediately");
});

// Real combat crosses nexusDamageDealt and cleanup/recompute observes it.
withRegisteredCardSnapshot([
  auraCard("test_condition29_damage_aura", { kind: "nexusDamageDealtAtLeast", amount: 2 }),
  unitCard("test_condition29_damage_ally"),
  unitCard("test_condition29_attacker", { power: 2, health: 4 }),
], () => {
  const state = createGame("Condition 2.9 Damage Lifecycle", DECKS[3], DECKS[2], true, 629004);
  const ally = makeUnit(state, "test_condition29_damage_ally", "player");
  const attacker = makeUnit(state, "test_condition29_attacker", "player");
  attacker.summonedThisTurn = false;
  state.players.player.bench = [ally, attacker];
  state.players.ai.bench = [];
  state.players.player.permanents = [makePermanent(state, "test_condition29_damage_aura", "player")];
  state.activePlayer = "player";
  state.attackToken = "player";
  state.phase = "main";
  state.hasAttackedThisTurn = false;
  recomputeContinuousAuras(state);
  assert.equal(ally.power, 2);

  const declared = declareAttack(state, "player", [attacker.instanceId]);
  const next = resolveCombat(declared, {});
  assert.equal(next.players.player.stats.nexusDamageDealt, 2);
  const existing = next.players.player.bench.find((candidate) => candidate.instanceId === ally.instanceId)!;
  assert.equal(existing.power, 4, "combat Nexus damage activates Aura in authoritative combat resolution");
});

// A negated Spell is still a cast: stack consumption must advance level-up and Auras now.
withRegisteredCardSnapshot([
  auraCard("test_condition29_negated_aura", { kind: "spellsCastAtLeast", amount: 1 }),
  unitCard("test_condition29_negated_ally"),
  unitCard("test_condition29_champion_1", {
    isChampion: true,
    levelUp: { type: "spellsCast", amount: 1, toDefId: "test_condition29_champion_2", hint: "Cast one spell" },
  }),
  unitCard("test_condition29_champion_2", { isChampion: true, power: 5, health: 5 }),
  spellCard("test_condition29_pending_spell", { kind: "draw", amount: 1, target: "none" }, "Fast"),
  spellCard("test_condition29_counter", { kind: "negateSpell", amount: 0, target: "spellOnStack" }, "Burst"),
], () => {
  const state = createGame("Condition 2.9 Negated Cast", DECKS[3], DECKS[2], true, 629005);
  const ally = makeUnit(state, "test_condition29_negated_ally", "player");
  const champion = makeUnit(state, "test_condition29_champion_1", "player");
  champion.summonedThisTurn = false;
  state.players.player.bench = [ally, champion];
  state.players.player.permanents = [makePermanent(state, "test_condition29_negated_aura", "player")];
  state.players.player.hand = [{ instanceId: "condition29_pending", defId: "test_condition29_pending_spell" }];
  state.players.ai.hand = [{ instanceId: "condition29_counter", defId: "test_condition29_counter" }];
  state.players.player.mana = 10;
  state.players.player.maxMana = 10;
  state.players.ai.mana = 10;
  state.players.ai.maxMana = 10;
  state.activePlayer = "player";
  state.phase = "main";
  recomputeContinuousAuras(state);
  assert.equal(ally.power, 2);

  const result = applyStackedAction(
    state,
    { kind: "spell", player: "player", instanceId: "condition29_pending", defId: "test_condition29_pending_spell" },
    {
      human: "skip",
      playerCounter: { kind: "spell", player: "ai", instanceId: "condition29_counter", defId: "test_condition29_counter" },
    },
  ).next;
  assert.equal(result.players.player.hand.some((card) => card.instanceId === "condition29_pending"), false);
  assert.equal(result.players.player.stats.spellsCast, 1, "negated pending Spell still counts as cast");
  assert.equal(result.players.player.bench.find((candidate) => candidate.instanceId === ally.instanceId)!.power, 4, "negated cast recomputes conditional Aura");
  assert.equal(result.players.player.bench.find((candidate) => candidate.instanceId === champion.instanceId)!.defId, "test_condition29_champion_2", "negated cast advances Champion level-up immediately");
});

const mechanicAuthored = validateAuthorableCard(unitCard("valid_condition29_mechanic", {
  mechanics: [{
    key: "battle_memory",
    name: "Battle Memory",
    trigger: "onRoundStart",
    condition: { kind: "opponentNexusDamageDealtAtLeast", amount: 5 },
    effect: { kind: "draw", amount: 1, target: "none" },
  }],
}));
assert.equal(mechanicAuthored.ok, true);
assert.ok(mechanicAuthored.ok);
assert.deepEqual(mechanicAuthored.card.mechanics?.[0].condition, { kind: "opponentNexusDamageDealtAtLeast", amount: 5 });

const auraAuthored = validateAuthorableCardWithSemanticTypes(auraCard("valid_condition29_aura", {
  kind: "and",
  children: [
    { kind: "spellsCastAtLeast", amount: 2 },
    { kind: "not", child: { kind: "opponentAlliesSummonedAtLeast", amount: 4 } },
  ],
}));
assert.equal(auraAuthored.ok, true);
assert.ok(auraAuthored.ok);
const blueprint = blueprintFromPermanentStatAura(auraAuthored.card);
assert.ok(blueprint);
assert.deepEqual(blueprint.condition, auraAuthored.card.aura?.condition);
assert.equal(blueprint.features.includes("conditional"), true);

console.log("CONDITION SYSTEM 2.9: PASS — symmetric match-progress thresholds, real cast/summon/Nexus-damage lifecycle, negated-cast convergence, authoring and Ability Grammar certified");
