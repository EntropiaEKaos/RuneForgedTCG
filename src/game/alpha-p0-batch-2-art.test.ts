import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import sharp from "sharp";
import { alphaArtExposure } from "./alpha-art-priority";
import { ALPHA_P0_ACTIVE_IDS, ALPHA_P0_ART_FORMAT, ALPHA_P0_ART_TARGETS, alphaP0ArtUrl } from "./alpha-p0-art";

const batchIds = [
  "ember_sprinter",
  "wood_ward",
  "ember_face",
  "ember_drake",
  "ember_stun",
] as const;

async function main() {
  assert.deepEqual(
    ALPHA_P0_ART_TARGETS.slice(5, 10).map((entry) => entry.defId),
    [...batchIds],
    "Batch 2 must remain the next five masters in the certified P0 production contract",
  );

  const targets = batchIds.map((defId) => {
    const target = ALPHA_P0_ART_TARGETS.find((entry) => entry.defId === defId);
    assert.ok(target, `Missing Alpha P0 manifest target ${defId}`);
    assert.equal(ALPHA_P0_ACTIVE_IDS.includes(defId as never), false, `${defId} must not be runtime-active in the physical-production PR`);
    assert.equal(alphaP0ArtUrl(defId), undefined, `${defId} must remain fail-closed until a separate activation PR`);
    const exposure = alphaArtExposure(defId);
    assert.equal(exposure.priority, "P0", `${defId} must still be a pending P0 target`);
    assert.equal(exposure.knownDedicatedArt, false, `${defId} must not be reported as covered before activation`);
    return target;
  });

  execFileSync(process.execPath, ["scripts/generate-alpha-p0-batch-2-art.mjs"], {
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
      <text x="150" y="47" text-anchor="middle" fill="#aaa7a0" font-size="12" font-family="sans-serif">${target.region} · P0 master · Batch 2</text>
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

  const evidencePath = resolve("artifacts/alpha-visual/46-alpha-p0-batch-2-contact-sheet.png");
  await mkdir(dirname(evidencePath), { recursive: true });
  await sharp({
    create: { width: tiles.length * 300, height: 420, channels: 4, background: "#050608" },
  })
    .composite(tiles.map((input, index) => ({ input, left: index * 300, top: 0 })))
    .png()
    .toFile(evidencePath);

  console.log(`FORGED ALPHA P0 ART BATCH 2: ${targets.length}/${targets.length} physical masters · 1536x1920 WebP · inactive/fail-closed · contact sheet PASS`);
}

void main().catch((error) => {
  console.error("FORGED ALPHA P0 ART BATCH 2: FAIL", error);
  process.exitCode = 1;
});
