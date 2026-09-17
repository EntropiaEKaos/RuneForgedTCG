import assert from "node:assert/strict";
import { allCards } from "./cards";
import { validateDeck } from "./decks";
import { cardRegions } from "./region-identity";
import {
  FOUR_PLAYER_DECK_RULES,
  FOUR_PLAYER_MAIN_DECK_SIZE,
  FOUR_PLAYER_MAX_COPIES,
  FOUR_PLAYER_SEATS,
  generalRecastTax,
  validateFourPlayerGeneralDeck,
} from "./four-player-general";

const emberCards = allCards().filter((card) =>
  card.collectible !== false && cardRegions(card).length === 1 && card.region === "Emberhold",
);
assert.ok(emberCards.length >= 40, "catalog must expose enough Emberhold cards for an 80-card 2-copy deck");

const mainDeck = emberCards.slice(0, 40).flatMap((card) => [card.defId, card.defId]);
assert.equal(mainDeck.length, FOUR_PLAYER_MAIN_DECK_SIZE);

const general = emberCards.find((card) => card.isLegend) ?? emberCards[0];
const valid = validateFourPlayerGeneralDeck({
  cards: mainDeck,
  general: { defId: general.defId, identity: { regions: ["Emberhold"] } },
});
assert.equal(valid.ok, true, valid.errors.join(" | "));

const tooManyCopies = [...mainDeck];
tooManyCopies[2] = tooManyCopies[0];
const copiesCheck = validateFourPlayerGeneralDeck({
  cards: tooManyCopies,
  general: { defId: general.defId, identity: { regions: ["Emberhold"] } },
});
assert.equal(copiesCheck.ok, false);
assert.ok(copiesCheck.errors.some((error) => error.includes(String(FOUR_PLAYER_MAX_COPIES))));

const shortCheck = validateFourPlayerGeneralDeck({
  cards: mainDeck.slice(0, 79),
  general: { defId: general.defId, identity: { regions: ["Emberhold"] } },
});
assert.equal(shortCheck.ok, false);

const missingGeneral = validateFourPlayerGeneralDeck({
  cards: mainDeck,
  general: { defId: "", identity: { regions: ["Emberhold"] } },
});
assert.equal(missingGeneral.ok, false);
assert.ok(missingGeneral.errors.includes("A General is required."));

// Critical isolation proof: the standard validator keeps its existing defaults.
const standardForty = mainDeck.slice(0, 40);
assert.equal(validateDeck(standardForty).ok, true, "4P rules must not replace standard 1v1 deck validation");
assert.equal(validateDeck(mainDeck).ok, false, "80-card General decks must not silently become standard decks");

assert.deepEqual(FOUR_PLAYER_SEATS, ["p1", "p2", "p3", "p4"]);
assert.deepEqual(FOUR_PLAYER_DECK_RULES, { deckMin: 80, deckMax: 80, maxCopies: 2, maxRegions: 3 });
assert.equal(generalRecastTax({ generalCastsFromZone: 0 }), 0);
assert.equal(generalRecastTax({ generalCastsFromZone: 1 }), 2);
assert.equal(generalRecastTax({ generalCastsFromZone: 3 }), 6);

console.log("FOUR PLAYER GENERAL CONTRACT: PASS");
