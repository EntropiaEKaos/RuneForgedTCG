import { CARDS } from "../src/game/cards";
import { getDeck, validateDeck } from "../src/game/decks";

type RecipeVariant =
  | "v26"
  | "reaper_for_freeze"
  | "sprite_for_freeze"
  | "draw_for_freeze"
  | "thread_for_freeze"
  | "heal_for_freeze"
  | "reaper_thread_for_heal"
  | "reaper_draw_for_heal"
  | "reaper_sprite_for_heal"
  | "reaper_unmake_for_heal";

const variant = (process.env.ECOS_RECIPE_VARIANT ?? "v26") as RecipeVariant;
const allowedVariants = new Set<RecipeVariant>([
  "v26",
  "reaper_for_freeze",
  "sprite_for_freeze",
  "draw_for_freeze",
  "thread_for_freeze",
  "heal_for_freeze",
  "reaper_thread_for_heal",
  "reaper_draw_for_heal",
  "reaper_sprite_for_heal",
  "reaper_unmake_for_heal",
]);

async function main(): Promise<void> {
  if (!allowedVariants.has(variant)) throw new Error(`Unknown Ecos recipe variant: ${variant}`);

  const deck = getDeck("ecos_do_abismo");
  const cards = [...deck.cards];

  function removeOne(defId: string): void {
    const index = cards.indexOf(defId);
    if (index < 0) throw new Error(`Recipe grid expected ${defId} in Ecos do Abismo candidate ${variant}.`);
    cards.splice(index, 1);
  }

  for (const defId of [
    "tide_deny",
    "tide_deny",
    "tide_draw",
    "tide_draw",
    "rfalpha_reanimator_seal_nothing",
    "rfalpha_reanimator_seal_nothing",
    "void_champion",
    "tide_recall",
    "tide_recall",
    "void_unmake",
    "void_unmake",
    "rfalpha_reanimator_dead_memory_thread",
    "rfalpha_reanimator_second_pulse",
    "rfalpha_reanimator_drowned_mirror_lady",
    "rfalpha_reanimator_drowned_mirror_lady",
  ]) removeOne(defId);

  cards.push(
    "tide_heal", "tide_heal",
    "tide_sprite", "tide_sprite",
    "tide_guard",
    "tide_glacial", "tide_glacial",
    "tide_freeze", "tide_freeze", "tide_freeze",
    "void_hexer", "void_hexer", "void_hexer",
    "void_unmake",
    "void_wither",
  );

  const firstGridSwaps: Partial<Record<RecipeVariant, string>> = {
    reaper_for_freeze: "void_reaper",
    sprite_for_freeze: "tide_sprite",
    draw_for_freeze: "tide_draw",
    thread_for_freeze: "rfalpha_reanimator_dead_memory_thread",
    heal_for_freeze: "tide_heal",
  };

  const reaperRefinements: Partial<Record<RecipeVariant, string>> = {
    reaper_thread_for_heal: "rfalpha_reanimator_dead_memory_thread",
    reaper_draw_for_heal: "tide_draw",
    reaper_sprite_for_heal: "tide_sprite",
    reaper_unmake_for_heal: "void_unmake",
  };

  const firstGridReplacement = firstGridSwaps[variant];
  if (firstGridReplacement) {
    removeOne("tide_freeze");
    cards.push(firstGridReplacement);
  }

  const reaperRefinement = reaperRefinements[variant];
  if (reaperRefinement) {
    removeOne("tide_freeze");
    cards.push("void_reaper");
    removeOne("tide_heal");
    cards.push(reaperRefinement);
  }

  const colossusId = "rfalpha_reanimator_hollow_rift_colossus";
  const colossus = CARDS[colossusId];
  if (!colossus) throw new Error("Recipe grid expected Hollow Rift Colossus in the canonical catalog.");
  CARDS[colossusId] = {
    ...colossus,
    keywords: (colossus.keywords ?? []).filter((keyword) => keyword !== "Overwhelm" && keyword !== "Fearsome"),
  };

  if (cards.length !== 40) throw new Error(`Recipe ${variant} must remain exactly 40 cards; got ${cards.length}.`);
  const validation = validateDeck(cards);
  if (!validation.ok) throw new Error(`Recipe ${variant} is illegal: ${validation.errors.join(" | ")}`);
  if (validation.regions.length !== 2 || !validation.regions.includes("Tidecall") || !validation.regions.includes("Voidborn")) {
    throw new Error(`Recipe ${variant} must remain Tidecall/Voidborn; got ${validation.regions.join(", ")}.`);
  }

  deck.cards.splice(0, deck.cards.length, ...cards);
  console.log(`ECOS RECIPE GRID: ${variant} · v26 foundation · fully blockable Colossus`);

  await import("./ecos-do-abismo-balance-audit");
}

void main();
