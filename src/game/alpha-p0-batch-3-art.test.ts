import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import sharp from "sharp";
import { alphaArtExposure } from "./alpha-art-priority";
import { ALPHA_P0_ACTIVE_IDS, ALPHA_P0_ART_FORMAT, ALPHA_P0_ART_TARGETS, alphaP0ArtUrl } from "./alpha-p0-art";

const batchIds = [
  "forest_canopy_warden",
  "forest_cub",
  "storm_dashbolt",
  "storm_eye",
  "storm_herald",
] as const;

async function main() {
  assert.ok(ALPHA_P0_ACTIVE_IDS.length >= 15, "Batch 3 activation must preserve at least the first fifteen certified P0 masters");
  assert.deepEqual(
    ALPHA_P0_ART_TARGETS.slice(10, 15).map((entry) => entry.defId),
    [...batchIds],
    "Batch 3 must remain positions 11-15 in the certified P0 production contract",
  );
  assert.deepEqual(
    ALPHA_P0_ACTIVE_IDS.slice(10, 15),
    [...batchIds],
    "Physically certified Batch 3 masters must exactly match the third active P0 slice",
  );

  const targets = batchIds.map((defId) => {
    const target = ALPHA_P0_ART_TARGETS.find((entry) => entry.defId === defId);
    assert.ok(target, `Missing Alpha P0 manifest target ${defId}`);
    assert.equal(ALPHA_P0_ACTIVE_IDS.includes(defId), true, `${defId} must be runtime-active after Batch 3 certification`);
    assert.equal(alphaP0ArtUrl(defId), target.assetPath, `${defId} must resolve its certified Batch 3 master`);
    const exposure = alphaArtExposure(defId);
    assert.equal(exposure.priority, "covered", `${defId} must leave the P0 queue after activation`);
    assert.equal(exposure.knownDedicatedArt, true, `${defId} must be reported as covered after activation`);
    return target;
  });

  execFileSync(process.execPath, ["scripts/generate-alpha-p0-batch-3-art.mjs"], {
    cwd: process.cwd(),
    stdio: "inherit",
  });

  const tiles: Buffer[] = [];
  for (const target of targets) {
    const diskPath = resolve(`public${target.assetPath}`);
    const metadata = await sharp(diskPath).metadata();
    assert.equal(metadata.format, ALPHA_P0_ART_FORMAT.delivery, `${target.defId} must be WebP`);
    assert.equal(metadata.width, ALPHA_P0_ART_FORMAT.masterWidth, `${target.defId} width drift`);
    assert.equal(metadata.height, ALPHA_P0_ART_FORMAT.masterHeight, `${target.defId} height drift`);
    assert.equal(metadata.pages ?? 1, 1, `${target.defId} must be a single-frame master`);

    const thumb = await sharp(diskPath)
      .resize({ width: 270, height: 338, fit: "cover" })
      .png()
      .toBuffer();
    const label = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="62">
      <rect width="300" height="62" fill="#0a0b0f"/>
      <text x="150" y="25" text-anchor="middle" fill="#f4f0df" font-size="16" font-family="sans-serif" font-weight="700">${target.defId}</text>
      <text x="150" y="47" text-anchor="middle" fill="#aaa7a0" font-size="12" font-family="sans-serif">${target.region} · P0 master · Batch 3</text>
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

  const evidencePath = resolve("artifacts/alpha-visual/48-alpha-p0-batch-3-contact-sheet.png");
  await mkdir(dirname(evidencePath), { recursive: true });
  await sharp({
    create: { width: tiles.length * 300, height: 420, channels: 4, background: "#050608" },
  })
    .composite(tiles.map((input, index) => ({ input, left: index * 300, top: 0 })))
    .png()
    .toFile(evidencePath);

  console.log(`FORGED ALPHA P0 ART BATCH 3: ${targets.length}/${targets.length} physical masters · 1536x1920 WebP · active registry match · contact sheet PASS`);
}

void main().catch((error) => {
  console.error("FORGED ALPHA P0 ART BATCH 3: FAIL", error);
  process.exitCode = 1;
});
