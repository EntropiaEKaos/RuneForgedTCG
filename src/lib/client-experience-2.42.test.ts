import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const game = ["GameClient.tsx","BattleView.tsx","MulliganView.tsx","hooks/useGamePresentation.ts","hooks/useMatchLauncher.ts","hooks/useMatchLifecycle.ts"].map((f) => readFileSync(`src/app/play/${f}`, "utf8")).join("\n");
const css = ["globals.css","styles/tcg-visual.css","styles/site-polish.css","styles/studio.css","styles/arena-regions.css","styles/gameplay-extensions.css"].map((f) => readFileSync(`src/app/${f}`, "utf8")).join("\n");
const gameplayBrandCss = readFileSync("src/app/styles/brand-identity-1-1-product.css", "utf8");
const matchResult = readFileSync("src/components/game/MatchResult.tsx", "utf8");
const onboarding = readFileSync("src/app/play/PlayEntryClient.tsx", "utf8");
const journey = readFileSync("src/components/game/PlayerJourney.tsx", "utf8");
const sounds = readFileSync("src/lib/sounds.ts", "utf8");
const productBrand = readFileSync("src/lib/product-brand.ts", "utf8");
const pvp = readFileSync("src/lib/pvp-client.ts", "utf8");
const locale = readFileSync("src/game/client/i18n.ts", "utf8");

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
assert.ok(pvp.includes("request.actionId") && pvp.includes("response.status === 409"));
assert.ok(locale.includes("ptBR") && game.includes("PARTIDA AO VIVO"));
assert.ok(game.includes('event.key === "Escape"') && game.includes('aria-keyshortcuts="?"'));
console.log("CLIENT EXPERIENCE 2.42: PASS — Brand Identity 1.2 gameplay shell certified");
