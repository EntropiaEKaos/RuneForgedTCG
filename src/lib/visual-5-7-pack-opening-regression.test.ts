import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const layout = readFileSync("src/app/layout.tsx", "utf8");
const css = readFileSync("src/app/styles/visual-5-7-pack-opening.css", "utf8");
const storeClientPath = "src/app/store/StoreClient.tsx";
const packRoutePath = "src/app/api/packs/route.ts";
const storeClient = readFileSync(storeClientPath, "utf8");
const packRoute = readFileSync(packRoutePath, "utf8");
const visualCert = readFileSync("scripts/alpha-pack-opening-visual-cert.mjs", "utf8");
const ciWorkflow = readFileSync(".github/workflows/ci.yml", "utf8");
const suites = readFileSync("scripts/test-suites.mjs", "utf8");

const previousLayer = 'import "./styles/visual-5-6-cosmetic-prestige.css";';
const packOpeningLayer = 'import "./styles/visual-5-7-pack-opening.css";';

assert.ok(layout.includes(packOpeningLayer), "Visual 5.7 Pack Opening layer must be mounted");
assert.ok(
  layout.indexOf(packOpeningLayer) > layout.indexOf(previousLayer),
  "Visual 5.7 must load after Visual 5.6 so cosmetic prestige remains visible inside pack reveals",
);

for (const contract of [
  'section[role="dialog"][aria-labelledby="pack-reveal-heading"]',
  '#pack-reveal-heading',
  'article[style*="animation-delay"]',
  '[class*="border-slate-500"]',
  '[class*="border-blue-400"]',
  '[class*="border-purple-400"]',
  '[class*="border-amber-400"]',
  '.pack-cosmetic-highlights',
  '@supports not ((backdrop-filter: blur(4px)) or (-webkit-backdrop-filter: blur(4px)))',
  '@media (max-width: 720px)',
  '@media (prefers-reduced-motion: reduce)',
]) {
  assert.ok(css.includes(contract), `Visual 5.7 is missing pack-opening presentation contract: ${contract}`);
}

for (const forbidden of [
  '/api/packs',
  'fetch(',
  'operationId',
  'setReveal(',
  'setCosmeticPulls(',
  'setDustBonus(',
  'rollRarity',
  'packSeed',
  'dropRates',
  'playerPacks',
  'economy',
  '.tcg-arena',
  '.player-hand-shell',
]) {
  assert.equal(css.includes(forbidden), false, `Visual 5.7 must stay presentation-only; forbidden token found: ${forbidden}`);
}

function gitBlobSha(path: string): string {
  const bytes = readFileSync(path);
  const header = Buffer.from(`blob ${bytes.byteLength}\0`, "utf8");
  return createHash("sha1").update(header).update(bytes).digest("hex");
}

assert.equal(
  gitBlobSha(storeClientPath),
  "f1c329dc1836528184a49df14c9cbaa14102655d",
  "Visual 5.7 is certified as product CSS-only: StoreClient.tsx must remain byte-for-byte unchanged",
);
assert.equal(
  gitBlobSha(packRoutePath),
  "ed6140445162332c2ab4cba1e8abae954e9d7309",
  "Visual 5.7 must not modify authoritative /api/packs economy, odds or minting behavior",
);

for (const authorityContract of [
  'const openPack = async (packId: string) => {',
  'const operationId = pendingEconomyOperationId(fingerprint);',
  'body: JSON.stringify({ name: playerName, action: "open", packId, operationId })',
  'setReveal(data.cards);',
  'setCosmeticPulls(Array.isArray(data.cosmetics) ? data.cosmetics : []);',
  'setDustBonus(data.dustBonus);',
  'role="dialog"',
  'aria-labelledby="pack-reveal-heading"',
]) {
  assert.ok(storeClient.includes(authorityContract), `Existing Store pack authority/presentation contract disappeared: ${authorityContract}`);
}

for (const packAuthority of [
  'runIdempotentEconomyAction',
  'actionFingerprint = `pack:${action}:${packId}`',
  'rollRarity(packDef.dropRates, randomValue())',
  'createPackCollectibleAsset',
  'cards: (result.received ?? []).map',
  'cosmetics: result.mintedAssets ?? []',
  'dustBonus: result.dustBonus',
]) {
  assert.ok(packRoute.includes(packAuthority), `Authoritative pack contract disappeared: ${packAuthority}`);
}

for (const evidenceContract of [
  "bootstrapPlayerSession",
  "buyBasicPack",
  "clickOpenPack",
  "fetch('/api/packs'",
  "packId: 'basic'",
  'X-Operation-Id',
  'section[role="dialog"][aria-labelledby="pack-reveal-heading"]',
  'evidence.cardCount, 5',
  '35-pack-opening-premium.png',
  '35-pack-opening-diagnostic.png',
  'pack-opening-visual-manifest.json',
]) {
  assert.ok(visualCert.includes(evidenceContract), `Visual 5.7 browser evidence is missing contract: ${evidenceContract}`);
}

for (const forbiddenEvidenceMutation of [
  '/api/admin',
  '/api/matchmaking',
  '/api/ranked',
  'method: \'DELETE\'',
]) {
  assert.equal(
    visualCert.includes(forbiddenEvidenceMutation),
    false,
    `Visual 5.7 browser evidence must isolate itself to public player/pack authority: ${forbiddenEvidenceMutation}`,
  );
}

assert.ok(
  ciWorkflow.includes("node scripts/alpha-pack-opening-visual-cert.mjs"),
  "Visual 5.7 Pack Opening browser evidence must run inside the full CI browser gate",
);
assert.ok(
  ciWorkflow.indexOf("node scripts/alpha-pack-opening-visual-cert.mjs") > ciWorkflow.indexOf("node scripts/alpha-cosmetic-prestige-visual-cert.mjs"),
  "Pack Opening evidence must run after Visual 5.6 cosmetic prestige evidence",
);
assert.ok(
  suites.includes('"src/lib/visual-5-7-pack-opening-regression.test.ts"'),
  "Visual 5.7 regression contract must be registered as a source-contract test",
);

console.log("RUNE FORGE VISUAL 5.7 PACK OPENING: CSS-only product authority + real basic-pack browser evidence contracts PASS");
