import assert from "node:assert/strict";
import { DECKS } from "./decks";
import { auditStarterDeck, catalogCoverage, profileDeck } from "./gameplay-profile";
import { CARDS } from "./cards";

for (const deck of DECKS) {
  const profile = profileDeck(deck.cards);
  assert.equal(profile.size, 40, `${deck.id}: profile must include every card`);
  assert.equal(profile.curve.reduce((sum, count) => sum + count, 0), 40, `${deck.id}: curve must total 40`);
  assert.ok(profile.averageCost > 0 && profile.averageCost < 10, `${deck.id}: average cost must be sensible`);
  const errors = auditStarterDeck(deck).filter((finding) => finding.severity === "error");
  assert.deepEqual(errors, [], `${deck.id}: ${errors.map((finding) => finding.message).join(" | ")}`);
}

const coverage = catalogCoverage();
for (const [region, counts] of Object.entries(coverage)) {
  assert.ok(counts.collectible >= 18, `${region}: insufficient collectible identity`);
  assert.ok(counts.units >= 8, `${region}: insufficient units`);
  assert.ok(counts.spells >= 4, `${region}: insufficient spells`);
  assert.ok(counts.champions >= 1, `${region}: missing champion`);
}

assert.equal(CARDS.forest_ambush.spell?.kind, "grantBarrier");
assert.ok(CARDS.forest_canopy_warden.keywords?.includes("Reach"));

console.log("GAMEPLAY PROFILE 2.32: PASS");
