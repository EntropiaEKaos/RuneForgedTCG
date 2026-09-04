import { getCard } from "../src/game/cards";
import { getDeck, validateDeck } from "../src/game/decks";

type StunRefinement =
  | "oracle_to_stun"
  | "stalker_to_stun"
  | "guard_to_stun"
  | "drain_to_stun"
  | "glacial_to_stun"
  | "hexer_to_stun";

const variant = (process.env.ECOS_RECOLLECTION_STUN_VARIANT ?? "oracle_to_stun") as StunRefinement;
const RECOLLECTION_ID = "rfalpha_reanimator_drowned_recollection";
const STUN_ID = "tide_stun";
const STARTERS = ["ember_aggro", "tide_control", "wood_midrange", "void_shadow", "florestia_tribal", "tempestade_rush"] as const;

const replacementTarget: Record<StunRefinement, string> = {
  oracle_to_stun: "tide_oracle",
  stalker_to_stun: "void_stalker",
  guard_to_stun: "tide_guard",
  drain_to_stun: "void_drain",
  glacial_to_stun: "tide_glacial",
  hexer_to_stun: "void_hexer",
};

async function main(): Promise<void> {
  const deck = getDeck("ecos_do_abismo");
  const recollection = getCard(RECOLLECTION_ID);

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
    throw new Error("Recordação Submersa must remain canonical cost2 selfMill1 -> draw1.");
  }

  const target = replacementTarget[variant];
  if (!target) throw new Error(`Unknown Ecos Stun refinement: ${variant}`);
  const index = deck.cards.indexOf(target);
  if (index < 0) throw new Error(`Variant ${variant} expected ${target} in the canonical recipe.`);
  deck.cards.splice(index, 1, STUN_ID);

  if (deck.cards.length !== 40) {
    throw new Error(`Ecos Stun refinement ${variant} must contain exactly 40 cards; got ${deck.cards.length}.`);
  }
  const validation = validateDeck(deck.cards);
  if (!validation.ok) throw new Error(`Ecos Stun refinement ${variant} is illegal: ${validation.errors.join(" | ")}`);
  if (
    validation.regions.length !== 2 ||
    !validation.regions.includes("Tidecall") ||
    !validation.regions.includes("Voidborn")
  ) {
    throw new Error(`Ecos Stun refinement ${variant} must remain Tidecall/Voidborn; got ${validation.regions.join(", ")}.`);
  }

  const recollectionCopies = deck.cards.filter((defId) => defId === RECOLLECTION_ID).length;
  const healCopies = deck.cards.filter((defId) => defId === "tide_heal").length;
  const stunCopies = deck.cards.filter((defId) => defId === STUN_ID).length;
  if (recollectionCopies !== 1 || healCopies !== 1 || stunCopies !== 2) {
    throw new Error(
      `Ecos Stun refinement ${variant} recipe drift: Recordação=${recollectionCopies}, Soothing=${healCopies}, Stun=${stunCopies}; expected 1/1/2.`,
    );
  }

  for (const starterId of STARTERS) {
    const starter = getDeck(starterId);
    if (starter.cards.some((defId) => defId.startsWith("rfalpha_reanimator_"))) {
      throw new Error(`Starter ${starterId} was contaminated by Ecos/Reanimator content.`);
    }
  }

  console.log(
    `ECOS ORDER-INVARIANT STUN REFINEMENT: ${variant} · replaced=${target} · Recordação=1x · Soothing=1x · Tide Stun=2x`,
  );
  await import("./ecos-do-abismo-balance-audit");
}

void main();
