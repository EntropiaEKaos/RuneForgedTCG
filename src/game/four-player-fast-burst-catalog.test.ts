import assert from "node:assert/strict";
import { collectibleCards } from "./cards";
import { isFourPlayerSpellChainSupported } from "./four-player-spell-contract";

const reactionCards = collectibleCards().filter((card) =>
  card.collectible !== false
  && card.type === "Spell"
  && (card.speed === "Fast" || card.speed === "Burst"),
);

assert.ok(reactionCards.length > 0, "catalog must contain Fast/Burst reaction cards");
const unsupported = reactionCards
  .filter((card) => !card.spell || !isFourPlayerSpellChainSupported(card.spell))
  .map((card) => card.defId)
  .sort();

assert.deepEqual(
  unsupported,
  [],
  `every collectible Fast/Burst spell must be executable by Commander 4P; unsupported: ${unsupported.join(", ")}`,
);

for (const card of reactionCards) {
  if (card.spell?.kind === "negateSpell") {
    assert.equal(card.speed, "Burst", `${card.defId}: negateSpell must remain Burst under the certified reaction contract`);
  }
}

console.log(`FOUR PLAYER FAST/BURST CATALOG AUDIT: PASS — ${reactionCards.length} collectible reaction cards are 4P-executable`);
