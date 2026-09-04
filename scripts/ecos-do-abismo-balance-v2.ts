import { getCard } from "../src/game/cards";
import { getDeck, validateDeck } from "../src/game/decks";

type CostRefinement = "cost3" | "cost4";
const variant = (process.env.ECOS_RECOLLECTION_COST_VARIANT ?? "cost3") as CostRefinement;
const RECOLLECTION_ID = "rfalpha_reanimator_drowned_recollection";

async function main(): Promise<void> {
  const deck = getDeck("ecos_do_abismo");
  const recollection = getCard(RECOLLECTION_ID);

  if (recollection.type !== "Spell" || recollection.spell?.kind !== "selfMill" || recollection.spell.amount !== 1) {
    throw new Error("Recordação Submersa must remain a Spell with selfMill 1.");
  }
  if (recollection.spell.also?.kind !== "draw" || recollection.spell.also.amount !== 1 || recollection.spell.also.target !== "none") {
    throw new Error("Recordação Submersa must continue to chain exactly draw 1.");
  }

  if (variant === "cost3") recollection.cost = 3;
  else if (variant === "cost4") recollection.cost = 4;
  else throw new Error(`Unknown Recordação cost refinement: ${variant}`);

  if (deck.cards.length !== 40) throw new Error(`Ecos refinement ${variant} must contain exactly 40 cards; got ${deck.cards.length}.`);
  const validation = validateDeck(deck.cards);
  if (!validation.ok) throw new Error(`Ecos refinement ${variant} is illegal: ${validation.errors.join(" | ")}`);
  if (validation.regions.length !== 2 || !validation.regions.includes("Tidecall") || !validation.regions.includes("Voidborn")) {
    throw new Error(`Ecos refinement ${variant} must remain Tidecall/Voidborn; got ${validation.regions.join(", ")}.`);
  }

  const recollectionCopies = deck.cards.filter((defId) => defId === RECOLLECTION_ID).length;
  const healCopies = deck.cards.filter((defId) => defId === "tide_heal").length;
  if (recollectionCopies !== 1 || healCopies !== 1) {
    throw new Error(`Ecos refinement ${variant} recipe drift: Recordação=${recollectionCopies}, Soothing Tide=${healCopies}.`);
  }

  for (const starterId of ["ember_aggro", "tide_control", "wood_midrange", "void_shadow", "florestia_tribal", "tempestade_rush"]) {
    const starter = getDeck(starterId);
    if (starter.cards.some((defId) => defId.startsWith("rfalpha_reanimator_"))) {
      throw new Error(`Starter ${starterId} was contaminated by Ecos/Reanimator content.`);
    }
  }

  console.log(`ECOS RECORDACAO COST REFINEMENT: ${variant} · cost=${recollection.cost} · selfMill1 -> draw1 · recipe 1x/1x`);
  await import("./ecos-do-abismo-balance-audit");
}

void main();
