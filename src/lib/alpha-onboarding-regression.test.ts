import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const page = fs.readFileSync(path.join(root, "src/app/play/page.tsx"), "utf8");
const entry = fs.readFileSync(path.join(root, "src/app/play/PlayEntryClient.tsx"), "utf8");
const presentation = fs.readFileSync(path.join(root, "src/app/play/hooks/useGamePresentation.ts"), "utf8");

assert.match(page, /PlayEntryClient/);
assert.match(entry, /ensurePlayerSession/);
assert.match(entry, /shouldShowAlphaOnboarding/);
assert.match(entry, /runeforge_ai_difficulty/);
assert.match(entry, /ALPHA_FIRST_MATCH_DIFFICULTY/);
assert.match(entry, /COMEÇAR TREINAMENTO/);
assert.match(entry, /\/profile/);
assert.match(presentation, /runeforge_first_match_guide/);
assert.match(presentation, /runeforge_training_checklist/);
assert.match(presentation, /runeforge_ai_difficulty/);
assert.doesNotMatch(entry, /recoveryCode\s*[=:].*text/i, "first-run screen must not render the recovery secret directly");

console.log("ALPHA FIRST-RUN ONBOARDING SOURCE CONTRACT: PASS");
