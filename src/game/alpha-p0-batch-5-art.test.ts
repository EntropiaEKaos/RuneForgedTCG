import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import sharp from "sharp";
import { alphaArtExposure } from "./alpha-art-priority";
import { ALPHA_P0_ACTIVE_IDS, ALPHA_P0_ART_FORMAT, ALPHA_P0_ART_TARGETS, alphaP0ArtUrl } from "./alpha-p0-art";

const batchIds = ["wood_cub"] as const;

async function main() {
  assert.equal(ALPHA_P0_ACTIVE_IDS.length, 15, "Batch 5 production must not activate additional P0 masters");
  assert.deepEqual(
    ALPHA_P0_ART_TARGETS.slice(20, 21).map((entry) => entry.defId),
    [...batchIds],
    "Batch 5 must remain the final position in the certified 21-master P0 production contract",
  );

  const activeIds = new Set<string>(ALPHA_P0_ACTIVE_IDS);
  const targets = batchIds.map((defId) => {
    const target = ALPHA_P0_ART_TARGETS.find((entry) => entry.defId === defId);
    assert.ok(target, `Missing Alpha P0 manifest target ${defId}`);
    assert.equal(activeIds.has(defId), false, `${defId} must remain inactive in the physical-production PR`);
    assert.equal(alphaP0ArtUrl(defId), undefined, `${defId} must remain fail-closed until a separate activation PR`);
    const exposure = alphaArtExposure(defId);
    assert.equal(exposure.priority, "P0", `${defId} must remain a pending P0 target`);
    assert.equal(exposure.knownDedicatedArt, false, `${defId} must not be reported as covered before activation`);
    return target;
  });

  execFileSync(process.execPath, ["scripts/generate-alpha-p0-batch-5-art.mjs"], {
    cwd: process.cwd(),
    stdio: "inherit",
  });

  const target = targets[0];
  const diskPath = resolve(`public${target.assetPath}`);
  const metadata = await sharp(diskPath).metadata();
  assert.equal(metadata.format, ALPHA_P0_ART_FORMAT.delivery, `${target.defId} must be WebP`);
  assert.equal(metadata.width, ALPHA_P0_ART_FORMAT.masterWidth, `${target.defId} width drift`);
  assert.equal(metadata.height, ALPHA_P0_ART_FORMAT.masterHeight, `${target.defId} height drift`);
  assert.equal(metadata.pages ?? 1, 1, `${target.defId} must be a single-frame master`);

  const thumb = await sharp(diskPath)
    .resize({ width: 540, height: 675, fit: "cover" })
    .png()
    .toBuffer();
  const label = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="110">
    <rect width="600" height="110" fill="#0a0b0f"/>
    <text x="300" y="42" text-anchor="middle" fill="#f4f0df" font-size="30" font-family="sans-serif" font-weight="700">${target.defId}</text>
    <text x="300" y="79" text-anchor="middle" fill="#aaa7a0" font-size="22" font-family="sans-serif">${target.region} · P0 master · Batch 5 · final target</text>
  </svg>`);

  const evidencePath = resolve("artifacts/alpha-visual/51-alpha-p0-batch-5-contact-sheet.png");
  await mkdir(dirname(evidencePath), { recursive: true });
  await sharp({
    create: { width: 600, height: 820, channels: 4, background: "#050608" },
  })
    .composite([
      { input: thumb, left: 30, top: 15 },
      { input: label, left: 0, top: 700 },
    ])
    .png()
    .toFile(evidencePath);

  console.log("FORGED ALPHA P0 ART BATCH 5: 1/1 physical master · 1536x1920 WebP · inactive/fail-closed · final P0 target · contact sheet PASS");
}

void main().catch((error) => {
  console.error("FORGED ALPHA P0 ART BATCH 5: FAIL", error);
  process.exitCode = 1;
});
