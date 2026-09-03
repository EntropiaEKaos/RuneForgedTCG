import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const championGenerator = readFileSync("scripts/generate-flagship-champion-art.mjs", "utf8");
const structureGenerator = readFileSync("scripts/generate-flagship-structure-art.mjs", "utf8");
const ritualGenerator = readFileSync("scripts/generate-flagship-ritual-art.mjs", "utf8");
const structureBrowser = readFileSync("scripts/alpha-flagship-structures-browser-cert.mjs", "utf8");
const ritualBrowser = readFileSync("scripts/alpha-flagship-rituals-browser-cert.mjs", "utf8");
const structureWorkflow = readFileSync(".github/workflows/flagship-structures.yml", "utf8");
const ritualWorkflow = readFileSync(".github/workflows/flagship-rituals.yml", "utf8");
const championRegistry = readFileSync("src/game/flagship-champion-art.ts", "utf8");
const structureRegistry = readFileSync("src/game/flagship-structure-art.ts", "utf8");
const ritualRegistry = readFileSync("src/game/flagship-ritual-art.ts", "utf8");
const cardArt = readFileSync("src/game/card-art.ts", "utf8");
const nextConfig = readFileSync("next.config.ts", "utf8");

assert.equal(pkg.scripts["flagship:art:champions"], "node scripts/generate-flagship-champion-art.mjs");
assert.equal(pkg.scripts.predev, "npm run flagship:art:champions", "dev must generate flagship Champion assets before Next starts");
assert.equal(pkg.scripts.prebuild, "npm run flagship:art:champions", "production build must generate flagship Champion assets before Next builds");

for (const contract of [
  "const WIDTH = 1536",
  "const HEIGHT = 1920",
  ".webp({ quality: 88",
  "public/art/cards/flagship/",
  "FLAGSHIP CHAMPION ART: generated",
]) {
  assert.ok(championGenerator.includes(contract), `Champion generator must preserve ${contract}`);
}

for (const [region, defId] of [
  ["emberhold", "ember_champion"],
  ["tidecall", "tide_champion"],
  ["ironwood", "wood_champion"],
  ["voidborn", "void_champion"],
  ["florestia", "forest_champion"],
  ["tempestade", "storm_champion"],
]) {
  assert.ok(championGenerator.includes(`defId: "${defId}"`), `${defId} generator source missing`);
  assert.ok(championGenerator.includes(`region: "${region}"`), `${region} generator identity missing`);
  assert.ok(championRegistry.includes(`/art/cards/flagship/${region}/${defId}.webp`), `${defId} runtime path missing`);
}

for (const evolution of [
  "ember_champion_2", "ember_champion_3",
  "tide_champion_2", "wood_champion_2", "void_champion_2", "forest_champion_2", "storm_champion_2",
]) {
  assert.ok(championRegistry.includes(`${evolution}:`), `${evolution} must reuse its regional Alpha Champion master`);
}

const structureTargets = [
  ["emberhold", "rfalpha_ember_structure_forge_bastion", "11a-structure-emberhold-art-viewer.png"],
  ["tidecall", "rfalpha_tide_structure_silent_beacon", "11b-structure-tidecall-art-viewer.png"],
  ["ironwood", "rfalpha_wood_structure_root_circle", "11c-structure-ironwood-art-viewer.png"],
  ["voidborn", "rfalpha_void_structure_hollow_obelisk", "11d-structure-voidborn-art-viewer.png"],
  ["florestia", "rfalpha_forest_structure_ancestral_den", "11e-structure-florestia-art-viewer.png"],
  ["tempestade", "rfalpha_storm_structure_first_thunder", "11f-structure-tempestade-art-viewer.png"],
] as const;

for (const contract of [
  "const WIDTH = 1536",
  "const HEIGHT = 1920",
  ".webp({ quality: 88",
  "public/art/cards/flagship/",
  "FLAGSHIP STRUCTURE ART: generated",
]) {
  assert.ok(structureGenerator.includes(contract), `Structure generator must preserve ${contract}`);
}

for (const [region, defId, screenshot] of structureTargets) {
  assert.ok(structureGenerator.includes(`defId: "${defId}"`), `${defId} Structure generator source missing`);
  assert.ok(structureGenerator.includes(`region: "${region}"`), `${region} Structure generator identity missing`);
  assert.ok(structureRegistry.includes(`/art/cards/flagship/${region}/${defId}.webp`), `${defId} Structure runtime path missing`);
  assert.ok(structureBrowser.includes(defId), `${defId} must be certified in browser`);
  assert.ok(structureBrowser.includes(screenshot), `${defId} browser screenshot contract missing: ${screenshot}`);
}

for (const browserContract of [
  "data-card-art-source",
  "regional-fallback",
  "data-card-art-viewer-trigger",
  "data-card-art-viewer-image",
  'backgroundSize, "contain"',
  "FLAGSHIP ART BATCH B BROWSER CERT: PASS",
]) {
  assert.ok(structureBrowser.includes(browserContract), `Structure browser certification must preserve ${browserContract}`);
}

assert.ok(structureWorkflow.includes("node scripts/alpha-flagship-structures-browser-cert.mjs"), "dedicated workflow must execute Structure browser certification");
assert.ok(structureWorkflow.includes("artifacts/alpha-visual/11*-structure-*-art-viewer.png"), "dedicated workflow must upload all six Structure screenshots");
assert.ok(structureWorkflow.includes("npm run build"), "dedicated Structure visual workflow must certify production build output");

const ritualTargets = [
  ["emberhold", "rfalpha_ember_ritual_red_rite", "12a-ritual-emberhold-art-viewer.png"],
  ["tidecall", "rfalpha_tide_ritual_memory_tide", "12b-ritual-tidecall-art-viewer.png"],
  ["ironwood", "rfalpha_wood_ritual_ancient_roots", "12c-ritual-ironwood-art-viewer.png"],
  ["voidborn", "rfalpha_void_ritual_emptiness", "12d-ritual-voidborn-art-viewer.png"],
  ["florestia", "rfalpha_forest_ritual_green_moon", "12e-ritual-florestia-art-viewer.png"],
  ["tempestade", "rfalpha_storm_ritual_eye_of_storm", "12f-ritual-tempestade-art-viewer.png"],
] as const;

for (const contract of [
  "const WIDTH = 1536",
  "const HEIGHT = 1920",
  ".webp({ quality: 88",
  "public/art/cards/flagship/",
  "FLAGSHIP RITUAL ART: generated",
]) {
  assert.ok(ritualGenerator.includes(contract), `Ritual generator must preserve ${contract}`);
}

for (const [region, defId, screenshot] of ritualTargets) {
  assert.ok(ritualGenerator.includes(`defId: "${defId}"`), `${defId} Ritual generator source missing`);
  assert.ok(ritualGenerator.includes(`region: "${region}"`), `${region} Ritual generator identity missing`);
  assert.ok(ritualRegistry.includes(`/art/cards/flagship/${region}/${defId}.webp`), `${defId} Ritual runtime path missing`);
  assert.ok(ritualBrowser.includes(defId), `${defId} must be certified in browser`);
  assert.ok(ritualBrowser.includes(screenshot), `${defId} browser screenshot contract missing: ${screenshot}`);
}

for (const browserContract of [
  "data-card-art-source",
  "regional-fallback",
  "data-card-art-viewer-trigger",
  "data-card-art-viewer-image",
  'backgroundSize, "contain"',
  "FLAGSHIP ART BATCH C BROWSER CERT: PASS",
]) {
  assert.ok(ritualBrowser.includes(browserContract), `Mana Ritual browser certification must preserve ${browserContract}`);
}

assert.ok(ritualWorkflow.includes("node scripts/alpha-flagship-rituals-browser-cert.mjs"), "dedicated workflow must execute Mana Ritual browser certification");
assert.ok(ritualWorkflow.includes("artifacts/alpha-visual/12*-ritual-*-art-viewer.png"), "dedicated workflow must upload all six Mana Ritual screenshots");
assert.ok(ritualWorkflow.includes("npm run build"), "dedicated Mana Ritual visual workflow must certify production build output");

assert.ok(nextConfig.includes('"scripts/generate-flagship-structure-art.mjs"'), "Next bootstrap must retain Batch B Structure generation");
assert.ok(nextConfig.includes('"scripts/generate-flagship-ritual-art.mjs"'), "Next bootstrap must materialize Batch C Mana Ritual WebPs");
assert.ok(nextConfig.includes("execFileSync(process.execPath, [script]"), "Next bootstrap must execute the semantic Flagship asset generators");

assert.ok(cardArt.includes("flagshipChampionArtUrl"), "Card art pipeline must retain the built-in Champion resolver");
assert.ok(cardArt.includes("flagshipStructureArtUrl"), "Card art pipeline must retain the Batch B Structure resolver");
assert.ok(cardArt.includes("flagshipRitualArtUrl"), "Card art pipeline must load the Batch C Mana Ritual resolver");
assert.ok(cardArt.includes("flagship-ritual-art"), "Card art pipeline must import the Mana Ritual registry");
assert.ok(cardArt.includes("const editorial = browserArt[defId] ?? getCustomCardArtCached(defId);"), "editorial/admin art must remain first priority");
assert.ok(cardArt.includes("flagshipChampionArtUrl(defId) ?? flagshipStructureArtUrl(defId) ?? flagshipRitualArtUrl(defId)"), "built-in Flagship fallback chain missing Batch C");
assert.ok(cardArt.indexOf("const editorial") < cardArt.indexOf("const flagshipUrl"), "built-in Flagship art must never override explicit editorial art");

for (const source of [championGenerator, structureGenerator, ritualGenerator, structureBrowser, ritualBrowser, structureWorkflow, ritualWorkflow]) {
  for (const forbidden of [
    "src/app/play/BattleView.tsx",
    "src/components/CardView.tsx",
    "visual-3-0-battlefield-cinematic.css",
    "visual-3-1-card-presentation.css",
    "visual-3-2-meta-world.css",
  ]) {
    assert.equal(source.includes(forbidden), false, `Flagship Batch C tooling must not mutate frozen surface ${forbidden}`);
  }
}

console.log("FLAGSHIP ART BATCHES A+B+C — SOURCE CONTRACT: PASS");
