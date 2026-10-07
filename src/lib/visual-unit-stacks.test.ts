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
