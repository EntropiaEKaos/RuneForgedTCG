import assert from "node:assert/strict";
import test from "node:test";
import { previewCombat, previewCombatLane } from "../game/client/match-model";
import type { GameState, UnitInstance } from "../game/types";

function unit(id: string, owner: "player" | "ai", power: number, health: number, keywords: string[] = []): UnitInstance {
  return {
    instanceId: id, defId: "identical-wolf", owner, power, health,
    keywords, barrier: false, isAttacking: owner === "player",
  } as UnitInstance;
}

test("twelve identical attackers keep their individual blocker assignments and combat outcomes", () => {
  const attackers = Array.from({ length: 12 }, (_, i) => unit(`a-${i}`, "player", i === 0 ? 5 : 2, 2));
  const blockers = Array.from({ length: 12 }, (_, i) => unit(`b-${i}`, "ai", 2, i === 0 ? 3 : 2));
  const blocks = Object.fromEntries(attackers.map((a, i) => [a.instanceId, blockers[11 - i].instanceId]));
  const state = {
    players: { player: { bench: attackers }, ai: { bench: blockers } },
    combat: { attackerId: "player", blocks, locked: [], sentinelaTargets: {} },
  } as unknown as GameState;

  const summary = previewCombat(state, blocks);
  const lanes = attackers.map((a) => previewCombatLane(a, blockers.find((b) => b.instanceId === blocks[a.instanceId])));
  assert.equal(new Set(Object.values(blocks)).size, 12);
  assert.equal(summary.unblocked, 0);
  assert.equal(summary.nexusDamage, 0);
  assert.equal(summary.attackerDeaths, lanes.filter((lane) => lane.attackerFalls).length);
  assert.equal(summary.blockerDeaths, lanes.filter((lane) => lane.blockerFalls).length);
  assert.equal(lanes[0].blockerFalls, true);
  assert.equal(lanes[0].attackerFalls, true);
});

test("unblocked and Overwhelm lanes contribute nexus damage without losing individual identities", () => {
  const attackers = [unit("a-0", "player", 5, 4, ["Overwhelm"]), unit("a-1", "player", 3, 2), unit("a-2", "player", 2, 2)];
  const blockers = [unit("b-0", "ai", 1, 2), unit("b-1", "ai", 1, 2)];
  const blocks = { "a-0": "b-0", "a-2": "b-1" };
  const state = {
    players: { player: { bench: attackers }, ai: { bench: blockers } },
    combat: { attackerId: "player", blocks, locked: [], sentinelaTargets: {} },
  } as unknown as GameState;
  assert.deepEqual(previewCombat(state, blocks), {
    nexusDamage: 6, attackerDeaths: 0, blockerDeaths: 2, unblocked: 1,
  });
  assert.equal(previewCombatLane(attackers[0], blockers[0]).nexusDamage, 3);
  assert.equal(previewCombatLane(attackers[1]).nexusDamage, 3);
});
