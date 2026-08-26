import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { allCards, getCard } from "@/game/cards";
import { DECKS, validateDeck } from "@/game/decks";
import { validateAuthorableCard } from "@/game/card-authoring";
import { cardRegions, identityForRegions } from "@/game/region-identity";
import { createCustomGame, effectiveCost, playUnit } from "@/game/engine";
import { estimateCardPower, summarizeBalance } from "@/game/balance-health";
import type { DeckInput } from "@/game/types";
import type { SimulationSummary } from "@/lib/balance-simulator";

const multi = allCards().filter((card) => cardRegions(card).length > 1);
const dual = multi.filter((card) => cardRegions(card).length === 2);
const triad = multi.filter((card) => cardRegions(card).length === 3);
assert.equal(new Set(dual.map((card) => identityForRegions(cardRegions(card)).key)).size, 15, "all 15 dual identities must have a card");
assert.ok(triad.length >= 7, "at least seven triple-region cards");
for (const card of multi) assert.equal(validateAuthorableCard(card).ok, true, card.defId);

for (const deck of DECKS) assert.equal(validateDeck(deck.cards).ok, true, deck.id);
const illegalFour = (["Emberhold", "Tidecall", "Ironwood", "Voidborn"] as const).flatMap((region) => {
  const ids = allCards().filter((card) => card.collectible !== false && card.region === region && cardRegions(card).length === 1).slice(0, 4).map((card) => card.defId);
  return [ids[0], ids[0], ids[0], ids[1], ids[1], ids[1], ids[2], ids[2], ids[2], ids[3]];
});
const illegalFourCheck = validateDeck(illegalFour);
assert.equal(illegalFourCheck.ok, false, "four-region deck must be rejected");
assert.equal(illegalFourCheck.regions.length, 4, "validator must retain all detected regions");
assert.ok(illegalFourCheck.errors.some((error) => error.includes("At most 3 regions")), "rejection must be caused by the region limit");
assert.deepEqual(validateDeck([]).regions, [], "an empty deck must not inherit Emberhold identity");

const exactDual: DeckInput = { id: "test-dual", name: "Test Dual", cards: Array(40).fill("convergence_stormforge_vanguard") };
const opponent: DeckInput = { id: "opponent", name: "Opponent", cards: Array(40).fill("ember_whelp") };
let game = createCustomGame("Mastery", exactDual, opponent, { seed: 287, playerGoesFirst: true, skipMulligan: true });
assert.deepEqual(game.players.player.deckRegions, ["Emberhold", "Tempestade"]);
assert.equal(effectiveCost(game, "player", getCard("convergence_stormforge_vanguard")), 3, "exact dual mastery discounts cost");
game.players.player.deckRegions = ["Emberhold", "Voidborn", "Tempestade"];
assert.equal(effectiveCost(game, "player", getCard("convergence_stormforge_vanguard")), 4, "superset identity does not activate exact mastery");

const assaultDeck: DeckInput = { id: "assault", name: "Assault", cards: Array(40).fill("convergence_huntfire_alpha") };
game = createCustomGame("Assault", assaultDeck, opponent, { seed: 288, playerGoesFirst: true, skipMulligan: true });
game.players.player.mana = 10;
game.players.player.maxMana = 10;
const assaultCard = game.players.player.hand[0];
game = playUnit(game, "player", assaultCard.instanceId);
assert.equal(game.players.player.bench[0].power, 5, "assault mastery grants +1 power");

const bulwarkDeck: DeckInput = { id: "bulwark", name: "Bulwark", cards: Array(40).fill("convergence_abyss_grove_warden") };
game = createCustomGame("Bulwark", bulwarkDeck, opponent, { seed: 289, playerGoesFirst: true, skipMulligan: true });
game.players.player.mana = 10;
game.players.player.maxMana = 10;
const bulwarkCard = game.players.player.hand[0];
game = playUnit(game, "player", bulwarkCard.instanceId);
assert.equal(game.players.player.bench[0].health, 7, "bulwark mastery grants +1 health");

assert.equal(estimateCardPower(getCard("convergence_steamwright")).band !== undefined, true);
const health = summarizeBalance([{ winRateA: 70, firstPlayerWins: 50, secondPlayerWins: 50 } as SimulationSummary]);
assert.equal(health.releaseGate, "blocked");

const cardView = readFileSync("src/components/CardView.tsx", "utf8");
const studio = readFileSync("src/app/admin/studio/cards/CardAuthoringStudio.tsx", "utf8");
const shareApi = readFileSync("src/app/api/decks/share/route.ts", "utf8");
assert.match(cardView, /card-region-spectrum/);
assert.match(studio, /Regional identity/);
assert.match(shareApi, /region3/);
assert.ok(readFileSync("drizzle/0029_multiregion_identity.sql", "utf8").includes("region3"));

console.log(`EVOLUTION 2.87: PASS (${multi.length} multi-region cards; ${dual.length} dual; ${triad.length} triad)`);
