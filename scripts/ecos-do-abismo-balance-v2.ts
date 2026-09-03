import { getDeck, validateDeck } from "../src/game/decks";

type CanonicalRefinement =
  | "gloom_to_thread"
  | "gloom_to_assassin"
  | "gloom_to_deathmark"
  | "gloom_to_voidmage"
  | "gloom_to_draw";

const variant = (process.env.ECOS_RECIPE_VARIANT ?? "gloom_to_thread") as CanonicalRefinement;
const replacements: Record<CanonicalRefinement, string> = {
  gloom_to_thread: "rfalpha_reanimator_dead_memory_thread",
  gloom_to_assassin: "void_assassin",
  gloom_to_deathmark: "void_deathmark",
  gloom_to_voidmage: "void_voidmage",
  gloom_to_draw: "tide_draw",
};

async function main(): Promise<void> {
  const replacement = replacements[variant];
  if (!replacement) throw new Error(`Unknown canonical Ecos refinement: ${variant}`);

  const deck = getDeck("ecos_do_abismo");
  const cards = [...deck.cards];

  const gloomIndex = cards.indexOf("void_gloom_warden");
  if (gloomIndex < 0) throw new Error(`Canonical refinement ${variant} expected one void_gloom_warden.`);
  cards.splice(gloomIndex, 1);
  cards.push(replacement);

  if (cards.length !== 40) throw new Error(`Canonical refinement ${variant} must contain exactly 40 cards; got ${cards.length}.`);

  const validation = validateDeck(cards);
  if (!validation.ok) throw new Error(`Canonical refinement ${variant} is illegal: ${validation.errors.join(" | ")}`);
  if (validation.regions.length !== 2 || !validation.regions.includes("Tidecall") || !validation.regions.includes("Voidborn")) {
    throw new Error(`Canonical refinement ${variant} must remain Tidecall/Voidborn; got ${validation.regions.join(", ")}.`);
  }

  deck.cards.splice(0, deck.cards.length, ...cards);
  console.log(`ECOS 4K TRIAD REFINEMENT: ${variant}`);
  await import("./ecos-do-abismo-balance-audit");
}

void main();
