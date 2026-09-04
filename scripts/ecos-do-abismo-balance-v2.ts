import { getCard } from "../src/game/cards";
import { getDeck, validateDeck } from "../src/game/decks";

type SelfMillRefinement = "two_mill1" | "one_mill2" | "one_mill1";

const variant = (process.env.ECOS_SELF_MILL_VARIANT ?? "two_mill1") as SelfMillRefinement;
const RECOLLECTION_ID = "rfalpha_reanimator_drowned_recollection";

async function main(): Promise<void> {
  const deck = getDeck("ecos_do_abismo");
  const recollection = getCard(RECOLLECTION_ID);
  if (recollection.spell?.kind !== "selfMill") {
    throw new Error("Recordação Submersa must remain a selfMill Spell.");
  }

  if (variant === "two_mill1") {
    recollection.spell.amount = 1;
  } else if (variant === "one_mill2" || variant === "one_mill1") {
    const index = deck.cards.indexOf(RECOLLECTION_ID);
    if (index < 0) throw new Error(`Variant ${variant} expected Recordação Submersa in the canonical deck.`);
    deck.cards.splice(index, 1, "tide_heal");
    recollection.spell.amount = variant === "one_mill1" ? 1 : 2;
  } else {
    throw new Error(`Unknown Ecos self-mill refinement: ${variant}`);
  }

  if (deck.cards.length !== 40) throw new Error(`Ecos refinement ${variant} must contain exactly 40 cards; got ${deck.cards.length}.`);

  const validation = validateDeck(deck.cards);
  if (!validation.ok) throw new Error(`Ecos refinement ${variant} is illegal: ${validation.errors.join(" | ")}`);
  if (validation.regions.length !== 2 || !validation.regions.includes("Tidecall") || !validation.regions.includes("Voidborn")) {
    throw new Error(`Ecos refinement ${variant} must remain Tidecall/Voidborn; got ${validation.regions.join(", ")}.`);
  }

  const recollectionCopies = deck.cards.filter((defId) => defId === RECOLLECTION_ID).length;
  const healCopies = deck.cards.filter((defId) => defId === "tide_heal").length;
  const expectedRecollectionCopies = variant === "two_mill1" ? 2 : 1;
  const expectedHealCopies = variant === "two_mill1" ? 0 : 1;
  if (recollectionCopies !== expectedRecollectionCopies || healCopies !== expectedHealCopies) {
    throw new Error(
      `Ecos refinement ${variant} recipe drift: Recordação=${recollectionCopies}, Soothing Tide=${healCopies}.`,
    );
  }

  for (const starterId of ["ember_aggro", "tide_control", "wood_midrange", "void_shadow", "florestia_tribal", "tempestade_rush"]) {
    const starter = getDeck(starterId);
    if (starter.cards.some((defId) => defId.startsWith("rfalpha_reanimator_"))) {
      throw new Error(`Starter ${starterId} was contaminated by Ecos/Reanimator content.`);
    }
  }

  console.log(
    `ECOS SELF-MILL 1.1 REFINEMENT: ${variant} · Recordação=${recollectionCopies}x · selfMill=${recollection.spell.amount} · Soothing Tide=${healCopies}x`,
  );
  await import("./ecos-do-abismo-balance-audit");
}

void main();
