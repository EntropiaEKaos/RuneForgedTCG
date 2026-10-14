import assert from "node:assert/strict";
import test from "node:test";
import { groupVisualUnits } from "./visual-unit-stacks";

test("groups identical definitions while preserving distinct instances and modifiers", () => {
  const units = [
    { instanceId: "a", defId: "goblin", attack: 1, buffs: [] },
    { instanceId: "b", defId: "goblin", attack: 3, buffs: ["rage"] },
    { instanceId: "c", defId: "goblin", attack: 0, debuffs: ["weak"] },
    { instanceId: "d", defId: "elf", attack: 2 },
  ];
  const groups = groupVisualUnits(units);
  assert.deepEqual(groups.map(group => group.members.length), [3, 1]);
  assert.equal(groups[0].members[1], units[1]);
  assert.equal(groups[0].members[2], units[2]);
  assert.equal(groups[0].members[1].attack, 3);
  assert.deepEqual(groups[0].members[2].debuffs, ["weak"]);
});

test("manual separation and expansion never mutate game units", () => {
  const units = Array.from({ length: 8 }, (_, i) => ({ instanceId: String(i), defId: "token", damage: i }));
  const groups = groupVisualUnits(units, {
    separatedIds: new Set(["3"]),
    expandedIds: new Set(["def:token"]),
  });
  assert.equal(groups.length, 2);
  assert.equal(groups[0].members.length, 7);
  assert.equal(groups[0].expanded, true);
  assert.equal(groups[1].members[0], units[3]);
  assert.equal(groups[1].expanded, true);
  assert.deepEqual(units.map(unit => unit.damage), [0,1,2,3,4,5,6,7]);
});

test("rejects duplicate authoritative instance identifiers", () => {
  assert.throws(() => groupVisualUnits([
    { instanceId: "same", defId: "token" },
    { instanceId: "same", defId: "token" },
  ]), /Duplicate unit instanceId/);
});


test("new copies automatically join the matching visual stack", () => {
  const firstBoard = [
    { instanceId: "a", defId: "relic" },
    { instanceId: "b", defId: "relic" },
  ];
  assert.equal(groupVisualUnits(firstBoard)[0].members.length, 2);
  const afterCast = [...firstBoard, { instanceId: "c", defId: "relic" }];
  const groups = groupVisualUnits(afterCast);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].members.map(unit => unit.instanceId), ["a", "b", "c"]);
});

test("creatures and compatible permanents use the same grouping contract without merging instances", () => {
  const artifacts = [
    { instanceId: "artifact-a", defId: "iron-relic", charges: 1 },
    { instanceId: "artifact-b", defId: "iron-relic", charges: 3 },
  ];
  const [stack] = groupVisualUnits(artifacts);
  assert.equal(stack.members.length, 2);
  assert.equal(stack.members[0].charges, 1);
  assert.equal(stack.members[1].charges, 3);
  assert.notEqual(stack.members[0].instanceId, stack.members[1].instanceId);
});

test("Swarm combat preserves every attacker, blocker and independent damage value", () => {
  const units = Array.from({ length: 24 }, (_, index) => ({
    instanceId: `swarm-${index}`,
    defId: "swarm-token",
    isAttacking: index % 3 === 0,
    isBlocking: index % 3 === 1,
    damage: index % 4,
    attack: 1 + (index % 2),
    buffs: index % 2 ? ["fury"] : [],
  }));
  const [stack] = groupVisualUnits(units);
  assert.equal(stack.members.length, 24);
  assert.equal(new Set(stack.members.map(unit => unit.instanceId)).size, 24);
  assert.deepEqual(stack.members.filter(unit => unit.isAttacking).map(unit => unit.instanceId),
    units.filter(unit => unit.isAttacking).map(unit => unit.instanceId));
  assert.deepEqual(stack.members.filter(unit => unit.isBlocking).map(unit => unit.instanceId),
    units.filter(unit => unit.isBlocking).map(unit => unit.instanceId));
  for (let index = 0; index < units.length; index++) {
    assert.equal(stack.members[index], units[index]);
    assert.equal(stack.members[index].damage, index % 4);
  }
});

test("separating a combat target and regrouping restores the same authoritative instances", () => {
  const units = [
    { instanceId: "attacker", defId: "wolf", isAttacking: true, damage: 2 },
    { instanceId: "blocker", defId: "wolf", isAttacking: false, damage: 1 },
    { instanceId: "reserve", defId: "wolf", isAttacking: false, damage: 0 },
  ];
  const separated = groupVisualUnits(units, { separatedIds: new Set(["blocker"]) });
  assert.deepEqual(separated.flatMap(group => group.members.map(unit => unit.instanceId)),
    ["attacker", "reserve", "blocker"]);
  assert.equal(separated.find(group => group.id === "unit:blocker")?.members[0], units[1]);
  const regrouped = groupVisualUnits(units);
  assert.deepEqual(regrouped[0].members, units);
  assert.equal(regrouped[0].members[0].isAttacking, true);
  assert.equal(regrouped[0].members[1].damage, 1);
});


test("combat selection resolves each identical unit by instance ID even when its stack is expanded", () => {
  const units = [
    { instanceId: "wolf-a", defId: "wolf", isAttacking: true, exhausted: true, damage: 1, buffs: ["fury"] },
    { instanceId: "wolf-b", defId: "wolf", isAttacking: false, exhausted: false, damage: 2, buffs: [] },
    { instanceId: "wolf-c", defId: "wolf", isAttacking: false, exhausted: false, damage: 0, buffs: ["shield"] },
  ];
  const compact = groupVisualUnits(units);
  assert.equal(compact.length, 1);
  assert.equal(compact[0].members.length, 3);
  const expanded = groupVisualUnits(units, { expandedIds: new Set(["def:wolf"]) });
  assert.equal(expanded[0].expanded, true);
  const selectedAttacker = expanded[0].members.find(unit => unit.instanceId === "wolf-a");
  const selectedBlocker = expanded[0].members.find(unit => unit.instanceId === "wolf-b");
  assert.equal(selectedAttacker, units[0]);
  assert.equal(selectedBlocker, units[1]);
  assert.equal(selectedAttacker?.isAttacking, true);
  assert.equal(selectedBlocker?.isAttacking, false);
  assert.deepEqual(units.map(unit => unit.damage), [1, 2, 0]);
  assert.deepEqual(units.map(unit => unit.buffs), [["fury"], [], ["shield"]]);
  assert.deepEqual(groupVisualUnits(units)[0].members, units);
});

test("swarm casualties do not leave phantom cards in the visual stack", () => {
  const units = Array.from({ length: 24 }, (_, index) => ({
    instanceId: `token-${index}`, defId: "swarm-token", damage: index % 3,
  }));
  const survivors = units.filter(unit => !["token-0", "token-7", "token-23"].includes(unit.instanceId));
  const [stack] = groupVisualUnits(survivors);
  assert.equal(stack.members.length, 21);
  assert.deepEqual(stack.members, survivors);
  assert.equal(new Set(stack.members.map(unit => unit.instanceId)).size, 21);
  assert.equal(groupVisualUnits([]).length, 0);
});


test("large mixed Swarm retains unique targeting identities and modifiers across expand/separate/regroup", () => {
  const units = Array.from({ length: 36 }, (_, index) => ({
    instanceId: `unit-${index}`,
    defId: index % 3 === 0 ? "wolf" : "swarm-token",
    attack: 1 + index % 4,
    damage: index % 5,
    buffs: index % 7 === 0 ? ["fury"] : [],
    debuffs: index % 11 === 0 ? ["slow"] : [],
    isAttacking: index % 4 === 0,
    isBlocking: index % 4 === 1,
  }));
  const original = units.map(unit => ({ ...unit, buffs: [...unit.buffs], debuffs: [...unit.debuffs] }));
  const expanded = groupVisualUnits(units, {
    expandedIds: new Set(["def:wolf", "def:swarm-token"]),
    separatedIds: new Set(["unit-1", "unit-12", "unit-35"]),
  });
  assert.equal(expanded.flatMap(group => group.members).length, 36);
  assert.equal(new Set(expanded.flatMap(group => group.members.map(unit => unit.instanceId))).size, 36);
  assert.equal(expanded.find(group => group.id === "unit:unit-12")?.members[0], units[12]);
  assert.equal(expanded.find(group => group.id === "unit:unit-35")?.members[0], units[35]);
  const regrouped = groupVisualUnits(units);
  assert.equal(regrouped.length, 2);
  for (const unit of units) {
    assert.equal(regrouped.flatMap(group => group.members).find(member => member.instanceId === unit.instanceId), unit);
  }
  assert.deepEqual(units, original);
});

test("Swarm visual projection handles removal, reinforcement and zero survivors", () => {
  const initial = Array.from({ length: 40 }, (_, index) => ({ instanceId: `token-${index}`, defId: "token", damage: index % 2 }));
  const survivors = initial.filter((_, index) => index % 4 !== 0);
  const reinforced = [...survivors, { instanceId: "token-40", defId: "token", damage: 0 }];
  assert.equal(groupVisualUnits(initial)[0].members.length, 40);
  assert.equal(groupVisualUnits(survivors)[0].members.length, 30);
  assert.equal(groupVisualUnits(reinforced)[0].members.length, 31);
  assert.equal(groupVisualUnits([]).length, 0);
  assert.deepEqual(groupVisualUnits(reinforced)[0].members, reinforced);
});


test("multiple combat lanes retain distinct attacker/blocker assignments across identical cards", () => {
  const attackers = Array.from({ length: 12 }, (_, index) => ({
    instanceId: `attacker-${index}`, defId: "wolf", isAttacking: true, damage: index % 3,
  }));
  const blockers = Array.from({ length: 12 }, (_, index) => ({
    instanceId: `blocker-${index}`, defId: "wolf", isBlocking: true, damage: index % 2,
  }));
  const assignments = new Map(attackers.map((attacker, index) => [attacker.instanceId, blockers[11 - index].instanceId]));
  const attackerStack = groupVisualUnits(attackers, { expandedIds: new Set(["def:wolf"]) });
  const blockerStack = groupVisualUnits(blockers, { expandedIds: new Set(["def:wolf"]) });
  const attackerById = new Map(attackerStack.flatMap(group => group.members).map(unit => [unit.instanceId, unit]));
  const blockerById = new Map(blockerStack.flatMap(group => group.members).map(unit => [unit.instanceId, unit]));
  assert.equal(attackerById.size, 12);
  assert.equal(blockerById.size, 12);
  for (const [attackerId, blockerId] of assignments) {
    assert.equal(attackerById.get(attackerId), attackers[Number(attackerId.split("-")[1])]);
    assert.equal(blockerById.get(blockerId), blockers[Number(blockerId.split("-")[1])]);
  }
  assert.equal(new Set(assignments.values()).size, 12);
  assert.deepEqual(attackers.map(unit => unit.damage), Array.from({ length: 12 }, (_, i) => i % 3));
  assert.deepEqual(blockers.map(unit => unit.damage), Array.from({ length: 12 }, (_, i) => i % 2));
});
