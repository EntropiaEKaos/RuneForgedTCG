import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

const shared = read("src/app/admin/studio/AbilityComposerFields.tsx");
const activated = read("src/app/admin/studio/cards/ActivatedAbilityEditor.tsx");
const cardRules = read("src/app/admin/studio/cards/CardRulesTab.tsx");
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
assert.match(activated, /data-activated-modal=\{modal \? "true" : "false"\}/, "activated composer exposes deterministic modal state for browser certification");
assert.match(activated, /data-studio-modal-choices="true"/, "modal choices have a dedicated certified authoring surface");
assert.match(activated, /data-studio-modal-mode=\{mode\.id\}/, "each modal choice is keyed and identified by its stable mode id");
assert.match(activated, /function nextModeId\(/, "Studio derives new stable mode identifiers independently of display descriptions");
assert.match(activated, /`mode-\$\{index\}`/, "generated modal ids use the stable mode-N namespace");
assert.match(activated, /Custo compartilhado/, "Studio explicitly communicates shared base cost semantics");
assert.match(activated, /Usos \/ rodada \(compartilhados\)/, "Studio explicitly communicates shared usage-budget semantics");
assert.match(activated, /Mode ID/, "Studio displays the replay/wire identifier to designers");
assert.doesNotMatch(activated, /onChange=.*mode\.id/, "stable mode IDs are display-only after creation and are not silently rewritten from UI text");

assert.match(cardRules, /from "\.\.\/AbilityComposerFields"/, "Card Rules consumes the shared composer");
assert.equal((cardRules.match(/<StudioEffectEditor/g) ?? []).length, 3, "Sentinela, Spell and Trigger must each use the canonical semantic effect editor");
assert.doesNotMatch(cardRules, /\bEffectEditor\b/, "Card Rules must not keep the legacy parallel effect editor");
assert.doesNotMatch(cardRules, /CARD_EFFECT_KINDS as EFFECT_KINDS/, "Card Rules must not keep a parallel primitive selector");
assert.doesNotMatch(cardRules, /Efeito \(kind\)/, "Sentinela must not duplicate primitive selection outside the semantic composer");

assert.match(mechanics, /from "\.\.\/AbilityComposerFields"/, "Mechanics Studio consumes the shared composer");
assert.match(mechanics, /StudioConditionEditor/, "Mechanics Studio shares the canonical condition editor");
assert.match(mechanics, /StudioEffectEditor/, "Mechanics Studio shares the canonical effect editor");
assert.doesNotMatch(mechanics, /CARD_TARGETS/, "Mechanics Studio must not expose an unrestricted target list");
assert.doesNotMatch(mechanics, /function Effect\(/, "Mechanics Studio must not keep a parallel effect editor");
assert.doesNotMatch(mechanics, /function ConditionEditor\(/, "Mechanics Studio must not keep a parallel condition editor");

console.log("STUDIO ABILITY COMPOSER REGRESSION: PASS — shared semantic composer plus stable modal authoring contract certified");
