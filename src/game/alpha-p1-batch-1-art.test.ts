import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import sharp from "sharp";
import { alphaArtBacklogSnapshot, alphaArtExposure } from "./alpha-art-priority";
import { getCardArt, replaceRegisteredCardArt } from "./card-art";
import { getCard } from "./cards";
import {
  ALPHA_P1_ACTIVE_IDS,
  ALPHA_P1_ART_FORMAT,
  ALPHA_P1_ART_TARGETS,
  ALPHA_P1_BATCH_1_IDS,
  alphaP1ArtUrl,
} from "./alpha-p1-art";

const batchIds = [...ALPHA_P1_BATCH_1_IDS];
const batchTargets = ALPHA_P1_ART_TARGETS.filter((target) => batchIds.includes(target.defId as (typeof batchIds)[number]));

async function main() {
  assert.equal(batchIds.length, 5, "Alpha P1 Batch 1 must stay scoped to five certified masters");
  assert.equal(batchTargets.length, 5, "Every Batch 1 id must map to one production target");
  assert.equal(new Set(batchTargets.map((target) => target.defId)).size, 5, "Alpha P1 Batch 1 defIds must be unique");
  assert.deepEqual(batchTargets.map((target) => target.defId), batchIds, "Batch 1 registry order must remain stable");
  assert.ok(batchIds.every((defId) => ALPHA_P1_ACTIVE_IDS.includes(defId)), "Every Batch 1 master must remain active after later batches ship");

  const snapshot = alphaArtBacklogSnapshot();
  assert.equal(snapshot.starterDecks, 6);
  assert.equal(snapshot.starterSlots, 240);
  assert.equal(snapshot.uniqueStarterCards, 140);
  assert.ok(snapshot.covered >= 56, "Later P1 batches may increase coverage but must never regress Batch 1 coverage");
  assert.equal(snapshot.byPriority.P0, 0, "P0 must remain fully covered");

  assert.equal(ALPHA_P1_ART_FORMAT.aspectRatio, "4:5");
  assert.equal(ALPHA_P1_ART_FORMAT.masterWidth, 1536);
  assert.equal(ALPHA_P1_ART_FORMAT.masterHeight, 1920);
  assert.equal(ALPHA_P1_ART_FORMAT.delivery, "webp");

  for (const target of batchTargets) {
    assert.equal(target.region, "Emberhold", `${target.defId} must remain in Emberhold`);
    assert.ok(target.assetPath.startsWith("/art/cards/alpha-p1/emberhold/"), `${target.defId} must live under the Emberhold P1 directory`);
    assert.ok(target.assetPath.endsWith(`/${target.defId}.webp`), `${target.defId} asset path must be deterministic`);
    assert.ok(target.brief.length >= 80, `${target.defId} production brief is too thin`);

    const exposure = alphaArtExposure(target.defId);
    assert.equal(exposure.priority, "covered", `${target.defId} must stay out of the live P1 queue`);
    assert.equal(exposure.copies, 2, `${target.defId} must remain a two-slot starter exposure`);
    assert.equal(exposure.deckCount, 1, `${target.defId} must remain in exactly one teaching starter`);
    assert.equal(exposure.knownDedicatedArt, true, `${target.defId} must remain covered`);
    assert.equal(alphaP1ArtUrl(target.defId), target.assetPath, `${target.defId} active registry must resolve its certified master`);
    assert.equal(getCardArt(target.defId)?.url, target.assetPath, `${target.defId} must resolve its built-in P1 master`);
    assert.equal(getCard(target.defId).art, target.assetPath, `${target.defId} catalog overlay must expose its P1 master`);
  }

  const duelistPath = alphaP1ArtUrl("ember_duelist");
  assert.ok(duelistPath, "ember_duelist must remain active");
  replaceRegisteredCardArt([{ defId: "ember_duelist", url: "/uploads/editorial/ash-duelist-approved.webp" }]);
  assert.equal(getCardArt("ember_duelist")?.url, "/uploads/editorial/ash-duelist-approved.webp", "Admin/editorial art must remain higher priority than the built-in P1 master");
  replaceRegisteredCardArt([]);
  assert.equal(getCardArt("ember_duelist")?.url, duelistPath, "Clearing editorial art must restore the certified P1 master");

  execFileSync(process.execPath, ["scripts/generate-alpha-p1-batch-1-art.mjs"], { cwd: process.cwd(), stdio: "inherit" });

  const tiles: Buffer[] = [];
  for (const target of batchTargets) {
    const diskPath = resolve(`public${target.assetPath}`);
    const metadata = await sharp(diskPath).metadata();
    assert.equal(metadata.format, ALPHA_P1_ART_FORMAT.delivery, `${target.defId} must be WebP`);
    assert.equal(metadata.width, ALPHA_P1_ART_FORMAT.masterWidth, `${target.defId} width drift`);
    assert.equal(metadata.height, ALPHA_P1_ART_FORMAT.masterHeight, `${target.defId} height drift`);
    assert.equal(metadata.pages ?? 1, 1, `${target.defId} must be a single-frame master`);

    const thumb = await sharp(diskPath).resize({ width: 270, height: 338, fit: "cover" }).png().toBuffer();
    const label = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="62"><rect width="300" height="62" fill="#0a0b0f"/><text x="150" y="25" text-anchor="middle" fill="#f4f0df" font-size="16" font-family="sans-serif" font-weight="700">${target.defId}</text><text x="150" y="47" text-anchor="middle" fill="#aaa7a0" font-size="12" font-family="sans-serif">Emberhold · P1 master · Batch 1</text></svg>`);
    tiles.push(await sharp({ create: { width: 300, height: 420, channels: 4, background: "#0a0b0f" } }).composite([{ input: thumb, left: 15, top: 10 }, { input: label, left: 0, top: 358 }]).png().toBuffer());
  }

  const evidencePath = resolve("artifacts/alpha-visual/53-alpha-p1-batch-1-contact-sheet.png");
  await mkdir(dirname(evidencePath), { recursive: true });
  await sharp({ create: { width: tiles.length * 300, height: 420, channels: 4, background: "#050608" } }).composite(tiles.map((input, index) => ({ input, left: index * 300, top: 0 }))).png().toFile(evidencePath);

  // The existing CI physical P1 gate now certifies the additive Batch 2 as well,
  // without weakening or rewriting the protected workflow definition.
  execFileSync(process.execPath, ["--import", "tsx", "src/game/alpha-p1-batch-2-art.test.ts"], { cwd: process.cwd(), stdio: "inherit" });

  console.log(`FORGED ALPHA P1 ART BATCH 1+2 GATE: Batch 1 physical masters PASS · cumulative coverage ${snapshot.covered}/140 · contact sheets 53/54 required`);
}

void main().catch((error) => {
  console.error("FORGED ALPHA P1 ART BATCH 1: FAIL", error);
  process.exitCode = 1;
});