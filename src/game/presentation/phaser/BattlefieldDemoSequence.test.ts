import assert from "node:assert/strict";
import { buildBattlefieldLabScenario } from "../battlefield-lab-scenario";
import { buildDeterministicBattlefieldDemoSequence, getBattlefieldDemoBeatAt } from "./BattlefieldDemoSequence";

const scenario = buildBattlefieldLabScenario("commander-4p", 48);
const sequence = buildDeterministicBattlefieldDemoSequence(scenario, "high");

assert.equal(sequence.beats.length, 4);
assert.deepEqual(sequence.beats.map((beat) => beat.id), ["fireball", "damage", "death", "priority"]);
assert.deepEqual(sequence.beats.map((beat) => beat.durationMs), [620, 520, 620, 840]);
assert.deepEqual(sequence.beats.map((beat) => beat.startMs), [0, 620, 1140, 1760]);
assert.equal(sequence.totalDurationMs, 2600);
assert.notEqual(sequence.sourceId, sequence.targetId);
assert.equal(scenario.entities.find((entity) => entity.id === sequence.sourceId)?.controllerId !== scenario.entities.find((entity) => entity.id === sequence.targetId)?.controllerId, true);
assert.equal(getBattlefieldDemoBeatAt(sequence, 0)?.id, "fireball");
assert.equal(getBattlefieldDemoBeatAt(sequence, 619)?.id, "fireball");
assert.equal(getBattlefieldDemoBeatAt(sequence, 620)?.id, "damage");
assert.equal(getBattlefieldDemoBeatAt(sequence, 1140)?.id, "death");
assert.equal(getBattlefieldDemoBeatAt(sequence, 1760)?.id, "priority");
assert.equal(getBattlefieldDemoBeatAt(sequence, 2600), null);

console.log("battlefield deterministic demo sequence: ok");
