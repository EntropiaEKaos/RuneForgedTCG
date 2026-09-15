import assert from "node:assert/strict";
import {
  cardFramePresetCss,
  getCardFramePreset,
  normalizeCardFramePreset,
  replaceRegisteredCardFramePresets,
} from "./card-frame-presets";

const normalized = normalizeCardFramePreset({
  key: "Ember Royal",
  name: "Ember Royal",
  config: {
    primaryColor: "#ff6b21",
    secondaryColor: "#42180b",
    accentColor: "#ffe3a1",
    borderWidth: 9,
    radius: 18,
    glow: 22,
    artInset: 4,
    material: "forged",
    cornerStyle: "cut",
    ornament: "runes",
    innerLineOpacity: .4,
    nameplateOpacity: .9,
    foilIntensity: .3,
    gradientAngle: 125,
  },
});
assert.ok(normalized.value, normalized.errors.join("; "));
assert.equal(normalized.value!.key, "ember-royal");
assert.equal(normalized.value!.config.borderWidth, 6, "numeric authoring inputs are clamped");

replaceRegisteredCardFramePresets([normalized.value!]);
assert.equal(getCardFramePreset("ember-royal")?.name, "Ember Royal");

const css = cardFramePresetCss([normalized.value!]);
assert.match(css, /\.card-shell\.card-frame-ember-royal/);
assert.match(css, /border-color:#ff6b21!important/);
assert.match(css, /clip-path:polygon/);
assert.doesNotMatch(css, /javascript:|url\(/i, "frame config must not inject arbitrary URLs into runtime CSS");

const rejected = normalizeCardFramePreset({ key: "x", name: "X", config: { material: "script", cornerStyle: "round", ornament: "none" } });
assert.equal(rejected.value, null);
assert.ok(rejected.errors.some((error) => error.includes("material")));

console.log("CARD FRAME PRESETS: PASS");
