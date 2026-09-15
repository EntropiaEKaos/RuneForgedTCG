import assert from "node:assert/strict";
import { alphaArtBacklogSnapshot, alphaArtExposure, alphaArtPriorityQueue } from "./alpha-art-priority";

const snapshot = alphaArtBacklogSnapshot();
assert.equal(snapshot.starterDecks, 6);
assert.equal(snapshot.starterSlots, 240);
assert.equal(snapshot.uniqueStarterCards, 140);
assert.equal(snapshot.covered, 30);
assert.equal(snapshot.missing, 110);
assert.deepEqual(snapshot.byPriority, { P0: 21, P1: 46, P2: 43 });

const emberBolt = alphaArtExposure("ember_bolt");
assert.equal(emberBolt.copies, 5);
assert.equal(emberBolt.deckCount, 2);
assert.equal(emberBolt.priority, "P0");
assert.deepEqual(emberBolt.deckIds, ["ember_aggro", "tempestade_rush"]);

const webweaver = alphaArtExposure("wood_webweaver");
assert.equal(webweaver.copies, 5);
assert.equal(webweaver.deckCount, 2);
assert.equal(webweaver.priority, "P0");

const signature = alphaArtExposure("ember_ashguard");
assert.equal(signature.knownDedicatedArt, true);
assert.equal(signature.priority, "covered");

const queue = alphaArtPriorityQueue();
assert.equal(queue.length, 110);
assert.equal(queue[0]?.score, 250);
assert.deepEqual(queue.slice(0, 2).map((row) => row.defId).sort(), ["ember_bolt", "wood_webweaver"]);
assert.ok(queue.every((row, index) => index === 0 || queue[index - 1].score >= row.score));
assert.ok(queue.every((row) => !row.knownDedicatedArt));

console.log("ALPHA ART PRIORITY: PASS", snapshot);
