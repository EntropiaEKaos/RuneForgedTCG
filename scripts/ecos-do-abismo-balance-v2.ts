import { CARDS } from "../src/game/cards";
import { getDeck, validateDeck } from "../src/game/decks";

async function main(): Promise<void> {
  const deck = getDeck("ecos_do_abismo");
  const cards = [...deck.cards];

  function removeOne(defId: string): void {
    const index = cards.indexOf(defId);
    if (index < 0) throw new Error(`Recipe v25 expected ${defId} in Ecos do Abismo v1.`);
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
    "void_stalker",
  ]) removeOne(defId);

  cards.push(
    "tide_heal", "tide_heal", "tide_heal",
    "tide_sprite", "tide_sprite",
    "tide_guard",
    "tide_glacial", "tide_glacial",
    "tide_freeze", "tide_freeze", "tide_freeze",
    "void_hexer", "void_hexer", "void_hexer",
    "void_unmake",
    "tide_frostbite",
  );

  const colossusId = "rfalpha_reanimator_hollow_rift_colossus";
  const colossus = CARDS[colossusId];
  if (!colossus) throw new Error("Recipe v25 expected Hollow Rift Colossus in the canonical catalog.");
  CARDS[colossusId] = {
    ...colossus,
    keywords: (colossus.keywords ?? []).filter((keyword) => keyword !== "Overwhelm"),
  };

  if (cards.length !== 40) throw new Error(`Recipe v25 must remain exactly 40 cards; got ${cards.length}.`);
  const validation = validateDeck(cards);
  if (!validation.ok) throw new Error(`Recipe v25 is illegal: ${validation.errors.join(" | ")}`);
  if (validation.regions.length !== 2 || !validation.regions.includes("Tidecall") || !validation.regions.includes("Voidborn")) {
    throw new Error(`Recipe v25 must remain Tidecall/Voidborn; got ${validation.regions.join(", ")}.`);
  }

  deck.cards.splice(0, deck.cards.length, ...cards);
  console.log("ECOS RECIPE V25 CANDIDATE: v24 · -1 Void Stalker +1 Flash Freeze · preserve tribal defense, soften slow pressure");

  await import("./ecos-do-abismo-balance-audit");
}

void main();
