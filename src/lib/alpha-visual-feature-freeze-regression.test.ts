import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

/**
 * Alpha Visual Feature Freeze.
 *
 * These values are Git blob SHAs. Any deliberate structural visual change must
 * update the relevant blob intentionally, explain the break-glass reason, and
 * rerun the full CI/browser evidence before promotion. Editorial card art is
 * intentionally outside this contract.
 *
 * Historical break-glass milestones include the Recovery Key notice, collectible
 * cosmetics, Visual 4.x responsive/UX layers, Visual 5.0-5.8 premium layers, and
 * Brand Identity 1.0 regional heraldry. Their certified structural blobs remain
 * protected below.
 *
 * Brand Identity 1.1 break-glass 2026-09-14: layout.tsx is intentionally
 * recertified only to load brand-identity-1-1-product.css after Brand Identity
 * 1.0. The new layer supplies the candidate FORGED: THE CONVERGENCE product
 * mark/wordmark, home/header/footer identity and candidate card-back override.
 * CardView.tsx, BattleView.tsx, ArenaIdentity.tsx, engine/rules/APIs/persistence,
 * ranked authority and every frozen Visual 3.x structural blob remain unchanged.
 * Full CI, notebook/mobile browser certificates and real Alpha Visual Journey
 * screenshots are mandatory before this candidate identity shell is promoted.
 */
const FROZEN_VISUAL_BLOBS: Record<string, string> = {
  "src/app/layout.tsx": "55277f4839bf93cc814f1ea49c666fdc8b786b80",
  "src/app/play/BattleView.tsx": "262fa96ccf79c59027d19b9b2baf404f9bbc5e7c",
  "src/components/CardView.tsx": "f148ebeec0576f60adf2d004055ec6707dc34df1",
  "src/components/game/ArenaIdentity.tsx": "6cf2a95b90f6fa49ed3ebd6b90938e07f1368cbb",
  "src/app/styles/visual-3-0-battlefield-cinematic.css": "3bf86d3b3729265db77b7ec8c92f58ae8a6bb04b",
  "src/app/styles/visual-3-1-card-presentation.css": "d5e6cafb58ce0aa759d249d2332b7753294042bd",
  "src/app/styles/visual-3-2-meta-world.css": "7c521b595c2614ad6914c8648815fe9c1c34a102",
};

function gitBlobSha(path: string): string {
  const bytes = readFileSync(path);
  const header = Buffer.from(`blob ${bytes.byteLength}\0`, "utf8");
  return createHash("sha1").update(header).update(bytes).digest("hex");
}

for (const [path, certifiedSha] of Object.entries(FROZEN_VISUAL_BLOBS)) {
  assert.equal(
    gitBlobSha(path),
    certifiedSha,
    `${path} changed after Alpha Visual Feature Freeze. Treat this as a freeze break: document why, rerun full CI/browser artifacts and update the certified blob intentionally.`,
  );
}

const layout = readFileSync("src/app/layout.tsx", "utf8");
const orderedLayers = [
  'import "./styles/visual-3-0-battlefield-cinematic.css";',
  'import "./styles/visual-3-1-card-presentation.css";',
  'import "./styles/visual-3-2-meta-world.css";',
];
let previous = -1;
for (const layer of orderedLayers) {
  const index = layout.indexOf(layer);
  assert.ok(index > previous, `certified visual layer order changed or disappeared: ${layer}`);
  previous = index;
}

const responsiveLayer = 'import "./styles/visual-4-0-responsive-battlefield.css";';
const battlefieldUxLayer = 'import "./styles/visual-4-4-battlefield-ux.css";';
const cinematicIdentityLayer = 'import "./styles/visual-5-0-cinematic-identity.css";';
const metagamePremiumLayer = 'import "./styles/visual-5-1-metagame-premium.css";';
const playerJourneyLayer = 'import "./styles/visual-5-2-player-journey.css";';
const pvpLobbyLayer = 'import "./styles/visual-5-3-pvp-lobby.css";';
const rankedCompetitiveLayer = 'import "./styles/visual-5-4-ranked-competitive.css";';
const draftPremiumLayer = 'import "./styles/visual-5-5-draft-premium.css";';
const cosmeticPrestigeLayer = 'import "./styles/visual-5-6-cosmetic-prestige.css";';
const packOpeningLayer = 'import "./styles/visual-5-7-pack-opening.css";';
const deckBuilderLayer = 'import "./styles/visual-5-8-deck-builder.css";';
const brandIdentityLayer = 'import "./styles/brand-identity-1-0.css";';
const productIdentityLayer = 'import "./styles/brand-identity-1-1-product.css";';

const requiredLayers = [
  responsiveLayer,
  battlefieldUxLayer,
  cinematicIdentityLayer,
  metagamePremiumLayer,
  playerJourneyLayer,
  pvpLobbyLayer,
  rankedCompetitiveLayer,
  draftPremiumLayer,
  cosmeticPrestigeLayer,
  packOpeningLayer,
  deckBuilderLayer,
  brandIdentityLayer,
  productIdentityLayer,
];
for (const layer of requiredLayers) {
  assert.ok(layout.includes(layer), `certified visual layer must stay mounted: ${layer}`);
}

const orderedPresentationLayers = [
  responsiveLayer,
  battlefieldUxLayer,
  cinematicIdentityLayer,
  metagamePremiumLayer,
  playerJourneyLayer,
  pvpLobbyLayer,
  rankedCompetitiveLayer,
  draftPremiumLayer,
  cosmeticPrestigeLayer,
  packOpeningLayer,
  deckBuilderLayer,
  brandIdentityLayer,
  productIdentityLayer,
];
previous = -1;
for (const layer of orderedPresentationLayers) {
  const index = layout.indexOf(layer);
  assert.ok(index > previous, `presentation layer order changed: ${layer}`);
  previous = index;
}

assert.equal(
  /visual-3-[3-9][^\n]*\.css/.test(layout),
  false,
  "Alpha Visual Feature Freeze forbids another structural Visual 3.x pass before release; ship editorial art or use the documented break-glass process instead",
);

console.log("RUNE FORGE ALPHA VISUAL FEATURE FREEZE: 7 certified structural blobs PASS — Brand Identity 1.1 product-shell break-glass recorded");
