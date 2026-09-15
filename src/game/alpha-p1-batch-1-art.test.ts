import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import sharp from "sharp";
import { alphaArtBacklogSnapshot, alphaArtExposure, alphaArtPriorityQueue } from "./alpha-art-priority";
import {
  ALPHA_P1_ACTIVE_IDS,
  ALPHA_P1_ART_FORMAT,
  ALPHA_P1_ART_ROOT,
  ALPHA_P1_ART_TARGETS,
  alphaP1ArtUrl,
} from "./alpha-p1-art";

const batchIds = [
  "ember_duelist",
  "ember_herald",
  "ember_raider",
  "ember_whelp",
  "ember_zealot",
] as const;

async function main() {
  assert.equal(ALPHA_P1_ART_TARGETS.length, 5, "Alpha P1 Batch 1 must stay scoped to five physical masters");
  assert.equal(ALPHA_P1_ACTIVE_IDS.length, 0, "Physical P1 production must not activate runtime art");
  assert.equal(new Set(ALPHA_P1_ART_TARGETS.map((target) => target.defId)).size, 5, "Alpha P1 Batch 1 defIds must be unique");
  assert.deepEqual(
    ALPHA_P1_ART_TARGETS.map((target) => target.defId),
    [...batchIds],
    "Alpha P1 Batch 1 manifest must follow deterministic queue order",
  );

  const snapshot = alphaArtBacklogSnapshot();
  assert.deepEqual(
    snapshot,
    {
      starterDecks: 6,
      starterSlots: 240,
      uniqueStarterCards: 140,
      covered: 51,
      missing: 89,
      byPriority: { P0: 0, P1: 46, P2: 43 },
    },
    "Physical P1 production must not change live Studio coverage",
  );

  const liveP1 = alphaArtPriorityQueue().filter((row) => row.priority === "P1");
  assert.equal(liveP1.length, 46, "P1 queue must remain at 46 until runtime activation");
  assert.deepEqual(
    liveP1.slice(0, batchIds.length).map((row) => row.defId),
    [...batchIds],
    "Batch 1 must exactly match the deterministic top-five P1 queue",
  );

  assert.equal(ALPHA_P1_ART_FORMAT.aspectRatio, "4:5");
  assert.equal(ALPHA_P1_ART_FORMAT.masterWidth, 1536);
  assert.equal(ALPHA_P1_ART_FORMAT.masterHeight, 1920);
  assert.equal(ALPHA_P1_ART_FORMAT.delivery, "webp");

  for (const target of ALPHA_P1_ART_TARGETS) {
    assert.equal(target.region, "Emberhold", `${target.defId} must remain in Emberhold`);
    assert.ok(target.assetPath.startsWith(`${ALPHA_P1_ART_ROOT}/emberhold/`), `${target.defId} must live under the Emberhold P1 directory`);
    assert.ok(target.assetPath.endsWith(`/${target.defId}.webp`), `${target.defId} asset path must be deterministic`);
    assert.ok(target.brief.length >= 80, `${target.defId} production brief is too thin`);

    const exposure = alphaArtExposure(target.defId);
    assert.equal(exposure.priority, "P1", `${target.defId} must remain P1 before activation`);
    assert.equal(exposure.copies, 2, `${target.defId} must remain a two-slot starter exposure`);
    assert.equal(exposure.deckCount, 1, `${target.defId} must remain in exactly one teaching starter`);
    assert.equal(exposure.knownDedicatedArt, false, `${target.defId} must remain uncovered before activation`);
    assert.equal(alphaP1ArtUrl(target.defId), undefined, `${target.defId} must remain fail-closed before activation`);
  }

  execFileSync(process.execPath, ["scripts/generate-alpha-p1-batch-1-art.mjs"], {
    cwd: process.cwd(),
    stdio: "inherit",
  });

  const tiles: Buffer[] = [];
  for (const target of ALPHA_P1_ART_TARGETS) {
    const diskPath = resolve(`public${target.assetPath}`);
    const metadata = await sharp(diskPath).metadata();
    assert.equal(metadata.format, ALPHA_P1_ART_FORMAT.delivery, `${target.defId} must be WebP`);
    assert.equal(metadata.width, ALPHA_P1_ART_FORMAT.masterWidth, `${target.defId} width drift`);
    assert.equal(metadata.height, ALPHA_P1_ART_FORMAT.masterHeight, `${target.defId} height drift`);
    assert.equal(metadata.pages ?? 1, 1, `${target.defId} must be a single-frame master`);

    const thumb = await sharp(diskPath)
      .resize({ width: 270, height: 338, fit: "cover" })
      .png()
      .toBuffer();
    const label = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="62">
      <rect width="300" height="62" fill="#0a0b0f"/>
      <text x="150" y="25" text-anchor="middle" fill="#f4f0df" font-size="16" font-family="sans-serif" font-weight="700">${target.defId}</text>
      <text x="150" y="47" text-anchor="middle" fill="#aaa7a0" font-size="12" font-family="sans-serif">Emberhold · P1 master · Batch 1</text>
    </svg>`);

    tiles.push(await sharp({
      create: { width: 300, height: 420, channels: 4, background: "#0a0b0f" },
    })
      .composite([
        { input: thumb, left: 15, top: 10 },
        { input: label, left: 0, top: 358 },
      ])
      .png()
      .toBuffer());
  }

  const evidencePath = resolve("artifacts/alpha-visual/53-alpha-p1-batch-1-contact-sheet.png");
  await mkdir(dirname(evidencePath), { recursive: true });
  await sharp({
    create: { width: tiles.length * 300, height: 420, channels: 4, background: "#050608" },
  })
    .composite(tiles.map((input, index) => ({ input, left: index * 300, top: 0 })))
    .png()
    .toFile(evidencePath);

  console.log("FORGED ALPHA P1 ART BATCH 1: 5/5 physical masters · 1536x1920 WebP · inactive/fail-closed · top deterministic P1 queue · contact sheet PASS");
}

void main().catch((error) => {
  console.error("FORGED ALPHA P1 ART BATCH 1: FAIL", error);
  process.exitCode = 1;
});
