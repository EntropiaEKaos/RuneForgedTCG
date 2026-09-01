import assert from "node:assert/strict";
import "./aura-2-types";
import {
  CONDITIONAL_AURA_CONTRACT,
  auraConditionMatches,
} from "./aura-condition-contract";
import { withRegisteredCardSnapshot } from "./custom-registry";
import { DECKS } from "./decks";
import {
  castSpell,
  createGame,
  endTurn,
  makePermanent,
  makeUnit,
  permanentAuraBonusForUnit,
  playUnit,
  recomputeContinuousAuras,
} from "./engine";
import { validateAuthorableCardWithSemanticTypes } from "./semantic-card-type-authoring";
import type { CardDef, MechanicCondition, PermanentStatAura, Race } from "./types";

const auraCard = (
  aura: PermanentStatAura,
  defId = "test_aura25_source",
): CardDef => ({
  defId,
  name: "Conditional Standard",
  region: "Ironwood",
  type: "Enchantment",
  cost: 2,
  maxHealth: 4,
  aura,
  description: "A continuous Aura controlled by battlefield state.",
  rarity: "Rare",
  emoji: "🜁",
});

const unitCard = (
  defId: string,
  race: Race,
  power = 2,
  health = 4,
  classes?: string[],
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
  ...(classes?.length ? { classes } : {}),
  ...(keywords?.length ? { keywords } : {}),
  description: "Aura 2.5 test unit.",
  rarity: "Common",
  emoji: "🧪",
});

const spellCard = (
  defId: string,
  effect: CardDef["spell"],
): CardDef => ({
  defId,
  name: defId,
  region: "Ironwood",
  type: "Spell",
  cost: 1,
  spell: effect,
  description: "Aura 2.5 state transition spell.",
  rarity: "Common",
  emoji: "✨",
});

assert.deepEqual(CONDITIONAL_AURA_CONTRACT, {
  rule: "conditionalAura",
  conditions: ["always", "allyRace", "allyClass", "enemyRace", "enemyClass", "nexusBelow", "opponentNexusBelow", "manaAtLeast", "and", "or", "not"],
  controllerScoped: true,
  unsupportedConditions: ["selfDamaged"],
  composition: ["and", "or", "not"],
  lifecycle: "recomputeWhenAuthoritativeStateChanges",
  malformedRuntime: "inactiveFailClosed",
  support: "supported",
});

// Pure controller-state evaluator: composition is deterministic and target-independent.
{
  const state = createGame("Aura 2.5 Conditions", DECKS[3], DECKS[2], true, 645001);
  state.players.player.bench = [];
  state.players.player.nexusHealth = 15;
  state.players.player.mana = 2;
  const condition: MechanicCondition = {
    kind: "and",
    children: [
      { kind: "nexusBelow", amount: 15 },
      { kind: "not", child: { kind: "manaAtLeast", amount: 3 } },
    ],
  };
  assert.equal(auraConditionMatches(state, "player", condition), true);
  state.players.player.mana = 3;
  assert.equal(auraConditionMatches(state, "player", condition), false);
  assert.equal(auraConditionMatches(state, "player", { kind: "selfDamaged" }), false, "unsupported source-relative conditions fail closed at runtime");
}

// Board composition toggles a Permanent Aura without changing target filters or provenance.
withRegisteredCardSnapshot([
  auraCard({ buffPower: 2, buffHealth: 0, condition: { kind: "allyRace", race: "Dragon", min: 1 } }),
  unitCard("test_aura25_ally", "Spirit", 3, 4),
  unitCard("test_aura25_dragon", "Dragon", 2, 3),
], () => {
  const state = createGame("Aura 2.5 Board", DECKS[3], DECKS[2], true, 645002);
  state.players.player.bench = [];
  state.players.player.permanents = [makePermanent(state, "test_aura25_source", "player")];
  const ally = makeUnit(state, "test_aura25_ally", "player");
  state.players.player.bench.push(ally);
  recomputeContinuousAuras(state);
  assert.equal(ally.power, 3, "Aura stays inactive before its controller condition is met");
  assert.equal(permanentAuraBonusForUnit(state, ally).sources, 0);

  const dragon = makeUnit(state, "test_aura25_dragon", "player");
  state.players.player.bench.push(dragon);
  recomputeContinuousAuras(state);
  assert.equal(ally.power, 5, "adding the required allied race activates the whole source");
  assert.deepEqual(permanentAuraBonusForUnit(state, ally), { power: 2, health: 0, sources: 1 });

  state.players.player.bench = state.players.player.bench.filter((unit) => unit.instanceId !== dragon.instanceId);
  recomputeContinuousAuras(state);
  assert.equal(ally.power, 3, "removing the qualifying ally deactivates the source cleanly");
});

// Real mana transitions: paying for a card disables the Aura; next round mana refresh enables it again.
withRegisteredCardSnapshot([
  auraCard({ buffPower: 2, buffHealth: 0, condition: { kind: "manaAtLeast", amount: 3 } }, "test_aura25_mana_source"),
  unitCard("test_aura25_mana_ally", "Spirit", 2, 4),
  unitCard("test_aura25_mana_spend", "Beast", 1, 2),
], () => {
  const state = createGame("Aura 2.5 Mana", DECKS[3], DECKS[2], true, 645003);
  state.players.player.bench = [];
  const ally = makeUnit(state, "test_aura25_mana_ally", "player");
  state.players.player.bench.push(ally);
  state.players.player.permanents = [makePermanent(state, "test_aura25_mana_source", "player")];
  state.players.player.hand = [{ instanceId: "aura25_spend", defId: "test_aura25_mana_spend" }];
  state.players.player.maxMana = 3;
  state.players.player.mana = 3;
  state.activePlayer = "player";
  state.attackToken = "player";
  state.phase = "main";
  recomputeContinuousAuras(state);
  assert.equal(ally.power, 4, "mana threshold begins active");

  const spent = playUnit(state, "player", "aura25_spend");
  const spentAlly = spent.players.player.bench.find((unit) => unit.instanceId === ally.instanceId)!;
  assert.equal(spent.players.player.mana, 1);
  assert.equal(spentAlly.power, 2, "semantic play boundary recomputes after mana payment");

  const opponentTurn = endTurn(spent, "player");
  const nextRound = endTurn(opponentTurn, "ai");
  const refreshedAlly = nextRound.players.player.bench.find((unit) => unit.instanceId === ally.instanceId)!;
  assert.equal(nextRound.players.player.mana, 4, "normal round mana refresh occurred");
  assert.equal(refreshedAlly.power, 4, "end-turn boundary recomputes and re-enables the threshold Aura");
});

// Nexus damage/heal toggles a conditional keyword Aura through real spell resolution.
withRegisteredCardSnapshot([
  auraCard({ buffPower: 0, buffHealth: 0, keywords: ["Flying"], condition: { kind: "nexusBelow", amount: 17 } }, "test_aura25_nexus_source"),
  unitCard("test_aura25_nexus_ally", "Spirit", 2, 4),
  spellCard("test_aura25_damage_spell", { kind: "damageNexus", amount: 3, target: "none" }),
  spellCard("test_aura25_heal_spell", { kind: "healNexus", amount: 2, target: "none" }),
], () => {
  const state = createGame("Aura 2.5 Nexus", DECKS[3], DECKS[2], true, 645004);
  state.players.player.bench = [];
  const ally = makeUnit(state, "test_aura25_nexus_ally", "player");
  state.players.player.bench.push(ally);
  state.players.player.permanents = [makePermanent(state, "test_aura25_nexus_source", "player")];
  state.players.player.nexusHealth = 20;
  state.players.player.mana = 10;
  state.players.ai.mana = 10;
  state.players.ai.hand = [{ instanceId: "aura25_damage", defId: "test_aura25_damage_spell" }];
  recomputeContinuousAuras(state);
  assert.equal(ally.keywords.includes("Flying"), false);

  const damaged = castSpell(state, "ai", "aura25_damage");
  const damagedAlly = damaged.players.player.bench.find((unit) => unit.instanceId === ally.instanceId)!;
  assert.equal(damaged.players.player.nexusHealth, 17);
  assert.equal(damagedAlly.keywords.includes("Flying"), true, "nexusBelow activates after authoritative damage");

  damaged.players.player.hand = [{ instanceId: "aura25_heal", defId: "test_aura25_heal_spell" }];
  damaged.players.player.mana = 10;
  const healed = castSpell(damaged, "player", "aura25_heal");
  const healedAlly = healed.players.player.bench.find((unit) => unit.instanceId === ally.instanceId)!;
  assert.equal(healed.players.player.nexusHealth, 19);
  assert.equal(healedAlly.keywords.includes("Flying"), false, "healing above the threshold removes only the source-bound keyword layer");
});

// Class conditions and nested boolean composition share the same controller scope.
withRegisteredCardSnapshot([
  auraCard({
    buffPower: 1,
    buffHealth: 1,
    condition: {
      kind: "and",
      children: [
        { kind: "allyClass", classKey: "guardian", min: 1 },
        { kind: "or", children: [{ kind: "manaAtLeast", amount: 2 }, { kind: "nexusBelow", amount: 10 }] },
      ],
    },
  }, "test_aura25_composite_source"),
  unitCard("test_aura25_guardian", "Beast", 2, 3, ["guardian"]),
  unitCard("test_aura25_composite_ally", "Spirit", 3, 4),
], () => {
  const state = createGame("Aura 2.5 Composite", DECKS[3], DECKS[2], true, 645005);
  state.players.player.bench = [];
  const guardian = makeUnit(state, "test_aura25_guardian", "player");
  const ally = makeUnit(state, "test_aura25_composite_ally", "player");
  state.players.player.bench.push(guardian, ally);
  state.players.player.permanents = [makePermanent(state, "test_aura25_composite_source", "player")];
  state.players.player.mana = 2;
  recomputeContinuousAuras(state);
  assert.equal(ally.power, 4);
  assert.equal(ally.maxHealth, 5);

  state.players.player.mana = 0;
  state.players.player.nexusHealth = 20;
  recomputeContinuousAuras(state);
  assert.equal(ally.power, 3, "AND source disables when its nested OR group becomes false");
  assert.equal(ally.maxHealth, 4);
});

// Malformed/unsupported runtime payloads never partially contribute.
withRegisteredCardSnapshot([
  auraCard({ buffPower: 9, buffHealth: 9, condition: { kind: "selfDamaged" } }, "test_aura25_unsafe_runtime"),
  unitCard("test_aura25_unsafe_ally", "Spirit", 2, 4),
], () => {
  const state = createGame("Aura 2.5 Fail Closed", DECKS[3], DECKS[2], true, 645006);
  state.players.player.bench = [makeUnit(state, "test_aura25_unsafe_ally", "player")];
  state.players.player.permanents = [makePermanent(state, "test_aura25_unsafe_runtime", "player")];
  recomputeContinuousAuras(state);
  assert.equal(state.players.player.bench[0].power, 2);
  assert.equal(state.players.player.bench[0].maxHealth, 4);
  assert.equal(permanentAuraBonusForUnit(state, state.players.player.bench[0]).sources, 0);
});

// Canonical authoring preserves supported conditions and rejects unsupported trees.
const validConditional = validateAuthorableCardWithSemanticTypes(auraCard({
  buffPower: 1,
  buffHealth: 0,
  condition: {
    kind: "and",
    children: [
      { kind: "allyRace", race: "Beast", min: 2 },
      { kind: "not", child: { kind: "manaAtLeast", amount: 8 } },
    ],
  },
}, "valid_aura25_conditional"));
assert.equal(validConditional.ok, true);
assert.ok(validConditional.ok);
assert.deepEqual(validConditional.card.aura?.condition, {
  kind: "and",
  children: [
    { kind: "allyRace", race: "Beast", min: 2 },
    { kind: "not", child: { kind: "manaAtLeast", amount: 8 } },
  ],
});

const invalidSelfDamaged = validateAuthorableCardWithSemanticTypes(auraCard({
  buffPower: 1,
  buffHealth: 0,
  condition: { kind: "selfDamaged" },
}, "invalid_aura25_self_damaged"));
assert.equal(invalidSelfDamaged.ok, false, "source-relative selfDamaged is rejected across every Aura source family");

const invalidNestedSelfDamaged = validateAuthorableCardWithSemanticTypes(auraCard({
  buffPower: 1,
  buffHealth: 0,
  condition: { kind: "not", child: { kind: "selfDamaged" } },
}, "invalid_aura25_nested_self_damaged"));
assert.equal(invalidNestedSelfDamaged.ok, false, "unsupported conditions cannot be hidden inside boolean composition");

const invalidNullCondition = validateAuthorableCardWithSemanticTypes({
  ...auraCard({ buffPower: 1, buffHealth: 0 }, "invalid_aura25_null_condition"),
  aura: { buffPower: 1, buffHealth: 0, condition: null as never },
});
assert.equal(invalidNullCondition.ok, false, "explicit malformed condition fails closed instead of silently becoming always");

const conditionOnlyNoEffect = validateAuthorableCardWithSemanticTypes(auraCard({
  buffPower: 0,
  buffHealth: 0,
  condition: { kind: "manaAtLeast", amount: 1 },
}, "invalid_aura25_condition_only"));
assert.equal(conditionOnlyNoEffect.ok, false, "a condition does not count as an Aura effect by itself");

console.log("AURA 2.5 CONDITIONAL AURAS: PASS — controller conditions, composition, mana/Nexus reactivity, authoring and fail-closed runtime certified");
