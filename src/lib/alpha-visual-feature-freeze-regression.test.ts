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
 *
 * FORGED Client 1.0 break-glass 2026-09-15: layout.tsx is intentionally
 * recertified to mount client-shell-1-0.css after the certified product identity
 * layer. This changes only meta/application chrome: persistent client topbar,
 * desktop rail and responsive bottom dock. BattleView.tsx, CardView.tsx,
 * ArenaIdentity.tsx, engine/rules/APIs/persistence and Ranked authority remain
 * frozen. Full CI, notebook/mobile browser certificates and the complete Alpha
 * Visual Journey are mandatory before this client-shell candidate is promoted.
 *
 * Frames & Rarity Runtime break-glass 2026-09-18: CardView.tsx is intentionally\n * recertified to consume the already-certified cardRarityPresentationContract.\n * This exposes rarity id/rank/FX semantics and shared ornament classes on the\n * live card while leaving CardDef rarity, gameplay stats/rules, ownership, pack\n * probability and economy authority unchanged. Full CI/browser evidence is\n * mandatory before promotion.\n *\n * Battlefield Premium 1.6 break-glass 2026-09-17: layout.tsx is intentionally
 * recertified only to mount forged-battlefield-premium-1-6.css immediately after
 * the certified Visual 4.4 battlefield UX layer. This is a presentation-only CSS
 * layer; BattleView.tsx, CardView.tsx, ArenaIdentity.tsx, engine/rules/APIs/state
 * authority and the frozen Visual 3.x structural layers remain unchanged. Full
 * CI/browser artifacts and representative battlefield visual inspection are
 * mandatory before this candidate can be promoted.
 */
const FROZEN_VISUAL_BLOBS: Record<string, string> = {
  "src/app/layout.tsx": "b493e6b387d741db8ba168501183d3d0e379b7e1",
  "src/app/play/BattleView.tsx": "262fa96ccf79c59027d19b9b2baf404f9bbc5e7c",
  "src/components/CardView.tsx": "edd582233b063110d7ca07028b83229236a74553",
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
const battlefieldPremiumLayer = 'import "./styles/forged-battlefield-premium-1-6.css";';
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
const clientShellLayer = 'import "./styles/client-shell-1-0.css";';

const requiredLayers = [
  responsiveLayer,
  battlefieldUxLayer,
  battlefieldPremiumLayer,
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
  clientShellLayer,
];
for (const layer of requiredLayers) {
  assert.ok(layout.includes(layer), `certified visual layer must stay mounted: ${layer}`);
}

const orderedPresentationLayers = [
  responsiveLayer,
  battlefieldUxLayer,
  battlefieldPremiumLayer,
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
  clientShellLayer,
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

console.log("FORGED ALPHA VISUAL FEATURE FREEZE: 7 certified structural blobs PASS — Frames & Rarity Runtime break-glass recorded");
