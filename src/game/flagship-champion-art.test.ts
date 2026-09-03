import assert from "node:assert/strict";
import { getCard } from "./cards";
import { getCardArt, replaceRegisteredCardArt } from "./card-art";
import { FLAGSHIP_CHAMPION_ART, FLAGSHIP_CHAMPION_BASE_ART } from "./flagship-champion-art";
import { FLAGSHIP_STRUCTURE_ART } from "./flagship-structure-art";

const chains = {
  ember_champion: ["ember_champion", "ember_champion_2", "ember_champion_3"],
  tide_champion: ["tide_champion", "tide_champion_2"],
  wood_champion: ["wood_champion", "wood_champion_2"],
  void_champion: ["void_champion", "void_champion_2"],
  forest_champion: ["forest_champion", "forest_champion_2"],
  storm_champion: ["storm_champion", "storm_champion_2"],
} as const;

assert.equal(Object.keys(FLAGSHIP_CHAMPION_BASE_ART).length, 6, "Batch A must keep exactly six Champion masters");

for (const [baseId, chain] of Object.entries(chains)) {
  const base = getCard(baseId);
  assert.equal(base.isChampion, true, `${baseId} must remain a Champion`);
  const expected = FLAGSHIP_CHAMPION_BASE_ART[baseId as keyof typeof FLAGSHIP_CHAMPION_BASE_ART];
  assert.ok(expected.endsWith(`/${baseId}.webp`), `${baseId} must use its region-local WebP master`);
  assert.equal(expected.includes("/images/champs/"), false, `${baseId} must not use the legacy missing Champion path`);

  for (const defId of chain) {
    const card = getCard(defId);
    assert.equal(card.isChampion, true, `${defId} must remain a Champion evolution`);
    assert.equal(FLAGSHIP_CHAMPION_ART[defId], expected, `${defId} must reuse the Alpha master for ${baseId}`);
    assert.equal(getCardArt(defId)?.url, expected, `${defId} must resolve the built-in flagship art`);
    assert.equal(card.art, expected, `${defId} must receive the flagship art through the catalog overlay`);
  }
}

assert.equal(Object.keys(FLAGSHIP_STRUCTURE_ART).length, 6, "Batch B must contain exactly six Structure masters");
for (const [defId, expected] of Object.entries(FLAGSHIP_STRUCTURE_ART)) {
  const card = getCard(defId);
  assert.equal(card.archetypeKey, "structure", `${defId} must remain a Structure`);
  assert.equal(card.type, "Artifact", `${defId} Structure must retain Artifact technical base`);
  assert.ok(expected.endsWith(`/${defId}.webp`), `${defId} must use its region-local WebP master`);
  assert.equal(getCardArt(defId)?.url, expected, `${defId} must resolve the Batch B built-in master`);
  assert.equal(card.art, expected, `${defId} must receive Batch B art through the catalog overlay`);
}

replaceRegisteredCardArt([{ defId: "ember_champion", url: "/uploads/editorial/pyra-approved.webp" }]);
assert.equal(
  getCardArt("ember_champion")?.url,
  "/uploads/editorial/pyra-approved.webp",
  "Admin/editorial art must remain higher priority than the built-in Champion fallback",
);
replaceRegisteredCardArt([{ defId: "rfalpha_ember_structure_forge_bastion", url: "/uploads/editorial/bastion-approved.webp" }]);
assert.equal(
  getCardArt("rfalpha_ember_structure_forge_bastion")?.url,
  "/uploads/editorial/bastion-approved.webp",
  "Admin/editorial art must remain higher priority than the built-in Structure fallback",
);
replaceRegisteredCardArt([]);
assert.equal(getCardArt("ember_champion")?.url, FLAGSHIP_CHAMPION_BASE_ART.ember_champion, "clearing editorial art must restore the Champion master");
assert.equal(
  getCardArt("rfalpha_ember_structure_forge_bastion")?.url,
  FLAGSHIP_STRUCTURE_ART.rfalpha_ember_structure_forge_bastion,
  "clearing editorial art must restore the Structure master",
);

console.log("FLAGSHIP ART BATCHES A+B — CHAMPION + STRUCTURE RUNTIME CONTRACT: PASS");
