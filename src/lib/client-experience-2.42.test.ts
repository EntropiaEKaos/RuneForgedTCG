import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const game = ["GameClient.tsx","BattleView.tsx","MulliganView.tsx","hooks/useGamePresentation.ts","hooks/useMatchLauncher.ts","hooks/useMatchLifecycle.ts"].map((f) => readFileSync(`src/app/play/${f}`, "utf8")).join("\n");
const css = ["globals.css","styles/tcg-visual.css","styles/site-polish.css","styles/studio.css","styles/arena-regions.css","styles/gameplay-extensions.css"].map((f) => readFileSync(`src/app/${f}`, "utf8")).join("\n");
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
    && productBrand.includes("storage.setItem(key, legacy)"),
  "brand migration must preserve RuneForge-era local preferences while copying them forward",
);
assert.ok(pvp.includes("request.actionId") && pvp.includes("response.status === 409"));
assert.ok(locale.includes("ptBR") && game.includes("PARTIDA AO VIVO"));
assert.ok(game.includes('event.key === "Escape"') && game.includes('aria-keyshortcuts="?"'));
console.log("CLIENT EXPERIENCE 2.42: PASS");
