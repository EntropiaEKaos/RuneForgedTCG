import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const game = ["GameClient.tsx","BattleView.tsx","MulliganView.tsx","hooks/useGamePresentation.ts","hooks/useMatchLauncher.ts","hooks/useMatchLifecycle.ts"].map((f) => readFileSync(`src/app/play/${f}`, "utf8")).join("\n");
const css = ["globals.css","styles/tcg-visual.css","styles/site-polish.css","styles/studio.css","styles/arena-regions.css","styles/gameplay-extensions.css"].map((f) => readFileSync(`src/app/${f}`, "utf8")).join("\n");
const gameplayBrandCss = readFileSync("src/app/styles/brand-identity-1-1-product.css", "utf8");
const matchResult = readFileSync("src/components/game/MatchResult.tsx", "utf8");
const onboarding = readFileSync("src/app/play/PlayEntryClient.tsx", "utf8");
const journey = readFileSync("src/components/game/PlayerJourney.tsx", "utf8");
const recoveryNotice = readFileSync("src/components/RecoveryKeyNotice.tsx", "utf8");
const cardView = readFileSync("src/components/CardView.tsx", "utf8");
const densityCert = readFileSync("scripts/alpha-battlefield-notebook-stress-cert.mjs", "utf8");
const sounds = readFileSync("src/lib/sounds.ts", "utf8");
const productBrand = readFileSync("src/lib/product-brand.ts", "utf8");
const pvp = readFileSync("src/lib/pvp-client.ts", "utf8");
const locale = readFileSync("src/game/client/i18n.ts", "utf8");
const publicBrandSurfaces = [
  "src/app/play/page.tsx",
  "src/app/pvp/page.tsx",
  "src/app/codex/page.tsx",
  "src/app/forge/page.tsx",
  "src/app/store/page.tsx",
  "src/app/modes/page.tsx",
  "src/app/album/page.tsx",
  "src/app/draft/page.tsx",
  "src/app/ranked/page.tsx",
  "src/app/market/page.tsx",
  "src/app/profile/page.tsx",
  "src/app/friends/page.tsx",
  "src/app/leaderboard/page.tsx",
  "src/app/collection/page.tsx",
  "src/app/collections/page.tsx",
  "src/app/community/page.tsx",
  "src/app/replay/[id]/page.tsx",
  "src/app/replays/[id]/page.tsx",
  "src/app/admin/page.tsx",
  "src/app/admin/studio/page.tsx",
  "src/components/RecoveryKeyNotice.tsx",
].map((path) => readFileSync(path, "utf8")).join("\n");

for (const component of ["ReactionStack", "MatchResult", "PlayerHand", "CombatOutcomePreview", "GameSettings", "TutorialChecklist", "PvpStatus"]) {
  assert.ok(game.includes(`<${component}`), `${component} must be integrated into the match client`);
}
assert.ok(css.includes("CLIENT EVOLUTION 2.37–2.42"));
assert.ok(css.includes(".mobile-hand-toggle") && css.includes("env(safe-area-inset-bottom)"));
assert.ok(css.includes('data-fx="reduced"') && css.includes('data-ui-scale="compact"'));
assert.ok(sounds.includes("syncAmbience") && sounds.includes("setMasterVolume"));
assert.ok(
  sounds.includes("BRAND_STORAGE_KEYS")
    && sounds.includes("LEGACY_BRAND_STORAGE_KEYS")
    && sounds.includes("readMigratedLocalSetting")
    && sounds.includes("BRAND_STORAGE_KEYS.music")
    && sounds.includes("LEGACY_BRAND_STORAGE_KEYS.music"),
  "audio preferences must use the branded storage contract with legacy migration",
);
assert.ok(
  productBrand.includes('storagePrefix: "forged"')
    && productBrand.includes('legacyStoragePrefix: "runeforge"')
    && productBrand.includes("readMigratedLocalSetting")
    && productBrand.includes("writeMirroredLocalSetting")
    && productBrand.includes("storage.setItem(key, legacy)"),
  "brand migration must preserve RuneForge-era local preferences while copying them forward",
);
assert.ok(
  gameplayBrandCss.includes("BRAND IDENTITY 1.2 — GAMEPLAY SHELL")
    && gameplayBrandCss.includes(".tcg-match-brand")
    && gameplayBrandCss.includes("content: 'FORGED'")
    && gameplayBrandCss.includes("content: 'THE CONVERGENCE'")
    && gameplayBrandCss.includes(".match-result-seal strong"),
  "Brand 1.2 must extend the candidate identity into the frozen gameplay shell through presentation only",
);
assert.ok(
  matchResult.includes("PRODUCT_BRAND.fullName")
    && onboarding.includes("PRODUCT_BRAND.displayName")
    && journey.includes("BRAND_STORAGE_KEYS.journeyProgress")
    && journey.includes("LEGACY_BRAND_STORAGE_KEYS.journeyProgress"),
  "player-facing gameplay journey must use the candidate brand while preserving legacy-compatible progress",
);
assert.ok(
  publicBrandSurfaces.includes("PRODUCT_BRAND")
    && recoveryNotice.includes("forged-recovery-key.txt"),
  "Brand 1.3 public surfaces must source visible naming from PRODUCT_BRAND",
);
assert.doesNotMatch(
  publicBrandSurfaces,
  /\bRuneForge\b|\bRuneforge\b/,
  "Brand 1.3 player-facing semantic surfaces must not expose the legacy commercial name",
);
assert.ok(
  cardView.includes("data-card-art-source={artSource}")
    && cardView.includes('className="card-art absolute inset-0 bg-cover bg-center"')
    && cardView.includes("backgroundImage: artBackground")
    && cardView.includes("card-art-fallback"),
  "real CardView instances must retain art, an art-source marker and a regional fallback",
);
assert.ok(
  densityCert.includes("style.dataset.visualStressFixture='true'")
    && densityCert.includes("node.dataset.visualStressClone")
    && densityCert.includes("rf-v4-density-probe")
    && gameplayBrandCss.includes("BRAND IDENTITY 1.3 — CERTIFICATION CLARITY")
    && gameplayBrandCss.includes("content: 'STRESS'"),
  "notebook density screenshots must identify synthetic stress probes instead of resembling blank production cards",
);
assert.ok(
  densityCert.includes("async function waitForEnabledCurrentPhaseAction")
    && densityCert.indexOf("await waitForEnabledCurrentPhaseAction(cdp)") < densityCert.indexOf("const hoverTarget = await hoverRealHandCard(cdp)"),
  "notebook density certification must wait for a live current-phase action before hit-test evidence",
);
assert.ok(pvp.includes("request.actionId") && pvp.includes("response.status === 409"));
assert.ok(locale.includes("ptBR") && game.includes("PARTIDA AO VIVO"));
assert.ok(game.includes('event.key === "Escape"') && game.includes('aria-keyshortcuts="?"'));
console.log("CLIENT EXPERIENCE 2.42: PASS — Brand Identity 1.3 semantic + card-art contract certified");
