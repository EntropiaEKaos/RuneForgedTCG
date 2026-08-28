import { DECKS } from "../src/game/decks";
import { auditStarterDeck, catalogCoverage, profileDeck } from "../src/game/gameplay-profile";

console.log("RUNEFORGE GAMEPLAY AUDIT 2.32\n");
for (const deck of DECKS) {
  const p = profileDeck(deck.cards);
  console.log(`${deck.name}: ${p.identity} | avg ${p.averageCost} | early ${p.earlyCards} | units ${p.units} | interaction ${p.interaction}`);
  for (const finding of auditStarterDeck(deck)) console.log(`  ${finding.severity.toUpperCase()} ${finding.code}: ${finding.message}`);
}
console.log("\nCATALOG COVERAGE");
for (const [region, counts] of Object.entries(catalogCoverage())) {
  console.log(`${region}: ${counts.collectible} collectible | ${counts.units} units | ${counts.spells} spells | ${counts.champions} champion(s)`);
}
