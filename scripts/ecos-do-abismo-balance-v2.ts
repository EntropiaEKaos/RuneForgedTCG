import { getDeck, validateDeck } from "../src/game/decks";

const deck = getDeck("ecos_do_abismo");
const cards = [...deck.cards];

function removeOne(defId: string): void {
  const index = cards.indexOf(defId);
  if (index < 0) throw new Error(`Recipe v2 expected ${defId} in Ecos do Abismo v1.`);
  cards.splice(index, 1);
}

for (const defId of [
  "tide_deny",
  "tide_deny",
  "tide_draw",
  "tide_draw",
  "rfalpha_reanimator_seal_nothing",
  "void_champion",
]) removeOne(defId);

cards.push(
  "tide_heal", "tide_heal", "tide_heal",
  "tide_sprite", "tide_sprite",
  "tide_guard",
);

if (cards.length !== 40) throw new Error(`Recipe v2 must remain exactly 40 cards; got ${cards.length}.`);
const validation = validateDeck(cards);
if (!validation.ok) throw new Error(`Recipe v2 is illegal: ${validation.errors.join(" | ")}`);
if (validation.regions.length !== 2 || !validation.regions.includes("Tidecall") || !validation.regions.includes("Voidborn")) {
  throw new Error(`Recipe v2 must remain Tidecall/Voidborn; got ${validation.regions.join(", ")}.`);
}

deck.cards.splice(0, deck.cards.length, ...cards);
console.log("ECOS RECIPE V2 CANDIDATE: 40 cards · -2 deny -2 draw -1 hate -1 late champion · +3 heal +2 sprite +1 guard");

await import("./ecos-do-abismo-balance-audit.ts");
