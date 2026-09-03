import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const championGenerator = readFileSync("scripts/generate-flagship-champion-art.mjs", "utf8");
const structureGenerator = readFileSync("scripts/generate-flagship-structure-art.mjs", "utf8");
const championRegistry = readFileSync("src/game/flagship-champion-art.ts", "utf8");
const structureRegistry = readFileSync("src/game/flagship-structure-art.ts", "utf8");
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

for (const contract of [
  "const WIDTH = 1536",
  "const HEIGHT = 1920",
  ".webp({ quality: 88",
  "public/art/cards/flagship/",
  "FLAGSHIP STRUCTURE ART: generated",
]) {
  assert.ok(structureGenerator.includes(contract), `Structure generator must preserve ${contract}`);
}

for (const [region, defId] of [
  ["emberhold", "rfalpha_ember_structure_forge_bastion"],
  ["tidecall", "rfalpha_tide_structure_silent_beacon"],
  ["ironwood", "rfalpha_wood_structure_root_circle"],
  ["voidborn", "rfalpha_void_structure_hollow_obelisk"],
  ["florestia", "rfalpha_forest_structure_ancestral_den"],
  ["tempestade", "rfalpha_storm_structure_first_thunder"],
]) {
  assert.ok(structureGenerator.includes(`defId: "${defId}"`), `${defId} Structure generator source missing`);
  assert.ok(structureGenerator.includes(`region: "${region}"`), `${region} Structure generator identity missing`);
  assert.ok(structureRegistry.includes(`/art/cards/flagship/${region}/${defId}.webp`), `${defId} Structure runtime path missing`);
}

assert.ok(nextConfig.includes('execFileSync(process.execPath, ["scripts/generate-flagship-structure-art.mjs"]'), "Next bootstrap must materialize Batch B Structure WebPs");
assert.ok(cardArt.includes("flagshipChampionArtUrl"), "Card art pipeline must retain the built-in Champion resolver");
assert.ok(cardArt.includes("flagshipStructureArtUrl"), "Card art pipeline must load the Batch B Structure resolver");
assert.ok(cardArt.includes("flagship-structure-art"), "Card art pipeline must import the Structure registry");
assert.ok(cardArt.includes("const editorial = browserArt[defId] ?? getCustomCardArtCached(defId);"), "editorial/admin art must remain first priority");
assert.ok(cardArt.includes("flagshipChampionArtUrl(defId) ?? flagshipStructureArtUrl(defId)"), "built-in Flagship fallback chain missing");
assert.ok(cardArt.indexOf("const editorial") < cardArt.indexOf("const flagshipUrl"), "built-in Flagship art must never override explicit editorial art");

for (const source of [championGenerator, structureGenerator]) {
  for (const forbidden of [
    "src/app/play/BattleView.tsx",
    "src/components/CardView.tsx",
    "visual-3-0-battlefield-cinematic.css",
    "visual-3-1-card-presentation.css",
    "visual-3-2-meta-world.css",
  ]) {
    assert.equal(source.includes(forbidden), false, `Flagship generator must not mutate frozen surface ${forbidden}`);
  }
}

console.log("FLAGSHIP ART BATCHES A+B — SOURCE CONTRACT: PASS");
