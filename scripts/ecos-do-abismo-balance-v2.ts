import { getCard } from "../src/game/cards";
import { getDeck, validateDeck } from "../src/game/decks";

type SlotRefinement =
  | "current_heal"
  | "heal_for_deathmark"
  | "heal_for_unmake"
  | "heal_for_wither"
  | "heal_for_glacial";

const variant = (process.env.ECOS_RECOLLECTION_SLOT_VARIANT ?? "current_heal") as SlotRefinement;
const RECOLLECTION_ID = "rfalpha_reanimator_drowned_recollection";
const STARTERS = ["ember_aggro", "tide_control", "wood_midrange", "void_shadow", "florestia_tribal", "tempestade_rush"] as const;

const replacementTarget: Record<Exclude<SlotRefinement, "current_heal">, string> = {
  heal_for_deathmark: "void_deathmark",
  heal_for_unmake: "void_unmake",
  heal_for_wither: "void_wither",
  heal_for_glacial: "tide_glacial",
};

async function main(): Promise<void> {
  const deck = getDeck("ecos_do_abismo");
  const recollection = getCard(RECOLLECTION_ID);

  if (
    recollection.type !== "Spell" ||
    recollection.cost !== 2 ||
    recollection.spell?.kind !== "selfMill" ||
    recollection.spell.amount !== 1 ||
    recollection.spell.target !== "none"
  ) {
    throw new Error("Recordação Submersa must remain the canonical cost-2 selfMill 1 Spell.");
  }
  if (
    recollection.spell.also?.kind !== "draw" ||
    recollection.spell.also.amount !== 1 ||
    recollection.spell.also.target !== "none"
  ) {
    throw new Error("Recordação Submersa must continue to chain exactly draw 1.");
  }

  if (variant !== "current_heal") {
    const target = replacementTarget[variant as Exclude<SlotRefinement, "current_heal">];
    if (!target) throw new Error(`Unknown Ecos slot refinement: ${variant}`);
    const index = deck.cards.indexOf(target);
    if (index < 0) throw new Error(`Variant ${variant} expected ${target} in the canonical recipe.`);
    deck.cards.splice(index, 1, "tide_heal");
  }

  if (deck.cards.length !== 40) {
    throw new Error(`Ecos slot refinement ${variant} must contain exactly 40 cards; got ${deck.cards.length}.`);
  }
  const validation = validateDeck(deck.cards);
  if (!validation.ok) throw new Error(`Ecos slot refinement ${variant} is illegal: ${validation.errors.join(" | ")}`);
  if (
    validation.regions.length !== 2 ||
    !validation.regions.includes("Tidecall") ||
    !validation.regions.includes("Voidborn")
  ) {
    throw new Error(`Ecos slot refinement ${variant} must remain Tidecall/Voidborn; got ${validation.regions.join(", ")}.`);
  }

  const recollectionCopies = deck.cards.filter((defId) => defId === RECOLLECTION_ID).length;
  const healCopies = deck.cards.filter((defId) => defId === "tide_heal").length;
  const expectedHeals = variant === "current_heal" ? 1 : 2;
  if (recollectionCopies !== 1 || healCopies !== expectedHeals) {
    throw new Error(
      `Ecos slot refinement ${variant} recipe drift: Recordação=${recollectionCopies}, Soothing Tide=${healCopies}; expected 1/${expectedHeals}.`,
    );
  }

  for (const starterId of STARTERS) {
    const starter = getDeck(starterId);
    if (starter.cards.some((defId) => defId.startsWith("rfalpha_reanimator_"))) {
      throw new Error(`Starter ${starterId} was contaminated by Ecos/Reanimator content.`);
    }
  }

  console.log(
    `ECOS RECORDACAO SLOT REFINEMENT: ${variant} · cost2 · selfMill1 -> draw1 · Recordação=1x · Soothing Tide=${healCopies}x`,
  );
  await import("./ecos-do-abismo-balance-audit");
}

void main();
