import assert from "node:assert/strict";
import test from "node:test";
import { CARD_RARITY_PRESENTATION, rarityPresentationClassNames, resolveCardRarityPresentation } from "./card-rarity-presentation";

test("rarity presentation has deterministic ascending prestige", () => {
  assert.deepEqual(["Common", "Rare", "Epic", "Legend"].map((rarity) => CARD_RARITY_PRESENTATION[rarity as keyof typeof CARD_RARITY_PRESENTATION].rank), [0, 1, 2, 3]);
});

test("rarity presentation defaults safely to Common", () => {
  assert.equal(resolveCardRarityPresentation(undefined).id, "common");
  assert.deepEqual(rarityPresentationClassNames(undefined), ["card-tier-common", "card-rarity-ornament-common"]);
});

test("Legend presentation is cinematic without changing gameplay data", () => {
  const presentation = resolveCardRarityPresentation("Legend");
  assert.equal(presentation.premiumFx, "cinematic");
  assert.equal(presentation.shellClass, "card-tier-legend");
  assert.equal(presentation.shortLabel, "LENDÁRIA");
});
