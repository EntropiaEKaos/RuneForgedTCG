import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

const shared = read("src/app/admin/studio/AbilityComposerFields.tsx");
const activated = read("src/app/admin/studio/cards/ActivatedAbilityEditor.tsx");
const mechanics = read("src/app/admin/studio/mechanics/MechanicsStudio.tsx");

assert.match(shared, /CARD_EFFECT_CONTRACTS/, "shared composer must use canonical semantic effect contracts");
assert.match(shared, /export function StudioEffectEditor/, "shared effect composer is exported");
assert.match(shared, /export function StudioConditionEditor/, "shared condition composer is exported");
assert.match(shared, /export function StudioAbilityCostEditor/, "shared cost composer is exported");
assert.match(shared, /ABILITY_GRAMMAR_CATALOG/, "shared composer surfaces Ability System 2.0 readiness");
assert.match(shared, /availableEffectKinds/, "shared composer derives authorable effects from target capability");

assert.match(activated, /from "\.\.\/AbilityComposerFields"/, "activated abilities consume the shared composer");
assert.match(activated, /StudioAbilityCostEditor/, "activated abilities share the canonical cost editor");
assert.match(activated, /StudioEffectEditor/, "activated abilities share the canonical effect editor");
assert.match(activated, /blockedTargets=\{\["spellOnStack"\]\}/, "activated authoring blocks stack-only reaction targeting before draft creation");

assert.match(mechanics, /from "\.\.\/AbilityComposerFields"/, "Mechanics Studio consumes the shared composer");
assert.match(mechanics, /StudioConditionEditor/, "Mechanics Studio shares the canonical condition editor");
assert.match(mechanics, /StudioEffectEditor/, "Mechanics Studio shares the canonical effect editor");
assert.doesNotMatch(mechanics, /CARD_TARGETS/, "Mechanics Studio must not expose an unrestricted target list");
assert.doesNotMatch(mechanics, /function Effect\(/, "Mechanics Studio must not keep a parallel effect editor");
assert.doesNotMatch(mechanics, /function ConditionEditor\(/, "Mechanics Studio must not keep a parallel condition editor");

console.log("STUDIO ABILITY COMPOSER REGRESSION: PASS — activated abilities and Mechanics Studio share canonical semantic authoring fields");
