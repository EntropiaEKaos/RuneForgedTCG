import assert from "node:assert/strict";
import { collectibleCards, getCard } from "./cards";
import { FOUR_PLAYER_SEATS, type FourPlayerSeat } from "./four-player-general";
import { createFourPlayerMatchStateFromCatalog, type FourPlayerGeneralSelection } from "./four-player-match";

const candidates = collectibleCards().filter((card) => Number.isFinite(card.cost) && card.cost >= 0).slice(0, 4);
assert.equal(candidates.length, 4, "Catalog must expose at least four collectible cards for the 4P fixture.");

const selection = Object.fromEntries(
  FOUR_PLAYER_SEATS.map((seat, index) => [seat, candidates[index].defId]),
) as FourPlayerGeneralSelection;

const match = createFourPlayerMatchStateFromCatalog("p1", selection);
for (const seat of FOUR_PLAYER_SEATS) {
  const card = getCard(selection[seat]);
  assert.equal(match.generalPrintedCosts[seat], card.cost);
  assert.equal(match.generals[seat].defId, selection[seat]);
  if (card.type === "Unit") {
    assert.equal(match.generalCombatBodies?.[seat]?.power, card.power ?? 0);
    assert.equal(match.generalCombatBodies?.[seat]?.health, card.health ?? 1);
  } else {
    assert.equal(match.generalCombatBodies?.[seat], undefined);
  }
}

const forged = { ...selection, p4: "__client-forged-unknown-general__" } as Record<FourPlayerSeat, string>;
assert.throws(() => createFourPlayerMatchStateFromCatalog("p1", forged), /Unknown card/);

console.log("FOUR PLAYER CATALOG-BOUND GENERAL COSTS: PASS");
