import assert from "node:assert/strict";
import { aiChooseAction, applyAiAction } from "./ai";
import { aiChooseAction as aiChooseCoreAction } from "./ai-core";
import { createCustomGame } from "./engine";
import type { DeckInput, GameState, PlayerId } from "./types";

const deck: DeckInput = {
  id: "vanilla-1-3-tactical-test",
  name: "Vanilla 1.3 Tactical Test",
  cards: Array(20).fill("ember_whelp"),
};

function tacticalState(
  spellDefId: string,
  acting: PlayerId = "ai",
  opposingBench: string[] = ["wood_ent"],
  actingBench: string[] = [],
): GameState {
  const state = createCustomGame("Vanilla 1.3", deck, deck, {
    skipMulligan: true,
    playerGoesFirst: acting === "player",
    playerStartingHand: 0,
    aiStartingHand: 0,
    playerStartingMana: 10,
    aiStartingMana: 10,
    playerBench: acting === "ai" ? opposingBench : actingBench,
    aiBench: acting === "player" ? opposingBench : actingBench,
    seed: 913_013,
  });
  state.phase = "main";
  state.activePlayer = acting;
  state.players[acting].mana = 10;
  state.players[acting].maxMana = 10;
  state.players[acting].spellMana = 3;
  state.players[acting].hand = [{ instanceId: `${acting}-tactical-spell`, defId: spellDefId }];
  return state;
}

// The historical core really does decline these cards. Vanilla 1.3 must fill
// the hole in the public facade rather than rewriting the certified priority tree.
const frostbite = tacticalState("van_tide_s05");
assert.equal(aiChooseCoreAction(frostbite, "ai"), null, "historical ai-core should expose the frostbite coverage gap");
const frostbiteTarget = frostbite.players.player.bench[0].instanceId;
const frostbiteAction = aiChooseAction(frostbite, "ai");
assert.deepEqual(frostbiteAction, {
  kind: "spell",
  instanceId: "ai-tactical-spell",
  defId: "van_tide_s05",
  targetInstanceId: frostbiteTarget,
});
const frostbitten = applyAiAction(frostbite, frostbiteAction!, "ai");
const frozenUnit = frostbitten.players.player.bench.find((unit) => unit.instanceId === frostbiteTarget);
assert.equal(frozenUnit?.frostbitten, true, "fallback frostbite must resolve through the authoritative spell lifecycle");
assert.equal(frozenUnit?.power, 0, "frostbite fallback must apply the real engine effect");

const recall = tacticalState("van_tide_s02");
assert.equal(aiChooseCoreAction(recall, "ai"), null, "historical ai-core should expose the recall coverage gap");
const recalledTarget = recall.players.player.bench[0].instanceId;
const recallAction = aiChooseAction(recall, "ai");
assert.equal(recallAction?.defId, "van_tide_s02");
assert.equal(recallAction?.targetInstanceId, recalledTarget);
const recalled = applyAiAction(recall, recallAction!, "ai");
assert.equal(recalled.players.player.bench.some((unit) => unit.instanceId === recalledTarget), false, "recall fallback must remove the target from board");
assert.equal(recalled.players.player.hand.some((card) => card.defId === "wood_ent"), true, "recall fallback must return the real card to hand");

const kill = tacticalState("van_void_s05");
assert.equal(aiChooseCoreAction(kill, "ai"), null, "historical ai-core should expose the killUnit coverage gap");
const killTarget = kill.players.player.bench[0].instanceId;
const killAction = aiChooseAction(kill, "ai");
assert.equal(killAction?.defId, "van_void_s05");
assert.equal(killAction?.targetInstanceId, killTarget);
const killed = applyAiAction(kill, killAction!, "ai");
assert.equal(killed.players.player.bench.some((unit) => unit.instanceId === killTarget), false, "killUnit fallback must execute authoritative cleanup");

// Non-targeted inevitability was another real dead-hand class: nonlethal Nexus
// damage, poison and mill are legal plays even when the old core had no branch.
const burn = tacticalState("van_void_s04", "ai", []);
assert.equal(aiChooseCoreAction(burn, "ai"), null, "nonlethal Nexus damage should reproduce the old null decision");
const burnAction = aiChooseAction(burn, "ai");
assert.equal(burnAction?.defId, "van_void_s04");
assert.equal(burnAction?.targetInstanceId, undefined);
const burned = applyAiAction(burn, burnAction!, "ai");
assert.equal(burned.players.player.nexusHealth, burn.players.player.nexusHealth - 3);

const poison = tacticalState("van_void_s03", "ai", []);
assert.equal(aiChooseCoreAction(poison, "ai"), null, "poison should reproduce the old null decision");
const poisonAction = aiChooseAction(poison, "ai");
assert.equal(poisonAction?.defId, "van_void_s03");
const poisoned = applyAiAction(poison, poisonAction!, "ai");
assert.equal(poisoned.players.player.poisonCounters, poison.players.player.poisonCounters + 1);

const mill = tacticalState("van_void_s02", "ai", []);
assert.equal(aiChooseCoreAction(mill, "ai"), null, "mill should reproduce the old null decision");
assert.equal(aiChooseAction(mill, "ai")?.defId, "van_void_s02");

// Targeting stays fail-closed. A high-value Hexproof target cannot be selected;
// the fallback must pick another legal enemy instead of bypassing isValidTarget.
const hexproof = tacticalState("van_tide_s05", "ai", ["wood_ent", "ember_whelp"]);
const protectedUnit = hexproof.players.player.bench[0];
const legalUnit = hexproof.players.player.bench[1];
protectedUnit.power = 99;
protectedUnit.keywords = [...new Set([...protectedUnit.keywords, "Hexproof"])] as typeof protectedUnit.keywords;
const hexproofAction = aiChooseAction(hexproof, "ai");
assert.equal(hexproofAction?.targetInstanceId, legalUnit.instanceId, "fallback must skip an illegal Hexproof enemy target");

const starved = tacticalState("van_tide_s05", "ai", []);
assert.equal(aiChooseAction(starved, "ai"), null, "target-starved control spell must not emit an invalid action");

// Semantic usefulness is also fail-closed: a technically legal action that
// would do nothing must remain in hand rather than converting the fix into
// indiscriminate mana spending.
const redundantFrostbite = tacticalState("van_tide_s05");
redundantFrostbite.players.player.bench[0].frostbitten = true;
redundantFrostbite.players.player.bench[0].power = 0;
assert.equal(aiChooseAction(redundantFrostbite, "ai"), null, "already-frostbitten zero-power target must not consume another frostbite");

const redundantStun = tacticalState("van_storm_s02");
redundantStun.players.player.bench[0].stunned = true;
assert.equal(aiChooseAction(redundantStun, "ai"), null, "already-stunned target must not consume another stun");

const redundantKeyword = tacticalState("van_storm_s03", "ai", [], ["ember_whelp"]);
redundantKeyword.players.ai.bench[0].keywords = [...new Set([...redundantKeyword.players.ai.bench[0].keywords, "Flying"])] as typeof redundantKeyword.players.ai.bench[0].keywords;
assert.equal(aiChooseAction(redundantKeyword, "ai"), null, "grantKeyword must not be spent on a unit that already has the keyword");

const emptyGlobalBuff = tacticalState("van_forest_s06", "ai", [], []);
assert.equal(aiChooseAction(emptyGlobalBuff, "ai"), null, "buffAllies must not be spent on an empty allied board");

const raceMiss = tacticalState("van_forest_s08", "ai", [], ["ember_whelp"]);
assert.equal(aiChooseAction(raceMiss, "ai"), null, "buffRace must not be spent without a matching allied race");

// The facade is symmetric: Balance Lab and authoritative bot-vs-bot callers can
// ask the same policy to drive either player ID.
const mirrored = tacticalState("van_tide_s02", "player", ["wood_ent"]);
const mirroredTarget = mirrored.players.ai.bench[0].instanceId;
assert.equal(aiChooseAction(mirrored, "player")?.targetInstanceId, mirroredTarget);

// Most important regression boundary: whenever the historical core already has
// a decision, Vanilla 1.3 returns that exact action and never overrides it.
const priority = tacticalState("van_tide_s05");
priority.players.ai.hand.push({ instanceId: "ai-existing-unit", defId: "ember_whelp" });
const historicalPriority = aiChooseCoreAction(priority, "ai");
assert.ok(historicalPriority, "fixture must produce an existing historical core action");
assert.deepEqual(aiChooseAction(priority, "ai"), historicalPriority, "tactical fallback must not reorder certified ai-core priorities");

console.log(
  "VANILLA 1.3 TACTICAL PLAYABILITY: PASS — facade preserves ai-core priorities, closes proven dead-hand gaps and rejects legal-but-redundant fallback actions",
);
