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
assert.equal(ALPHA_P0_ACTIVE_IDS.length, 5, "Batch 1 activation must stay scoped to five certified masters");
assert.equal(ALPHA_P0_ACTIVE_TARGETS.length, 5, "Every active P0 id must map to one production target");
assert.deepEqual(
  ALPHA_P0_ART_TARGETS.slice(0, ALPHA_P0_ACTIVE_IDS.length).map((entry) => entry.defId),
  [...ALPHA_P0_ACTIVE_IDS],
  "Batch 1 activation must remain the five highest-exposure P0 targets",
);
assert.equal(ALPHA_P0_ART_FORMAT.aspectRatio, "4:5");
assert.equal(ALPHA_P0_ART_FORMAT.masterWidth, 1536);
assert.equal(ALPHA_P0_ART_FORMAT.masterHeight, 1920);
assert.equal(ALPHA_P0_ART_FORMAT.delivery, "webp");

const activeIds = new Set<string>(ALPHA_P0_ACTIVE_IDS);
const pendingTargets = ALPHA_P0_ART_TARGETS.filter((target) => !activeIds.has(target.defId));
const liveP0 = alphaArtPriorityQueue().filter((row) => row.priority === "P0");
assert.equal(liveP0.length, 16, "Activating Batch 1 must reduce the live P0 queue from 21 to 16 cards");
assert.deepEqual(
  [...pendingTargets.map((target) => target.defId)].sort(),
  [...liveP0.map((row) => row.defId)].sort(),
  "Remaining P0 production targets must exactly match the live deterministic P0 queue",
);

const snapshot = alphaArtBacklogSnapshot();
assert.equal(snapshot.uniqueStarterCards, 140, "Starter art universe must remain 140 unique cards");
assert.equal(snapshot.covered, 35, "30 Flagship masters + five activated P0 masters must report 35 covered starter cards");
assert.equal(snapshot.missing, 105, "Batch 1 activation must leave 105 starter cards without dedicated art");
assert.equal(snapshot.byPriority.P0, 16, "Batch 1 activation must leave exactly 16 P0 cards pending");

for (const target of ALPHA_P0_ART_TARGETS) {
  assert.ok(target.assetPath.startsWith(`${ALPHA_P0_ART_ROOT}/${target.region.toLowerCase()}/`), `${target.defId} must live under its regional P0 art directory`);
  assert.ok(target.assetPath.endsWith(`/${target.defId}.webp`), `${target.defId} asset path must be deterministic`);
  assert.ok(target.brief.length >= 80, `${target.defId} production brief is too thin`);

  const exposure = alphaArtExposure(target.defId);
  if (activeIds.has(target.defId)) {
    assert.equal(exposure.priority, "covered", `${target.defId} must leave the P0 queue after activation`);
    assert.equal(exposure.knownDedicatedArt, true, `${target.defId} must be reported as covered after certified activation`);
    assert.equal(alphaP0ArtUrl(target.defId), target.assetPath, `${target.defId} active registry must resolve its certified master`);
    assert.equal(getCardArt(target.defId)?.url, target.assetPath, `${target.defId} must resolve its built-in P0 master`);
    assert.equal(getCard(target.defId).art, target.assetPath, `${target.defId} catalog overlay must expose its P0 master`);
  } else {
    assert.equal(exposure.priority, "P0", `${target.defId} must remain P0 until its dedicated art is activated`);
    assert.equal(exposure.knownDedicatedArt, false, `${target.defId} must remain uncovered before activation`);
    assert.equal(alphaP0ArtUrl(target.defId), undefined, `${target.defId} must remain fail-closed until activation`);
  }
}

const emberBoltPath = ALPHA_P0_ACTIVE_TARGETS.find((target) => target.defId === "ember_bolt")?.assetPath;
assert.ok(emberBoltPath, "ember_bolt must be present in the active P0 registry");
replaceRegisteredCardArt([{ defId: "ember_bolt", url: "/uploads/editorial/ember-bolt-approved.webp" }]);
assert.equal(getCardArt("ember_bolt")?.url, "/uploads/editorial/ember-bolt-approved.webp", "Admin/editorial art must remain higher priority than the built-in P0 master");
replaceRegisteredCardArt([]);
assert.equal(getCardArt("ember_bolt")?.url, emberBoltPath, "Clearing editorial art must restore the certified P0 master");

console.log("FORGED ALPHA P0 ART ACTIVATION: 5 active / 35 covered / 105 backlog / 16 P0 pending / PASS");
