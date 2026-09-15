import assert from "node:assert/strict";
import { getCard } from "./cards";
import { getCardArt, replaceRegisteredCardArt } from "./card-art";
import { alphaArtBacklogSnapshot, alphaArtPriorityQueue, alphaArtExposure } from "./alpha-art-priority";
import {
  ALPHA_P0_ACTIVE_IDS,
  ALPHA_P0_ACTIVE_TARGETS,
  ALPHA_P0_ART_FORMAT,
  ALPHA_P0_ART_ROOT,
  ALPHA_P0_ART_TARGETS,
  alphaP0ArtUrl,
} from "./alpha-p0-art";

assert.equal(ALPHA_P0_ART_TARGETS.length, 21, "Alpha P0 production contract must stay scoped to 21 masters");
assert.equal(new Set(ALPHA_P0_ART_TARGETS.map((target) => target.defId)).size, 21, "Alpha P0 target defIds must be unique");
assert.equal(ALPHA_P0_ACTIVE_IDS.length, 21, "Final Alpha P0 activation must expose all twenty-one certified masters");
assert.equal(ALPHA_P0_ACTIVE_TARGETS.length, 21, "Every active P0 id must map to one production target");
assert.deepEqual(
  ALPHA_P0_ART_TARGETS.map((entry) => entry.defId),
  [...ALPHA_P0_ACTIVE_IDS],
  "Final Alpha P0 activation must preserve the complete certified production order",
);
assert.equal(ALPHA_P0_ART_FORMAT.aspectRatio, "4:5");
assert.equal(ALPHA_P0_ART_FORMAT.masterWidth, 1536);
assert.equal(ALPHA_P0_ART_FORMAT.masterHeight, 1920);
assert.equal(ALPHA_P0_ART_FORMAT.delivery, "webp");

const activeIds = new Set<string>(ALPHA_P0_ACTIVE_IDS);
const pendingTargets = ALPHA_P0_ART_TARGETS.filter((target) => !activeIds.has(target.defId));
const liveP0 = alphaArtPriorityQueue().filter((row) => row.priority === "P0");
assert.equal(pendingTargets.length, 0, "Every certified P0 target must remain active after later priority promotions");
assert.equal(liveP0.length, 0, "Later P1 activation must not reintroduce any P0 production debt");

const snapshot = alphaArtBacklogSnapshot();
assert.equal(snapshot.uniqueStarterCards, 140, "Starter art universe must remain 140 unique cards");
assert.equal(snapshot.covered, 56, "30 Flagship + 21 P0 + five P1 masters must report 56 covered starter cards");
assert.equal(snapshot.missing, 84, "P1 Batch 1 activation must leave 84 starter cards without dedicated art");
assert.equal(snapshot.byPriority.P0, 0, "P1 Batch 1 activation must keep the P0 queue exhausted");
assert.equal(snapshot.byPriority.P1, 41, "P1 Batch 1 activation must leave 41 P1 cards pending");
assert.equal(snapshot.byPriority.P2, 43, "P1 Batch 1 activation must not change the P2 queue");

for (const target of ALPHA_P0_ART_TARGETS) {
  assert.ok(target.assetPath.startsWith(`${ALPHA_P0_ART_ROOT}/${target.region.toLowerCase()}/`), `${target.defId} must live under its regional P0 art directory`);
  assert.ok(target.assetPath.endsWith(`/${target.defId}.webp`), `${target.defId} asset path must be deterministic`);
  assert.ok(target.brief.length >= 80, `${target.defId} production brief is too thin`);

  const exposure = alphaArtExposure(target.defId);
  assert.equal(activeIds.has(target.defId), true, `${target.defId} must remain active after P1 promotion`);
  assert.equal(exposure.priority, "covered", `${target.defId} must remain outside the production queue`);
  assert.equal(exposure.knownDedicatedArt, true, `${target.defId} must remain reported as covered`);
  assert.equal(alphaP0ArtUrl(target.defId), target.assetPath, `${target.defId} active registry must resolve its certified master`);
  assert.equal(getCardArt(target.defId)?.url, target.assetPath, `${target.defId} must resolve its built-in P0 master`);
  assert.equal(getCard(target.defId).art, target.assetPath, `${target.defId} catalog overlay must expose its P0 master`);
}

const emberBoltPath = ALPHA_P0_ACTIVE_TARGETS.find((target) => target.defId === "ember_bolt")?.assetPath;
assert.ok(emberBoltPath, "ember_bolt must be present in the active P0 registry");
replaceRegisteredCardArt([{ defId: "ember_bolt", url: "/uploads/editorial/ember-bolt-approved.webp" }]);
assert.equal(getCardArt("ember_bolt")?.url, "/uploads/editorial/ember-bolt-approved.webp", "Admin/editorial art must remain higher priority than the built-in P0 master");
replaceRegisteredCardArt([]);
assert.equal(getCardArt("ember_bolt")?.url, emberBoltPath, "Clearing editorial art must restore the certified P0 master");

console.log("FORGED ALPHA P0 ART ACTIVATION: 21 active / 56 covered / 84 backlog / 0 P0 pending / P1 activation coexistence PASS");
