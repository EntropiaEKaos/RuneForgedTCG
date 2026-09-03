import { getDeck, validateDeck } from "../src/game/decks";

async function main(): Promise<void> {
  const deck = getDeck("ecos_do_abismo");
  const cards = [...deck.cards];

  function removeOne(defId: string): void {
    const index = cards.indexOf(defId);
    if (index < 0) throw new Error(`Recipe v3 expected ${defId} in Ecos do Abismo v1.`);
    cards.splice(index, 1);
  }

  for (const defId of [
    "tide_deny",
    "tide_deny",
    "tide_draw",
    "tide_draw",
    "rfalpha_reanimator_seal_nothing",
    "void_champion",
    "tide_recall",
    "tide_recall",
    "void_unmake",
  ]) removeOne(defId);

  cards.push(
    "tide_heal", "tide_heal", "tide_heal",
    "tide_sprite", "tide_sprite",
    "tide_guard",
    "tide_glacial", "tide_glacial",
    "void_reaper",
  );

  if (cards.length !== 40) throw new Error(`Recipe v3 must remain exactly 40 cards; got ${cards.length}.`);
  const validation = validateDeck(cards);
  if (!validation.ok) throw new Error(`Recipe v3 is illegal: ${validation.errors.join(" | ")}`);
  if (validation.regions.length !== 2 || !validation.regions.includes("Tidecall") || !validation.regions.includes("Voidborn")) {
    throw new Error(`Recipe v3 must remain Tidecall/Voidborn; got ${validation.regions.join(", ")}.`);
  }

  deck.cards.splice(0, deck.cards.length, ...cards);
  console.log("ECOS RECIPE V3 CANDIDATE: v2 stabilization + -2 recall -1 unmake · +2 Glacial Tomb +1 Soul Reaper");

  await import("./ecos-do-abismo-balance-audit");
}

void main();
