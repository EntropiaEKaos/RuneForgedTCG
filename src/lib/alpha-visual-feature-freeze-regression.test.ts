import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

/**
 * Visual Feature Freeze baseline certified by CI #632 on main SHA
 * 9fb9575831e603664070f04caea68e5c70c9e057.
 *
 * These are Git blob SHAs, not arbitrary checksums. A deliberate structural
 * visual change must update this baseline and explain the freeze break in the PR.
 * Editorial card art under /public/art/cards/flagship is intentionally outside it.
 *
 * Security break-glass 2026-09-08: layout.tsx was intentionally recertified only
 * to mount the global one-time RecoveryKeyNotice. No battlefield/card/Visual 3.x
 * structural surface changed; full CI/browser evidence is mandatory for this PR.
 *
 * Cosmetics break-glass 2026-09-13: layout.tsx and CardView.tsx are intentionally
 * recertified for the collectible printing layer. Gameplay identity, arena
 * geometry, engine/reducer/replay state and Visual 3.x structural styles remain
 * unchanged. Full CI plus browser/visual artifacts are mandatory before merge.
 *
 * Responsive battlefield break-glass 2026-09-13: layout.tsx is intentionally
 * recertified only to load Visual 4.0 as the final presentation layer. The new
 * layer bounds short notebook/tablet arenas to the viewport; engine, rules,
 * BattleView state/DOM contracts and frozen Visual 3.x files remain unchanged.
 * Full CI plus the dedicated 1366x768 browser screenshot/geometry certificate
 * are mandatory before merge.
 *
 * Battlefield UX break-glass 2026-09-14: layout.tsx is intentionally recertified
 * only to load Visual 4.4 after the responsive Visual 4.0/4.3 layer. Visual 4.4
 * reads existing phase/priority/targeting/ability/forecast presentation state;
 * it does not change engine authority, rules, BattleView DOM, or frozen Visual
 * 3.x files. Full CI, notebook density, mobile responsive and browser E2E
 * evidence remain mandatory before promotion.
 *
 * Cinematic identity break-glass 2026-09-14: layout.tsx is intentionally
 * recertified only to load Visual 5.0 after Visual 4.4. Visual 5.0 consumes the
 * existing data-deck-identity, ArenaIdentity artwork/convergence and cinematic
 * surfaces to deepen world identity. BattleView, ArenaIdentity and all frozen
 * Visual 3.x structural blobs remain byte-for-byte unchanged. Full CI and the
 * established notebook/mobile/browser evidence remain mandatory before merge.
 *
 * Metagame premium break-glass 2026-09-14: layout.tsx is intentionally
 * recertified only to load Visual 5.1 after Visual 5.0. Visual 5.1 deepens the
 * existing five certified player-facing meta destinations through presentation
 * styling only. Engine, rules, APIs, persistence, battlefield/CardView surfaces
 * and every frozen Visual 3.x structural blob remain unchanged. Full CI and the
 * established browser/visual evidence remain mandatory before promotion.
 *
 * Player journey premium break-glass 2026-09-14: layout.tsx is intentionally
 * recertified only to load Visual 5.2 after Visual 5.1. Visual 5.2 polishes the
 * already-certified Alpha journey around the battlefield: recovery handoff,
 * first-run onboarding, deck selection, mulligan, first-match briefing and match
 * result. It does not alter BattleView, arena geometry, engine/reducer authority,
 * rules, APIs, persistence or any frozen Visual 3.x structural blob. Full CI and
 * manual inspection of the Alpha Visual Journey evidence remain mandatory.
 *
 * Casual PvP lobby premium break-glass 2026-09-14: layout.tsx is intentionally
 * recertified only to load Visual 5.3 after Visual 5.2. Visual 5.3 is CSS-only
 * and styles the already-certified Casual PvP lobby through existing semantic
 * selectors. PvpClient.tsx remains byte-for-byte unchanged, including polling,
 * room lifecycle, join/leave/chat requests, authoritative redirect and DTO flow.
 * No engine, reducer, matchmaking, protocol, API or persistence authority changes.
 * Full CI and manual inspection of PvP journey screenshots 15/16 and downstream
 * 17-23 remain mandatory before promotion.
 *
 * Ranked competitive premium break-glass 2026-09-14: layout.tsx is intentionally
 * recertified only to load Visual 5.4 after Visual 5.3. Visual 5.4 is CSS-only
 * and styles the existing Ranked operational snapshot, current-rank hero, certified
 * deck decision, queue state, history, leaderboard and tier progression through
 * semantic selectors already present in RankedClient.tsx. RankedClient.tsx stays
 * byte-for-byte unchanged; matchmaking, MMR, season, release certification, pool,
 * API and PvP authority remain untouched. Full CI/browser evidence is mandatory.
 *
 * Draft premium break-glass 2026-09-14: layout.tsx is intentionally recertified
 * only to load Visual 5.5 after Visual 5.4. Visual 5.5 is CSS-only and styles the
 * existing Draft session snapshot, authoritative pick chamber, region identity,
 * progress forge, current deck tray and completion ceremony through semantic
 * selectors already present in DraftClient.tsx. DraftClient.tsx remains byte-for-byte
 * unchanged; pool generation, pick validation, copy/region constraints, persistence,
 * session identity and /api/draft authority stay untouched. Full CI/browser evidence
 * and manual inspection are mandatory before promotion.
 *
 * Cosmetic prestige break-glass 2026-09-14: layout.tsx is intentionally
 * recertified only to load Visual 5.6 after Visual 5.5. Visual 5.6 consumes the
 * already-existing collectible cosmetic registry, published pack dropWeight PPM,
 * Wardrobe and pack reveal surfaces. CardView.tsx, CardInstance, gameplay Rarity,
 * pack card-definition rolls, engine, battle state and frozen Visual 3.x structural
 * blobs remain unchanged. Cosmetic prestige is presentation-only and derives from
 * existing cosmetic odds. Full CI/browser evidence is mandatory before promotion.
 */
const FROZEN_VISUAL_BLOBS: Record<string, string> = {
  "src/app/layout.tsx": "5ad70b2bd5c104efad7c9aced6284c1e2ab92131",
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
assert.ok(layout.includes(responsiveLayer), "Visual 4.0 responsive battlefield layer must stay mounted");
assert.ok(layout.includes(battlefieldUxLayer), "Visual 4.4 battlefield UX layer must stay mounted");
assert.ok(layout.includes(cinematicIdentityLayer), "Visual 5.0 cinematic identity layer must be mounted");
assert.ok(layout.includes(metagamePremiumLayer), "Visual 5.1 metagame premium layer must be mounted");
assert.ok(layout.includes(playerJourneyLayer), "Visual 5.2 player journey premium layer must be mounted");
assert.ok(layout.includes(pvpLobbyLayer), "Visual 5.3 PvP lobby premium layer must be mounted");
assert.ok(layout.includes(rankedCompetitiveLayer), "Visual 5.4 Ranked competitive premium layer must be mounted");
assert.ok(layout.includes(draftPremiumLayer), "Visual 5.5 Draft premium layer must be mounted");
assert.ok(layout.includes(cosmeticPrestigeLayer), "Visual 5.6 cosmetic prestige layer must be mounted");
assert.ok(
  layout.indexOf(battlefieldUxLayer) > layout.indexOf(responsiveLayer),
  "Visual 4.4 battlefield UX must load after the responsive battlefield layer",
);
assert.ok(
  layout.indexOf(cinematicIdentityLayer) > layout.indexOf(battlefieldUxLayer),
  "Visual 5.0 cinematic identity must load after Visual 4.4 battlefield UX",
);
assert.ok(
  layout.indexOf(metagamePremiumLayer) > layout.indexOf(cinematicIdentityLayer),
  "Visual 5.1 metagame premium must load after Visual 5.0 cinematic identity",
);
assert.ok(
  layout.indexOf(playerJourneyLayer) > layout.indexOf(metagamePremiumLayer),
  "Visual 5.2 player journey premium must load after Visual 5.1 metagame premium",
);
assert.ok(
  layout.indexOf(pvpLobbyLayer) > layout.indexOf(playerJourneyLayer),
  "Visual 5.3 PvP lobby premium must load after Visual 5.2 player journey premium",
);
assert.ok(
  layout.indexOf(rankedCompetitiveLayer) > layout.indexOf(pvpLobbyLayer),
  "Visual 5.4 Ranked competitive premium must load after Visual 5.3 PvP lobby premium",
);
assert.ok(
  layout.indexOf(draftPremiumLayer) > layout.indexOf(rankedCompetitiveLayer),
  "Visual 5.5 Draft premium must load after Visual 5.4 Ranked competitive premium",
);
assert.ok(
  layout.indexOf(cosmeticPrestigeLayer) > layout.indexOf(draftPremiumLayer),
  "Visual 5.6 cosmetic prestige must load after Visual 5.5 Draft premium",
);

assert.equal(
  /visual-3-[3-9][^\n]*\.css/.test(layout),
  false,
  "Alpha Visual Feature Freeze forbids another structural Visual 3.x pass before release; ship editorial art or use the documented break-glass process instead",
);

console.log("RUNE FORGE ALPHA VISUAL FEATURE FREEZE: 7 certified structural blobs PASS — Visual 5.6 cosmetic prestige break-glass recorded");
