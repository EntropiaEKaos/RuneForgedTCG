import { getCard } from "../src/game/cards";
import { getDeck, validateDeck } from "../src/game/decks";

type MethodologyProbe = "baseline_1_0" | "recordacao_cost2" | "recordacao_cost3" | "recordacao_cost4";
const variant = (process.env.ECOS_METHODOLOGY_VARIANT ?? "baseline_1_0") as MethodologyProbe;
const RECOLLECTION_ID = "rfalpha_reanimator_drowned_recollection";
const STARTERS = ["ember_aggro", "tide_control", "wood_midrange", "void_shadow", "florestia_tribal", "tempestade_rush"] as const;

async function main(): Promise<void> {
  const deck = getDeck("ecos_do_abismo");
  const recollection = getCard(RECOLLECTION_ID);

  if (
    recollection.type !== "Spell" ||
    recollection.spell?.kind !== "selfMill" ||
    recollection.spell.amount !== 1 ||
    recollection.spell.target !== "none" ||
    recollection.spell.also?.kind !== "draw" ||
    recollection.spell.also.amount !== 1 ||
    recollection.spell.also.target !== "none"
  ) {
    throw new Error("Recordação Submersa must remain selfMill1 -> draw1.");
  }

  if (variant === "baseline_1_0") {
    const index = deck.cards.indexOf(RECOLLECTION_ID);
    if (index < 0) throw new Error("Baseline probe expected Recordação in Ecos 1.1 recipe.");
    deck.cards.splice(index, 1, "tide_heal");
  } else if (variant === "recordacao_cost2") {
    recollection.cost = 2;
  } else if (variant === "recordacao_cost3") {
    recollection.cost = 3;
  } else if (variant === "recordacao_cost4") {
    recollection.cost = 4;
  } else {
    throw new Error(`Unknown methodology probe: ${variant}`);
  }

  if (deck.cards.length !== 40) throw new Error(`${variant}: expected 40 cards, got ${deck.cards.length}.`);
  const validation = validateDeck(deck.cards);
  if (!validation.ok) throw new Error(`${variant}: illegal recipe: ${validation.errors.join(" | ")}`);
  if (validation.regions.length !== 2 || !validation.regions.includes("Tidecall") || !validation.regions.includes("Voidborn")) {
    throw new Error(`${variant}: identity drift: ${validation.regions.join(", ")}`);
  }

  const recollectionCopies = deck.cards.filter((id) => id === RECOLLECTION_ID).length;
  const healCopies = deck.cards.filter((id) => id === "tide_heal").length;
  if (variant === "baseline_1_0") {
    if (recollectionCopies !== 0 || healCopies !== 2) throw new Error("Baseline 1.0 probe must restore 0 Recordação / 2 Soothing Tide.");
  } else if (recollectionCopies !== 1 || healCopies !== 1) {
    throw new Error(`${variant}: expected 1 Recordação / 1 Soothing Tide.`);
  }

  for (const starterId of STARTERS) {
    const starter = getDeck(starterId);
    if (starter.cards.some((id) => id.startsWith("rfalpha_reanimator_"))) {
      throw new Error(`Starter ${starterId} was contaminated by Ecos/Reanimator content.`);
    }
  }

  console.log(`ECOS ORDER-INVARIANT METHODOLOGY PROBE: ${variant} · Recordação=${recollectionCopies} · Soothing=${healCopies} · cost=${recollection.cost}`);
  await import("./ecos-do-abismo-balance-audit");
}
void main();
