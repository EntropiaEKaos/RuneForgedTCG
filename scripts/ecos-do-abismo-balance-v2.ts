import { getCard } from "../src/game/cards";
import { getDeck, validateDeck } from "../src/game/decks";

const RECOLLECTION_ID = "rfalpha_reanimator_drowned_recollection";

async function main(): Promise<void> {
  const deck = getDeck("ecos_do_abismo");
  if (deck.cards.length !== 40) throw new Error(`Canonical Ecos do Abismo must contain exactly 40 cards; got ${deck.cards.length}.`);

  const validation = validateDeck(deck.cards);
  if (!validation.ok) throw new Error(`Canonical Ecos do Abismo is illegal: ${validation.errors.join(" | ")}`);
  if (validation.regions.length !== 2 || !validation.regions.includes("Tidecall") || !validation.regions.includes("Voidborn")) {
    throw new Error(`Canonical Ecos do Abismo must remain Tidecall/Voidborn; got ${validation.regions.join(", ")}.`);
  }

  const recollection = getCard(RECOLLECTION_ID);
  if (recollection.type !== "Spell" || recollection.spell?.kind !== "selfMill" || recollection.spell.amount !== 1) {
    throw new Error("Ecos 1.1 requires Recordação Submersa to be a Spell with canonical selfMill 1.");
  }
  if (recollection.spell.also?.kind !== "draw" || recollection.spell.also.amount !== 1 || recollection.spell.also.target !== "none") {
    throw new Error("Ecos 1.1 requires Recordação Submersa to chain exactly draw 1.");
  }

  const recollectionCopies = deck.cards.filter((defId) => defId === RECOLLECTION_ID).length;
  const healCopies = deck.cards.filter((defId) => defId === "tide_heal").length;
  if (recollectionCopies !== 1 || healCopies !== 1) {
    throw new Error(
      `Ecos 1.1 canonical recipe requires Recordação=1 and Soothing Tide=1; got Recordação=${recollectionCopies}, Soothing Tide=${healCopies}.`,
    );
  }

  for (const starterId of ["ember_aggro", "tide_control", "wood_midrange", "void_shadow", "florestia_tribal", "tempestade_rush"]) {
    const starter = getDeck(starterId);
    if (starter.cards.some((defId) => defId.startsWith("rfalpha_reanimator_"))) {
      throw new Error(`Starter ${starterId} was contaminated by Ecos/Reanimator content.`);
    }
  }

  console.log("ECOS CANONICAL BALANCE 1.1: 4k · 1x Recordação Submersa selfMill 1 · 1x Soothing Tide · starters isolated");
  await import("./ecos-do-abismo-balance-audit");
}

void main();
