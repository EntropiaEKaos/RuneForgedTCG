import { getCard } from "../src/game/cards";
import { getDeck, validateDeck } from "../src/game/decks";

const RECOLLECTION_ID = "rfalpha_reanimator_drowned_recollection";
const STARTERS = ["ember_aggro", "tide_control", "wood_midrange", "void_shadow", "florestia_tribal", "tempestade_rush"] as const;
const EXPECTED_RECIPE_WINDOW = [
  "tide_heal",
  "tide_oracle",
  "tide_oracle",
  "tide_guard",
  "tide_guard",
  "tide_sprite",
  "tide_sprite",
  RECOLLECTION_ID,
  "tide_heal",
] as const;

async function main(): Promise<void> {
  const deck = getDeck("ecos_do_abismo");
  const recollection = getCard(RECOLLECTION_ID);

  if (deck.cards.length !== 40) {
    throw new Error(`Canonical Ecos do Abismo 1.1 must contain exactly 40 cards; got ${deck.cards.length}.`);
  }
  const validation = validateDeck(deck.cards);
  if (!validation.ok) throw new Error(`Canonical Ecos do Abismo 1.1 is illegal: ${validation.errors.join(" | ")}`);
  if (validation.regions.length !== 2 || !validation.regions.includes("Tidecall") || !validation.regions.includes("Voidborn")) {
    throw new Error(`Canonical Ecos do Abismo 1.1 must remain Tidecall/Voidborn; got ${validation.regions.join(", ")}.`);
  }

  if (
    recollection.type !== "Spell" ||
    recollection.cost !== 2 ||
    recollection.spell?.kind !== "selfMill" ||
    recollection.spell.amount !== 1 ||
    recollection.spell.target !== "none" ||
    recollection.spell.also?.kind !== "draw" ||
    recollection.spell.also.amount !== 1 ||
    recollection.spell.also.target !== "none"
  ) {
    throw new Error("Ecos 1.1 requires Recordação Submersa to remain canonical cost2 selfMill1 -> draw1.");
  }

  const recollectionCopies = deck.cards.filter((id) => id === RECOLLECTION_ID).length;
  const healCopies = deck.cards.filter((id) => id === "tide_heal").length;
  const oracleCopies = deck.cards.filter((id) => id === "tide_oracle").length;
  if (recollectionCopies !== 1 || healCopies !== 2 || oracleCopies !== 2) {
    throw new Error(
      `Ecos 1.1 canonical recipe requires Recordação=1, Soothing=2, Oracle=2; got ${recollectionCopies}/${healCopies}/${oracleCopies}.`,
    );
  }

  const recipeWindow = deck.cards.slice(13, 22);
  if (recipeWindow.join("|") !== EXPECTED_RECIPE_WINDOW.join("|")) {
    throw new Error(
      `Ecos 1.1 certified recipe order drifted. Expected ${EXPECTED_RECIPE_WINDOW.join(" | ")}, got ${recipeWindow.join(" | ")}.`,
    );
  }

  for (const starterId of STARTERS) {
    const starter = getDeck(starterId);
    if (starter.cards.some((id) => id.startsWith("rfalpha_reanimator_"))) {
      throw new Error(`Starter ${starterId} was contaminated by Ecos/Reanimator content.`);
    }
  }

  console.log("ECOS CANONICAL BALANCE 1.1: 4k · 1x Recordação cost2 selfMill1->draw1 · 2x Soothing Tide · 2x Tide Oracle · certified recipe order");
  await import("./ecos-do-abismo-balance-audit");
}

void main();
