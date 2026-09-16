import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import sharp from "sharp";
import { alphaArtBacklogSnapshot, alphaArtExposure } from "./alpha-art-priority";
import { getCardArt, replaceRegisteredCardArt } from "./card-art";
import { allCards, getCard } from "./cards";
import {
  ALPHA_P1_ACTIVE_IDS,
  ALPHA_P1_ACTIVE_TARGETS,
  ALPHA_P1_ART_FORMAT,
  ALPHA_P1_ART_ROOT,
  ALPHA_P1_ART_TARGETS,
  alphaP1ArtUrl,
} from "./alpha-p1-art";

const batchIds = [
  "ember_duelist",
  "ember_raider",
  "ember_herald",
  "ember_whelp",
  "ember_zealot",
] as const;

async function main() {
  assert.equal(ALPHA_P1_ART_TARGETS.length, 5, "Alpha P1 Batch 1 must stay scoped to five certified physical masters");
  assert.equal(ALPHA_P1_ACTIVE_IDS.length, 5, "Alpha P1 Batch 1 activation must expose exactly five certified masters");
  assert.equal(ALPHA_P1_ACTIVE_TARGETS.length, 5, "Every active P1 id must map to one production target");
  assert.equal(new Set(ALPHA_P1_ART_TARGETS.map((target) => target.defId)).size, 5, "Alpha P1 Batch 1 defIds must be unique");
  assert.deepEqual(ALPHA_P1_ART_TARGETS.map((target) => target.defId), [...batchIds], "Alpha P1 Batch 1 manifest must preserve the certified Studio production order");
  assert.deepEqual([...ALPHA_P1_ACTIVE_IDS], [...batchIds], "Active P1 registry must exactly match the certified Batch 1 order");

  const snapshot = alphaArtBacklogSnapshot();
  assert.deepEqual(
    snapshot,
    {
      starterDecks: 6,
      starterSlots: 240,
      uniqueStarterCards: 140,
      covered: 56,
      missing: 84,
      byPriority: { P0: 0, P1: 41, P2: 43 },
    },
    "P1 Batch 1 activation must move exactly five starter cards from P1 to covered",
  );

  const studioP1 = allCards()
    .filter((card) => card.collectible !== false)
    .map((card) => ({ card, exposure: alphaArtExposure(card.defId) }))
    .filter(({ exposure }) => exposure.priority === "P1")
    .sort((a, b) => b.exposure.score - a.exposure.score || a.card.region.localeCompare(b.card.region) || a.card.name.localeCompare(b.card.name));
  assert.equal(studioP1.length, 41, "P1 queue must fall from 46 to 41 after Batch 1 activation");
  assert.equal(studioP1.some(({ card }) => batchIds.includes(card.defId as (typeof batchIds)[number])), false, "Activated Batch 1 cards must leave the live Studio P1 queue");
  console.log("FORGED ALPHA P1 BATCH 2 CANDIDATES:", studioP1.slice(0, 5).map(({ card }) => `${card.defId}|${card.name}|${card.region}`).join(","));

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
    assert.equal(exposure.priority, "covered", `${target.defId} must leave the P1 queue after activation`);
    assert.equal(exposure.copies, 2, `${target.defId} must remain a two-slot starter exposure`);
    assert.equal(exposure.deckCount, 1, `${target.defId} must remain in exactly one teaching starter`);
    assert.equal(exposure.knownDedicatedArt, true, `${target.defId} must be covered after activation`);
    assert.equal(alphaP1ArtUrl(target.defId), target.assetPath, `${target.defId} active registry must resolve its certified P1 master`);
    assert.equal(getCardArt(target.defId)?.url, target.assetPath, `${target.defId} must resolve its built-in P1 master`);
    assert.equal(getCard(target.defId).art, target.assetPath, `${target.defId} catalog overlay must expose its P1 master`);
  }

  const duelistPath = ALPHA_P1_ACTIVE_TARGETS.find((target) => target.defId === "ember_duelist")?.assetPath;
  assert.ok(duelistPath, "ember_duelist must be present in the active P1 registry");
  replaceRegisteredCardArt([{ defId: "ember_duelist", url: "/uploads/editorial/ash-duelist-approved.webp" }]);
  assert.equal(getCardArt("ember_duelist")?.url, "/uploads/editorial/ash-duelist-approved.webp", "Admin/editorial art must remain higher priority than the built-in P1 master");
  replaceRegisteredCardArt([]);
  assert.equal(getCardArt("ember_duelist")?.url, duelistPath, "Clearing editorial art must restore the certified P1 master");

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

    const thumb = await sharp(diskPath).resize({ width: 270, height: 338, fit: "cover" }).png().toBuffer();
    const label = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="62">
      <rect width="300" height="62" fill="#0a0b0f"/>
      <text x="150" y="25" text-anchor="middle" fill="#f4f0df" font-size="16" font-family="sans-serif" font-weight="700">${target.defId}</text>
      <text x="150" y="47" text-anchor="middle" fill="#aaa7a0" font-size="12" font-family="sans-serif">Emberhold · P1 master · Batch 1</text>
    </svg>`);

    tiles.push(await sharp({ create: { width: 300, height: 420, channels: 4, background: "#0a0b0f" } })
      .composite([{ input: thumb, left: 15, top: 10 }, { input: label, left: 0, top: 358 }])
      .png()
      .toBuffer());
  }

  const evidencePath = resolve("artifacts/alpha-visual/53-alpha-p1-batch-1-contact-sheet.png");
  await mkdir(dirname(evidencePath), { recursive: true });
  await sharp({ create: { width: tiles.length * 300, height: 420, channels: 4, background: "#050608" } })
    .composite(tiles.map((input, index) => ({ input, left: index * 300, top: 0 })))
    .png()
    .toFile(evidencePath);

  console.log("FORGED ALPHA P1 ART BATCH 1: 5/5 physical masters · 1536x1920 WebP · active registry match · 56 covered / 84 backlog / 41 P1 pending · contact sheet PASS");
}

void main().catch((error) => {
  console.error("FORGED ALPHA P1 ART BATCH 1: FAIL", error);
  process.exitCode = 1;
});