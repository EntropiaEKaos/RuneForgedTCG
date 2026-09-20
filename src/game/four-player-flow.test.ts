import assert from "node:assert/strict";
import {
  createFourPlayerResolutionFlow,
  passFourPlayerFlow,
  resolveFourPlayerFlow,
  submitFourPlayerAction,
} from "./four-player-flow";

let flow = createFourPlayerResolutionFlow("p1");

// P1 opens an action. Priority moves to P2.
flow = submitFourPlayerAction(flow, {
  id: "spell-p1",
  controller: "p1",
  kind: "spell",
  payload: { label: "P1 opener" },
});
assert.equal(flow.priority.holder, "p2");
assert.equal(flow.stack.items.length, 1);

// P2 passes; P3 responds. That action resets the pass cycle and moves to P4.
flow = passFourPlayerFlow(flow);
assert.equal(flow.priority.holder, "p3");
flow = submitFourPlayerAction(flow, {
  id: "response-p3",
  controller: "p3",
  kind: "response",
  payload: { label: "P3 answer" },
});
assert.equal(flow.priority.holder, "p4");
assert.equal(flow.stack.items.length, 2);

// P4, P1, P2 and P3 all pass; the P3 response resolves first (LIFO).
flow = passFourPlayerFlow(flow);
flow = passFourPlayerFlow(flow);
flow = passFourPlayerFlow(flow);
flow = passFourPlayerFlow(flow);
let resolution = resolveFourPlayerFlow(flow);
assert.equal(resolution.resolved?.id, "response-p3");
assert.equal(resolution.flow.stack.items.length, 1);
assert.equal(resolution.flow.stack.resolvedCount, 1);

// New priority cycle, then original P1 object resolves.
flow = resolution.flow;
flow = passFourPlayerFlow(flow);
flow = passFourPlayerFlow(flow);
flow = passFourPlayerFlow(flow);
flow = passFourPlayerFlow(flow);
resolution = resolveFourPlayerFlow(flow);
assert.equal(resolution.resolved?.id, "spell-p1");
assert.equal(resolution.flow.stack.items.length, 0);
assert.equal(resolution.flow.stack.resolvedCount, 2);

// Illegal out-of-priority action is rejected deterministically.
flow = createFourPlayerResolutionFlow("p1");
assert.throws(() => submitFourPlayerAction(flow, {
  id: "illegal-p3",
  controller: "p3",
  kind: "spell",
  payload: {},
}), /cannot act/);

console.log("FOUR PLAYER HEADLESS RESPONSE FLOW: PASS");
