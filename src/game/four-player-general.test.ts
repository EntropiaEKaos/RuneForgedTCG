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
const general = emberCards.find((card) => card.isChampion || card.isLegend);
assert.ok(general, "catalog must expose an Emberhold Champion/Legend General");

const mainCandidates = emberCards.filter((card) => card.defId !== general.defId).slice(0, 20);
assert.equal(mainCandidates.length, 20, "catalog must expose enough Emberhold cards for a 60-card 3-copy deck");
const mainDeck = mainCandidates.flatMap((card) => [card.defId, card.defId, card.defId]);
assert.equal(mainDeck.length, FOUR_PLAYER_MAIN_DECK_SIZE);

const valid = validateFourPlayerGeneralDeck({
  cards: mainDeck,
  general: { defId: general.defId, identity: { regions: ["Emberhold"] } },
});
assert.equal(valid.ok, true, valid.errors.join(" | "));

const tooManyCopies = [...mainDeck];
tooManyCopies[3] = tooManyCopies[0];
const copiesCheck = validateFourPlayerGeneralDeck({
  cards: tooManyCopies,
  general: { defId: general.defId, identity: { regions: ["Emberhold"] } },
});
assert.equal(copiesCheck.ok, false);
assert.ok(copiesCheck.errors.some((error) => error.includes(String(FOUR_PLAYER_MAX_COPIES))));

const shortCheck = validateFourPlayerGeneralDeck({
  cards: mainDeck.slice(0, FOUR_PLAYER_MAIN_DECK_SIZE - 1),
  general: { defId: general.defId, identity: { regions: ["Emberhold"] } },
});
assert.equal(shortCheck.ok, false);

const missingGeneral = validateFourPlayerGeneralDeck({
  cards: mainDeck,
  general: { defId: "" },
});
assert.equal(missingGeneral.ok, false);
assert.ok(missingGeneral.errors.includes("A General is required."));

const standardForty = mainDeck.slice(0, 40);
assert.equal(validateDeck(standardForty).ok, true, "4P rules must not replace standard 1v1 deck validation");
assert.equal(validateDeck(mainDeck).ok, false, "60-card Commander decks must not silently become standard decks");

assert.deepEqual(FOUR_PLAYER_SEATS, ["p1", "p2", "p3", "p4"]);
assert.deepEqual(FOUR_PLAYER_DECK_RULES, { deckMin: 60, deckMax: 60, maxCopies: 3, maxRegions: 6 });
assert.equal(generalRecastTax({ generalCastsFromZone: 0 }), 0);
assert.equal(generalRecastTax({ generalCastsFromZone: 1 }), 2);
assert.equal(generalRecastTax({ generalCastsFromZone: 3 }), 6);

console.log("FOUR PLAYER GENERAL CONTRACT 60+1: PASS");
