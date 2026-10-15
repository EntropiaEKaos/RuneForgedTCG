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

test("combat lanes honor Barrier, Tough, Deathtouch and independent attacker identities", () => {
  const protectedAttacker = unit("a-barrier", "player", 2, 2);
  protectedAttacker.barrier = true;
  const toughBlocker = unit("b-tough", "ai", 3, 2, ["Tough"]);
  const protectedLane = previewCombatLane(protectedAttacker, toughBlocker);
  assert.equal(protectedLane.attackerDamage, 0);
  assert.equal(protectedLane.blockerDamage, 1);
  assert.equal(protectedLane.attackerFalls, false);
  assert.equal(protectedLane.blockerFalls, false);

  const lethalAttacker = unit("a-deathtouch", "player", 1, 4, ["Deathtouch"]);
  const largeBlocker = unit("b-large", "ai", 3, 8);
  const lethalLane = previewCombatLane(lethalAttacker, largeBlocker);
  assert.equal(lethalLane.blockerDamage, 1);
  assert.equal(lethalLane.blockerFalls, true);
  assert.equal(lethalLane.attackerFalls, false);
  assert.notEqual(protectedAttacker.instanceId, lethalAttacker.instanceId);
});

test("Sentinela-targeted unblocked attackers do not incorrectly damage Nexus", () => {
  const attackers = [
    unit("a-sentinela", "player", 5, 3),
    unit("a-nexus", "player", 2, 3),
    unit("a-blocked", "player", 4, 3),
  ];
  const blockers = [unit("b-blocked", "ai", 1, 5)];
  const blocks = { "a-blocked": "b-blocked" };
  const state = {
    players: { player: { bench: attackers }, ai: { bench: blockers } },
    combat: {
      attackerId: "player", blocks, locked: [],
      sentinelaTargets: { "a-sentinela": "sentinela-target-1" },
    },
  } as unknown as GameState;
  const preview = previewCombat(state, blocks);
  assert.equal(preview.nexusDamage, 2);
  assert.equal(preview.unblocked, 2);
  assert.equal(preview.attackerDeaths, 0);
  assert.equal(preview.blockerDeaths, 0);
});
