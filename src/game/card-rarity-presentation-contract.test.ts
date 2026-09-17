import assert from "node:assert/strict";
import test from "node:test";
import { cardRarityPresentationContract } from "./card-rarity-presentation-contract";

test("rarity DOM contract exposes stable classes and bounded FX intent", () => {
  const epic = cardRarityPresentationContract("Epic");
  assert.deepEqual(epic.classes, ["card-tier-epic", "card-rarity-ornament-epic"]);
  assert.deepEqual(epic.attributes, {
    "data-card-rarity": "epic",
    "data-card-rarity-rank": 2,
    "data-card-rarity-fx": "standard",
  });
});

test("rarity DOM contract has a safe Common fallback", () => {
  const common = cardRarityPresentationContract(undefined);
  assert.equal(common.attributes["data-card-rarity"], "common");
  assert.equal(common.attributes["data-card-rarity-fx"], "none");
});
