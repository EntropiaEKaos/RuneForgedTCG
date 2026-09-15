import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const page = fs.readFileSync(path.join(root, "src/app/play/page.tsx"), "utf8");
const entry = fs.readFileSync(path.join(root, "src/app/play/PlayEntryClient.tsx"), "utf8");
const session = fs.readFileSync(path.join(root, "src/lib/client-player-session.ts"), "utf8");
const presentation = fs.readFileSync(path.join(root, "src/app/play/hooks/useGamePresentation.ts"), "utf8");
const productBrand = fs.readFileSync(path.join(root, "src/lib/product-brand.ts"), "utf8");
const journey = fs.readFileSync(path.join(root, "src/components/game/PlayerJourney.tsx"), "utf8");

assert.match(page, /PlayEntryClient/);
assert.match(entry, /createGuestPlayerSession/);
assert.doesNotMatch(entry, /ensurePlayerSession/, "player entry must not mint a Guest through legacy ensure semantics");
assert.match(session, /export async function createGuestPlayerSession\(\)/);
assert.match(session, /if \(!current\.ok\) return json\(current\);/, "session ensure must fail closed when no player session exists");
assert.match(entry, /shouldShowAlphaOnboarding/);
assert.match(entry, /runeforge_ai_difficulty/);
assert.match(entry, /ALPHA_FIRST_MATCH_DIFFICULTY/);
assert.match(entry, /COMEÇAR TREINAMENTO/);
assert.match(entry, /\/profile/);
assert.match(presentation, /readMigratedLocalSetting/);
assert.match(presentation, /BRAND_STORAGE_KEYS\.firstMatchGuide/);
assert.match(presentation, /LEGACY_BRAND_STORAGE_KEYS\.firstMatchGuide/);
assert.match(presentation, /runeforge_training_checklist/);
assert.match(presentation, /runeforge_ai_difficulty/);
assert.match(productBrand, /firstMatchGuide/);
assert.match(productBrand, /journeyProgress/);
assert.match(productBrand, /writeMirroredLocalSetting/);
assert.match(journey, /writeMirroredLocalSetting/);
assert.match(journey, /BRAND_STORAGE_KEYS\.journeyProgress/);
assert.match(journey, /LEGACY_BRAND_STORAGE_KEYS\.journeyProgress/);
assert.doesNotMatch(entry, /recoveryCode\s*[=:].*text/i, "first-run screen must not render the recovery secret directly");

console.log("ALPHA FIRST-RUN ONBOARDING SOURCE CONTRACT: PASS — explicit Guest creation + Brand 1.2 candidate storage remain certified");
