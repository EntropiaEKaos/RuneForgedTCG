import assert from "node:assert/strict";
import { createCustomGame } from "../engine";
import type { DeckInput, UnitInstance } from "../types";
import { canonicalizeGuestAction, previewCombat, previewCombatLane } from "./match-model";

const deck: DeckInput = { id: "client", name: "Client Test", cards: Array(20).fill("ember_whelp") };
const unit = (id: string, owner: "player" | "ai", power: number, health: number, keywords: UnitInstance["keywords"] = []): UnitInstance => ({
  instanceId: id, defId: "ember_whelp", owner, power, basePower: power, health, maxHealth: health,
  keywords, barrier: false, frostbitten: false, stunned: false, isAttacking: owner === "ai",
  hasStruck: false, summonedThisTurn: false, isChampion: false, leveled: false, strikes: 0,
  nexusStrikes: 0, equipment: [], races: [], powerBuffs: 0, healthBuffs: 0,
  permanentHealthModifier: 0, poisonCounters: 0, hasAttackedThisTurn: false,
});

const state = createCustomGame("P", deck, deck, { skipMulligan: true, seed: 42 });
state.players.ai.bench = [unit("a1", "ai", 5, 2, ["Overwhelm"]), unit("a2", "ai", 3, 3)];
state.players.player.bench = [unit("b1", "player", 2, 3, ["Tough"])];
state.combat = { attackerId: "ai", blocks: {}, locked: [], sentinelaTargets: {} };
state.phase = "blocking";

assert.deepEqual(previewCombat(state, { a1: "b1" }), { nexusDamage: 4, attackerDeaths: 1, blockerDeaths: 1, unblocked: 1 });
assert.deepEqual(previewCombatLane(state.players.ai.bench[0], state.players.player.bench[0]), {
  attackerDamage: 2, blockerDamage: 4, nexusDamage: 1, attackerFalls: true, blockerFalls: true, outcome: "trade",
});
assert.equal(previewCombatLane(state.players.ai.bench[1]).outcome, "unblocked");
assert.deepEqual(canonicalizeGuestAction({ type: "pass", player: "player" }, true), { type: "pass", player: "ai" });
assert.deepEqual(canonicalizeGuestAction({ type: "block", blocks: {} }, true), { type: "block", blocks: {} });
console.log("MATCH MODEL 2.39: PASS");
