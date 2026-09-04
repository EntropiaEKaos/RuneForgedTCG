import { getDeck, validateDeck } from "../src/game/decks";

async function main(): Promise<void> {
  const deck = getDeck("ecos_do_abismo");
  if (deck.cards.length !== 40) throw new Error(`Canonical Ecos do Abismo must contain exactly 40 cards; got ${deck.cards.length}.`);

  const validation = validateDeck(deck.cards);
  if (!validation.ok) throw new Error(`Canonical Ecos do Abismo is illegal: ${validation.errors.join(" | ")}`);
  if (validation.regions.length !== 2 || !validation.regions.includes("Tidecall") || !validation.regions.includes("Voidborn")) {
    throw new Error(`Canonical Ecos do Abismo must remain Tidecall/Voidborn; got ${validation.regions.join(", ")}.`);
  }

  const recollectionId = "rfalpha_reanimator_drowned_recollection";
  const recollectionCopies = deck.cards.filter((defId) => defId === recollectionId).length;
  if (recollectionCopies !== 2) {
    throw new Error(`Ecos 1.1 canonical balance requires exactly 2 Recordação Submersa copies; got ${recollectionCopies}.`);
  }
  if (deck.cards.includes("tide_heal")) {
    throw new Error("Ecos 1.1 canonical balance must not retain Soothing Tide.");
  }

  for (const starterId of ["ember_aggro", "tide_control", "wood_midrange", "void_shadow", "florestia_tribal", "tempestade_rush"]) {
    const starter = getDeck(starterId);
    if (starter.cards.some((defId) => defId.startsWith("rfalpha_reanimator_"))) {
      throw new Error(`Starter ${starterId} was contaminated by Ecos/Reanimator content.`);
    }
  }

  console.log("ECOS CANONICAL BALANCE 1.1: 4k self-mill recipe · 2x Recordação Submersa · 0x Soothing Tide · starters isolated");
  await import("./ecos-do-abismo-balance-audit");
}

void main();
