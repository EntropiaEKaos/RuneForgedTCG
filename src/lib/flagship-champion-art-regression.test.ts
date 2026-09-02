import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const generator = readFileSync("scripts/generate-flagship-champion-art.mjs", "utf8");
const artRegistry = readFileSync("src/game/flagship-champion-art.ts", "utf8");
const cardArt = readFileSync("src/game/card-art.ts", "utf8");

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
  assert.ok(generator.includes(contract), `Champion generator must preserve ${contract}`);
}

for (const [region, defId] of [
  ["emberhold", "ember_champion"],
  ["tidecall", "tide_champion"],
  ["ironwood", "wood_champion"],
  ["voidborn", "void_champion"],
  ["florestia", "forest_champion"],
  ["tempestade", "storm_champion"],
]) {
  assert.ok(generator.includes(`defId: "${defId}"`), `${defId} generator source missing`);
  assert.ok(generator.includes(`region: "${region}"`), `${region} generator identity missing`);
  assert.ok(artRegistry.includes(`/art/cards/flagship/${region}/${defId}.webp`), `${defId} runtime path missing`);
}

for (const evolution of [
  "ember_champion_2", "ember_champion_3",
  "tide_champion_2", "wood_champion_2", "void_champion_2", "forest_champion_2", "storm_champion_2",
]) {
  assert.ok(artRegistry.includes(`${evolution}:`), `${evolution} must reuse its regional Alpha Champion master`);
}

assert.ok(cardArt.includes("flagshipChampionArtUrl"), "Card art pipeline must reference the built-in flagship resolver");
assert.ok(cardArt.includes("flagship-champion-art"), "Card art pipeline must load the flagship Champion registry");
assert.ok(cardArt.includes("const editorial = browserArt[defId] ?? getCustomCardArtCached(defId);"), "editorial/admin art must remain first priority");
assert.ok(cardArt.includes("const flagshipUrl = flagshipChampionArtUrl(defId);"), "built-in flagship fallback missing");
assert.ok(cardArt.indexOf("const editorial") < cardArt.indexOf("const flagshipUrl"), "flagship art must never override explicit editorial art");

for (const forbidden of [
  "src/app/play/BattleView.tsx",
  "src/components/CardView.tsx",
  "visual-3-0-battlefield-cinematic.css",
  "visual-3-1-card-presentation.css",
  "visual-3-2-meta-world.css",
]) {
  assert.equal(generator.includes(forbidden), false, `Batch A generator must not mutate frozen surface ${forbidden}`);
}

console.log("FLAGSHIP ART BATCH A — SOURCE CONTRACT: PASS");
