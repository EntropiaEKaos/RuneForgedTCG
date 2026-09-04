import { getDeck, validateDeck } from "./decks";
import { SEMANTIC_ALPHA_CARDS } from "./cards/semantic-alpha";
import type { DeckInput } from "./types";
import type { AlphaStarterId } from "./alpha-starter-balance";

export const ALPHA_STARTER_BALANCE_1_3_VERSION = "1.3";

export interface Balance13Replacement {
  from: string;
  to: string;
}

export interface Balance13Candidate {
  id: string;
  deckId: AlphaStarterId;
  label: string;
  rationale: string;
  replacements: Balance13Replacement[];
}

/**
 * Balance 1.3 starts from the promoted 1.2 recipes.
 *
 * Ember × Ironwood is already repaired at 58/42, so exploration is Florestia-only.
 * Every candidate removes exactly two recipe slots whose value is concentrated
 * against large/resilient Ironwood bodies, then restores anti-aggro/anti-air
 * defensive value with Reach, Lifesteal or summon healing.
 */
export const BALANCE_1_3_CANDIDATES: readonly Balance13Candidate[] = [
  {
    id: "forest_pounce_recall_to_canopy_moonfang",
    deckId: "florestia_tribal",
    label: "Pounce+Recall -> Canopy+Moonfang",
    rationale: "Remove damage plus bounce against large Ironwood units; restore Reach and Lifesteal for Tempestade/Ember pressure.",
    replacements: [
      { from: "forest_predator_pounce", to: "forest_canopy_warden" },
      { from: "forest_primal_recall", to: "forest_moonfang" },
    ],
  },
  {
    id: "forest_pounce_entangle_to_canopy_moonfang",
    deckId: "florestia_tribal",
    label: "Pounce+Entangle -> Canopy+Moonfang",
    rationale: "Trade two unit-interaction slots for a Reach body plus Lifesteal without increasing tribal buff density.",
    replacements: [
      { from: "forest_predator_pounce", to: "forest_canopy_warden" },
      { from: "forest_entangle", to: "forest_moonfang" },
    ],
  },
  {
    id: "forest_pounce_moonsnare_to_canopy_moonfang",
    deckId: "florestia_tribal",
    label: "Pounce+Moon Snare -> Canopy+Moonfang",
    rationale: "Remove the remaining damage and Fast Stun package; compensate with anti-air Reach and anti-rush Lifesteal.",
    replacements: [
      { from: "forest_predator_pounce", to: "forest_canopy_warden" },
      { from: "forest_moon_snare", to: "forest_moonfang" },
    ],
  },
  {
    id: "forest_recall_moonsnare_to_canopy_moonfang",
    deckId: "florestia_tribal",
    label: "Recall+Moon Snare -> Canopy+Moonfang",
    rationale: "Reduce two tempo answers that scale well into large blockers while preserving aerial and racing defense.",
    replacements: [
      { from: "forest_primal_recall", to: "forest_canopy_warden" },
      { from: "forest_moon_snare", to: "forest_moonfang" },
    ],
  },
  {
    id: "forest_recall_thornfang_to_canopy_spirit",
    deckId: "florestia_tribal",
    label: "Recall+Thornfang -> Canopy+Spirit Guide",
    rationale: "Remove bounce plus Deathtouch, two premium anti-large-body tools; restore Reach and Nexus sustain.",
    replacements: [
      { from: "forest_primal_recall", to: "forest_canopy_warden" },
      { from: "forest_thornfang", to: "forest_spirit_guide" },
    ],
  },
  {
    id: "forest_pounce_thornfang_to_canopy_spirit",
    deckId: "florestia_tribal",
    label: "Pounce+Thornfang -> Canopy+Spirit Guide",
    rationale: "Remove direct damage plus Deathtouch while adding Reach and summon healing aimed at faster opponents.",
    replacements: [
      { from: "forest_predator_pounce", to: "forest_canopy_warden" },
      { from: "forest_thornfang", to: "forest_spirit_guide" },
    ],
  },
  {
    id: "forest_double_recall_to_canopy_moonfang",
    deckId: "florestia_tribal",
    label: "2×Recall -> Canopy+Moonfang",
    rationale: "Test the strongest bounce reduction while replacing it with anti-air and anti-rush defensive bodies.",
    replacements: [
      { from: "forest_primal_recall", to: "forest_canopy_warden" },
      { from: "forest_primal_recall", to: "forest_moonfang" },
    ],
  },
  {
    id: "forest_recall_dawnalpha_to_canopy_spirit",
    deckId: "florestia_tribal",
    label: "Recall+Dawn Alpha -> Canopy+Spirit Guide",
    rationale: "Reduce bounce plus Challenger pressure into resilient boards while keeping Reach and early Nexus sustain.",
    replacements: [
      { from: "forest_primal_recall", to: "forest_canopy_warden" },
      { from: "forest_dawn_alpha", to: "forest_spirit_guide" },
    ],
  },
] as const;

function replaceFirst(cards: string[], from: string, to: string): void {
  const index = cards.indexOf(from);
  if (index < 0) throw new Error(`Balance 1.3 candidate expected ${from} but it is absent`);
  cards[index] = to;
}

export function recipeForBalance13Candidate(candidate: Balance13Candidate): DeckInput {
  const base = getDeck(candidate.deckId);
  const cards = [...base.cards];
  for (const replacement of candidate.replacements) {
    replaceFirst(cards, replacement.from, replacement.to);
  }
  return { id: base.id, name: base.name, cards };
}

export function overridesForBalance13Candidate(candidate: Balance13Candidate): Record<string, DeckInput> {
  const deck = recipeForBalance13Candidate(candidate);
  return { [candidate.deckId]: deck };
}

export function validateBalance13Candidate(candidate: Balance13Candidate): string[] {
  const errors: string[] = [];
  let deck: DeckInput;
  try {
    deck = recipeForBalance13Candidate(candidate);
  } catch (error) {
    return [`${candidate.id}: ${error instanceof Error ? error.message : String(error)}`];
  }

  if (candidate.deckId !== "florestia_tribal") {
    errors.push(`${candidate.id}: Balance 1.3 exploration must remain Florestia-only`);
  }
  if (candidate.replacements.length !== 2) {
    errors.push(`${candidate.id}: expected exactly 2 recipe replacements`);
  }
  if (deck.cards.length !== 40) errors.push(`${candidate.id}: expected 40 cards, found ${deck.cards.length}`);

  const legality = validateDeck(deck.cards);
  if (!legality.ok) errors.push(`${candidate.id}: illegal recipe — ${legality.errors.join(" | ")}`);

  const semanticTeachingCards = deck.cards.filter((defId) => defId in SEMANTIC_ALPHA_CARDS);
  if (semanticTeachingCards.length !== 3) {
    errors.push(`${candidate.id}: expected exactly 3 semantic teaching cards, found ${semanticTeachingCards.length}`);
  }

  const base = getDeck(candidate.deckId).cards;
  const changed = deck.cards.reduce<number[]>(
    (indexes, defId, index) => (defId === base[index] ? indexes : [...indexes, index]),
    [],
  );
  if (changed.length !== 2) {
    errors.push(`${candidate.id}: expected exactly 2 changed recipe slots, found ${changed.length}`);
  }

  return errors;
}

export function validateBalance13CandidateSet(): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const candidate of BALANCE_1_3_CANDIDATES) {
    if (ids.has(candidate.id)) errors.push(`duplicate candidate id ${candidate.id}`);
    ids.add(candidate.id);
    errors.push(...validateBalance13Candidate(candidate));
  }
  return errors;
}
