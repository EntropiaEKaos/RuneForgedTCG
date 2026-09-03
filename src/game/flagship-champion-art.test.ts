import assert from "node:assert/strict";
import { getCard } from "./cards";
import { getCardArt, replaceRegisteredCardArt } from "./card-art";
import { FLAGSHIP_CHAMPION_ART, FLAGSHIP_CHAMPION_BASE_ART } from "./flagship-champion-art";
import { FLAGSHIP_STRUCTURE_ART } from "./flagship-structure-art";
import { FLAGSHIP_RITUAL_ART } from "./flagship-ritual-art";
import { FLAGSHIP_TRAP_ART } from "./flagship-trap-art";
import { FLAGSHIP_SIGNATURE_ART } from "./flagship-signature-art";

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

assert.equal(Object.keys(FLAGSHIP_RITUAL_ART).length, 6, "Batch C must contain exactly six Mana Ritual masters");
for (const [defId, expected] of Object.entries(FLAGSHIP_RITUAL_ART)) {
  const card = getCard(defId);
  assert.equal(card.archetypeKey, "ritual", `${defId} must remain a Ritual`);
  assert.equal(card.type, "Spell", `${defId} Ritual must retain Spell technical base`);
  assert.equal(card.spell?.kind, "manaRefund", `${defId} must remain a Mana Ritual`);
  assert.ok(expected.endsWith(`/${defId}.webp`), `${defId} must use its region-local WebP master`);
  assert.equal(getCardArt(defId)?.url, expected, `${defId} must resolve the Batch C built-in master`);
  assert.equal(card.art, expected, `${defId} must receive Batch C art through the catalog overlay`);
}

assert.equal(Object.keys(FLAGSHIP_TRAP_ART).length, 6, "Batch D must contain exactly six Trap masters");
for (const [defId, expected] of Object.entries(FLAGSHIP_TRAP_ART)) {
  const card = getCard(defId);
  assert.equal(card.archetypeKey, "trap", `${defId} must remain a Trap`);
  assert.equal(card.type, "Spell", `${defId} Trap must retain Spell technical base`);
  assert.ok(expected.endsWith(`/${defId}.webp`), `${defId} must use its region-local WebP master`);
  assert.equal(getCardArt(defId)?.url, expected, `${defId} must resolve the Batch D built-in master`);
  assert.equal(card.art, expected, `${defId} must receive Batch D art through the catalog overlay`);
}

assert.equal(Object.keys(FLAGSHIP_SIGNATURE_ART).length, 6, "Batch E must contain exactly six starter signature masters");
for (const [defId, expected] of Object.entries(FLAGSHIP_SIGNATURE_ART)) {
  const card = getCard(defId);
  assert.equal(card.type, "Unit", `${defId} starter signature must remain a Unit`);
  assert.ok(expected.endsWith(`/${defId}.webp`), `${defId} must use its region-local WebP master`);
  assert.equal(getCardArt(defId)?.url, expected, `${defId} must resolve the Batch E built-in master`);
  assert.equal(card.art, expected, `${defId} must receive Batch E art through the catalog overlay`);
}

const editorialChecks = [
  ["ember_champion", "/uploads/editorial/pyra-approved.webp", FLAGSHIP_CHAMPION_BASE_ART.ember_champion, "Champion"],
  ["rfalpha_ember_structure_forge_bastion", "/uploads/editorial/bastion-approved.webp", FLAGSHIP_STRUCTURE_ART.rfalpha_ember_structure_forge_bastion, "Structure"],
  ["rfalpha_ember_ritual_red_rite", "/uploads/editorial/red-rite-approved.webp", FLAGSHIP_RITUAL_ART.rfalpha_ember_ritual_red_rite, "Ritual"],
  ["rfalpha_ember_trap_ash_snare", "/uploads/editorial/ash-snare-approved.webp", FLAGSHIP_TRAP_ART.rfalpha_ember_trap_ash_snare, "Trap"],
  ["ember_ashguard", "/uploads/editorial/ashguard-approved.webp", FLAGSHIP_SIGNATURE_ART.ember_ashguard, "starter signature"],
] as const;

for (const [defId, editorialUrl, builtInUrl, label] of editorialChecks) {
  replaceRegisteredCardArt([{ defId, url: editorialUrl }]);
  assert.equal(getCardArt(defId)?.url, editorialUrl, `Admin/editorial art must remain higher priority than built-in ${label} art`);
  replaceRegisteredCardArt([]);
  assert.equal(getCardArt(defId)?.url, builtInUrl, `clearing editorial art must restore the built-in ${label} master`);
}

console.log("FLAGSHIP ART BATCHES A+B+C+D+E — 30/30 MASTER RUNTIME CONTRACT: PASS");
