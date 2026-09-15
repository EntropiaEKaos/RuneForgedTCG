import assert from "node:assert/strict";
import { alphaArtPriorityQueue, alphaArtExposure } from "./alpha-art-priority";
import { ALPHA_P0_ART_FORMAT, ALPHA_P0_ART_ROOT, ALPHA_P0_ART_TARGETS } from "./alpha-p0-art";

assert.equal(ALPHA_P0_ART_TARGETS.length, 21, "Alpha P0 production contract must stay scoped to 21 masters");
assert.equal(new Set(ALPHA_P0_ART_TARGETS.map((target) => target.defId)).size, 21, "Alpha P0 target defIds must be unique");
assert.equal(ALPHA_P0_ART_FORMAT.aspectRatio, "4:5");
assert.equal(ALPHA_P0_ART_FORMAT.masterWidth, 1536);
assert.equal(ALPHA_P0_ART_FORMAT.masterHeight, 1920);
assert.equal(ALPHA_P0_ART_FORMAT.delivery, "webp");

const liveP0 = alphaArtPriorityQueue().filter((row) => row.priority === "P0");
assert.equal(liveP0.length, 21, "Live starter backlog must still contain exactly 21 P0 cards before production assets are activated");

const contractIds = [...ALPHA_P0_ART_TARGETS.map((target) => target.defId)].sort();
const liveIds = [...liveP0.map((row) => row.defId)].sort();
assert.deepEqual(contractIds, liveIds, "P0 production contract must exactly match the deterministic starter exposure queue");

for (const target of ALPHA_P0_ART_TARGETS) {
  const exposure = alphaArtExposure(target.defId);
  assert.equal(exposure.priority, "P0", `${target.defId} must remain P0 until its dedicated art is activated`);
  assert.equal(exposure.knownDedicatedArt, false, `${target.defId} must not be reported as covered before its master exists`);
  assert.ok(exposure.copies >= 2 || exposure.deckCount >= 2, `${target.defId} must have qualifying starter exposure`);
  assert.ok(target.assetPath.startsWith(`${ALPHA_P0_ART_ROOT}/${target.region.toLowerCase()}/`), `${target.defId} must live under its regional P0 art directory`);
  assert.ok(target.assetPath.endsWith(`/${target.defId}.webp`), `${target.defId} asset path must be deterministic`);
  assert.ok(target.brief.length >= 80, `${target.defId} production brief is too thin`);
}

console.log(`FORGED ALPHA P0 ART CONTRACT: ${ALPHA_P0_ART_TARGETS.length} masters / exact live queue match / PASS`);
