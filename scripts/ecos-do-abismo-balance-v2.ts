import { getDeck, validateDeck } from "../src/game/decks";

type CanonicalRefinement =
  | "baseline"
  | "guard_to_assassin"
  | "guard_to_thread"
  | "guard_to_voidmage"
  | "guard_to_gloom_warden"
  | "guard_to_deathmark";

const variant = (process.env.ECOS_RECIPE_VARIANT ?? "baseline") as CanonicalRefinement;
const allowed = new Set<CanonicalRefinement>([
  "baseline",
  "guard_to_assassin",
  "guard_to_thread",
  "guard_to_voidmage",
  "guard_to_gloom_warden",
  "guard_to_deathmark",
]);

async function main(): Promise<void> {
  if (!allowed.has(variant)) throw new Error(`Unknown canonical Ecos refinement: ${variant}`);

  const deck = getDeck("ecos_do_abismo");
  const cards = [...deck.cards];

  function removeOne(defId: string): void {
    const index = cards.indexOf(defId);
    if (index < 0) throw new Error(`Canonical refinement ${variant} expected ${defId}.`);
    cards.splice(index, 1);
  }

  const replacements: Partial<Record<CanonicalRefinement, string>> = {
    guard_to_assassin: "void_assassin",
    guard_to_thread: "rfalpha_reanimator_dead_memory_thread",
    guard_to_voidmage: "void_voidmage",
    guard_to_gloom_warden: "void_gloom_warden",
    guard_to_deathmark: "void_deathmark",
  };

  const replacement = replacements[variant];
  if (replacement) {
    removeOne("tide_guard");
    cards.push(replacement);
  }

  if (cards.length !== 40) throw new Error(`Canonical refinement ${variant} must contain exactly 40 cards; got ${cards.length}.`);

  const validation = validateDeck(cards);
  if (!validation.ok) throw new Error(`Canonical refinement ${variant} is illegal: ${validation.errors.join(" | ")}`);
  if (validation.regions.length !== 2 || !validation.regions.includes("Tidecall") || !validation.regions.includes("Voidborn")) {
    throw new Error(`Canonical refinement ${variant} must remain Tidecall/Voidborn; got ${validation.regions.join(", ")}.`);
  }

  deck.cards.splice(0, deck.cards.length, ...cards);
  console.log(`ECOS CANONICAL REFINEMENT: ${variant}`);
  await import("./ecos-do-abismo-balance-audit");
}

void main();
