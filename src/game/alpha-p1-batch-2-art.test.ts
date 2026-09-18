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
  ALPHA_P1_BATCH_2_IDS,
  alphaP1ArtUrl,
} from "./alpha-p1-art";

const expectedIds = [
  "ember_blade",
  "ember_phantom",
  "forest_pack_shelter",
  "forest_summon_pack",
  "forest_packrunner",
] as const;
const batchIds = [...ALPHA_P1_BATCH_2_IDS];
const batchTargets = ALPHA_P1_ART_TARGETS.filter((target) => batchIds.includes(target.defId as (typeof batchIds)[number]));

async function main() {
  assert.deepEqual(batchIds, [...expectedIds], "P1 Batch 2 must preserve the deterministic Studio queue slice");
  assert.equal(batchTargets.length, 5, "P1 Batch 2 must contain exactly five physical masters");
  assert.equal(new Set(batchTargets.map((target) => target.defId)).size, 5, "P1 Batch 2 defIds must be unique");
  assert.deepEqual(batchTargets.map((target) => target.defId), [...expectedIds], "P1 Batch 2 target order must match Studio production order");
  assert.ok(batchIds.every((defId) => ALPHA_P1_ACTIVE_IDS.includes(defId)), "P1 Batch 2 must be runtime-active after certification registration");

  const snapshot = alphaArtBacklogSnapshot();
  assert.deepEqual(
    snapshot,
    {
      starterDecks: 6,
      starterSlots: 240,
      uniqueStarterCards: 140,
      covered: 71,
      missing: 69,
      byPriority: { P0: 0, P1: 26, P2: 43 },
    },
    "P1 Batch 2 must remain covered while the active Batch 4 advances the global queue",
  );

  assert.equal(ALPHA_P1_ART_FORMAT.aspectRatio, "4:5");
  assert.equal(ALPHA_P1_ART_FORMAT.masterWidth, 1536);
  assert.equal(ALPHA_P1_ART_FORMAT.masterHeight, 1920);
  assert.equal(ALPHA_P1_ART_FORMAT.delivery, "webp");

  for (const target of batchTargets) {
    assert.ok(target.assetPath.startsWith(`/art/cards/alpha-p1/${target.region.toLowerCase()}/`), `${target.defId} path must match its region`);
    assert.ok(target.assetPath.endsWith(`/${target.defId}.webp`), `${target.defId} asset path must be deterministic`);
    assert.ok(target.brief.length >= 100, `${target.defId} production brief is too thin`);

    const exposure = alphaArtExposure(target.defId);
    assert.equal(exposure.priority, "covered", `${target.defId} must leave the live P1 queue after activation`);
    assert.equal(exposure.copies, 2, `${target.defId} must remain a two-slot starter exposure`);
    assert.equal(exposure.deckCount, 1, `${target.defId} must remain in exactly one teaching starter`);
    assert.equal(exposure.knownDedicatedArt, true, `${target.defId} must be covered after activation`);
    assert.equal(alphaP1ArtUrl(target.defId), target.assetPath, `${target.defId} active registry must resolve its Batch 2 master`);
    assert.equal(getCardArt(target.defId)?.url, target.assetPath, `${target.defId} must resolve its built-in Batch 2 master`);
    assert.equal(getCard(target.defId).art, target.assetPath, `${target.defId} catalog overlay must expose its Batch 2 master`);
  }

  const bladePath = alphaP1ArtUrl("ember_blade");
  assert.ok(bladePath, "ember_blade must be active in Batch 2");
  replaceRegisteredCardArt([{ defId: "ember_blade", url: "/uploads/editorial/flamebrand-approved.webp" }]);
  assert.equal(getCardArt("ember_blade")?.url, "/uploads/editorial/flamebrand-approved.webp", "Admin/editorial art must remain higher priority than built-in Batch 2 art");
  replaceRegisteredCardArt([]);
  assert.equal(getCardArt("ember_blade")?.url, bladePath, "Clearing editorial art must restore the Batch 2 master");

  execFileSync(process.execPath, ["scripts/generate-alpha-p1-batch-2-art.mjs"], { cwd: process.cwd(), stdio: "inherit" });

  const tiles: Buffer[] = [];
  for (const target of batchTargets) {
    const diskPath = resolve(`public${target.assetPath}`);
    const metadata = await sharp(diskPath).metadata();
    assert.equal(metadata.format, ALPHA_P1_ART_FORMAT.delivery, `${target.defId} must be WebP`);
    assert.equal(metadata.width, ALPHA_P1_ART_FORMAT.masterWidth, `${target.defId} width drift`);
    assert.equal(metadata.height, ALPHA_P1_ART_FORMAT.masterHeight, `${target.defId} height drift`);
    assert.equal(metadata.pages ?? 1, 1, `${target.defId} must be a single-frame master`);

    const thumb = await sharp(diskPath).resize({ width: 270, height: 338, fit: "cover" }).png().toBuffer();
    const label = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="62"><rect width="300" height="62" fill="#0a0b0f"/><text x="150" y="25" text-anchor="middle" fill="#f4f0df" font-size="15" font-family="sans-serif" font-weight="700">${target.defId}</text><text x="150" y="47" text-anchor="middle" fill="#aaa7a0" font-size="12" font-family="sans-serif">${target.region} · P1 master · Batch 2</text></svg>`);
    tiles.push(await sharp({ create: { width: 300, height: 420, channels: 4, background: "#0a0b0f" } }).composite([{ input: thumb, left: 15, top: 10 }, { input: label, left: 0, top: 358 }]).png().toBuffer());
  }

  const evidencePath = resolve("artifacts/alpha-visual/54-alpha-p1-batch-2-contact-sheet.png");
  await mkdir(dirname(evidencePath), { recursive: true });
  await sharp({ create: { width: tiles.length * 300, height: 420, channels: 4, background: "#050608" } }).composite(tiles.map((input, index) => ({ input, left: index * 300, top: 0 }))).png().toFile(evidencePath);

  execFileSync(process.execPath, ["--import", "tsx", "src/game/alpha-p1-batch-3-art.test.ts"], { cwd: process.cwd(), stdio: "inherit" });
  console.log("FORGED ALPHA P1 ART BATCH 2+3+4: 15 physical masters chained · Batch 4 contract certified");
}

void main().catch((error) => {
  console.error("FORGED ALPHA P1 ART BATCH 2: FAIL", error);
  process.exitCode = 1;
});