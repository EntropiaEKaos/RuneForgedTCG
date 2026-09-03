import { getDeck, validateDeck } from "../src/game/decks";

async function main(): Promise<void> {
  const deck = getDeck("ecos_do_abismo");
  if (deck.cards.length !== 40) throw new Error(`Canonical Ecos do Abismo must contain exactly 40 cards; got ${deck.cards.length}.`);

  const validation = validateDeck(deck.cards);
  if (!validation.ok) throw new Error(`Canonical Ecos do Abismo is illegal: ${validation.errors.join(" | ")}`);
  if (validation.regions.length !== 2 || !validation.regions.includes("Tidecall") || !validation.regions.includes("Voidborn")) {
    throw new Error(`Canonical Ecos do Abismo must remain Tidecall/Voidborn; got ${validation.regions.join(", ")}.`);
  }

  console.log("ECOS CANONICAL BALANCE: Gloom Warden refinement · Living Nightmare midgame · fully blockable Hollow Rift Colossus");
  await import("./ecos-do-abismo-balance-audit");
}

void main();
