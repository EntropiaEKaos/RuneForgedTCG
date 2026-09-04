import { getDeck, validateDeck } from "./decks";
import { SEMANTIC_ALPHA_CARDS } from "./cards/semantic-alpha";
import type { DeckInput } from "./types";
import type { AlphaStarterId } from "./alpha-starter-balance";

export const ALPHA_STARTER_BALANCE_1_4_VERSION = "1.4";

export interface Balance14Replacement {
  from: string;
  to: string;
}

export interface Balance14Candidate {
  id: string;
  deckId: AlphaStarterId;
  label: string;
  rationale: string;
  replacements: readonly Balance14Replacement[];
}

/**
 * Round 3 narrows the experiment to Tidecall only.
 *
 * Round 2 showed that Tempestade changes can improve Wood × Tempestade, but
 * every tested storm change pushed Ember × Tempestade below the certified
 * 40/60 floor. Tide changes, however, improved Ember × Tide and Tide × Wood.
 *
 * Round 3 therefore freezes Emberhold, Tempestade, Ironwood and Florestia and
 * runs full 3,000-game matrices for four Tide-only packages.
 */
export const BALANCE_1_4_CANDIDATES: readonly Balance14Candidate[] = [
  {
    id: "tide_heal_dispel_to_recall_glacial",
    deckId: "tide_control",
    label: "Tide: Heal+Dispel -> Recall+Glacial",
    rationale: "Best Round-2 Tide package: trade one anti-aggro heal plus one stranded Dispel for large-body bounce and board-wide Frostbite.",
    replacements: [
      { from: "tide_heal", to: "tide_recall" },
      { from: "tide_dispel", to: "tide_glacial" },
    ],
  },
  {
    id: "tide_heal_dispel_to_recall_frostbite",
    deckId: "tide_control",
    label: "Tide: Heal+Dispel -> Recall+Freeze",
    rationale: "Keep the anti-aggro compensation while converting stranded Dispel into a second large-body answer.",
    replacements: [
      { from: "tide_heal", to: "tide_recall" },
      { from: "tide_dispel", to: "tide_frostbite" },
    ],
  },
  {
    id: "tide_dispel_to_recall",
    deckId: "tide_control",
    label: "Tide: Dispel -> Recall",
    rationale: "Single-slot utilization fix: replace one highly target-starved permanent answer with bounce while retaining both heals.",
    replacements: [{ from: "tide_dispel", to: "tide_recall" }],
  },
  {
    id: "tide_dispel_to_glacial",
    deckId: "tide_control",
    label: "Tide: Dispel -> Glacial Tomb",
    rationale: "Single-slot utilization fix: replace one highly target-starved permanent answer with board-wide Frostbite while retaining both heals.",
    replacements: [{ from: "tide_dispel", to: "tide_glacial" }],
  },
] as const;

function replaceFirst(cards: string[], from: string, to: string): void {
  const index = cards.indexOf(from);
  if (index < 0) throw new Error(`Balance 1.4 candidate expected ${from} but it is absent`);
  cards[index] = to;
}

export function recipeForBalance14Candidate(candidate: Balance14Candidate): DeckInput {
  const base = getDeck(candidate.deckId);
  const cards = [...base.cards];
  for (const replacement of candidate.replacements) {
    replaceFirst(cards, replacement.from, replacement.to);
  }
  return { id: base.id, name: base.name, cards };
}

export function overridesForBalance14Candidate(candidate: Balance14Candidate): Record<string, DeckInput> {
  const deck = recipeForBalance14Candidate(candidate);
  return { [candidate.deckId]: deck };
}

export function validateBalance14Candidate(candidate: Balance14Candidate): string[] {
  const errors: string[] = [];
  let deck: DeckInput;
  try {
    deck = recipeForBalance14Candidate(candidate);
  } catch (error) {
    return [`${candidate.id}: ${error instanceof Error ? error.message : String(error)}`];
  }

  if (candidate.deckId !== "tide_control") {
    errors.push(`${candidate.id}: Balance 1.4 Round 3 must remain Tide-only`);
  }
  if (candidate.replacements.length < 1 || candidate.replacements.length > 2) {
    errors.push(`${candidate.id}: expected one or two replacements`);
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
  if (changed.length !== candidate.replacements.length) {
    errors.push(
      `${candidate.id}: expected exactly ${candidate.replacements.length} changed recipe slots, found ${changed.length}`,
    );
  }

  return errors;
}

export function validateBalance14CandidateSet(): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const candidate of BALANCE_1_4_CANDIDATES) {
    if (ids.has(candidate.id)) errors.push(`duplicate candidate id ${candidate.id}`);
    ids.add(candidate.id);
    errors.push(...validateBalance14Candidate(candidate));
  }
  if (BALANCE_1_4_CANDIDATES.length !== 4) {
    errors.push(`Balance 1.4 Round 3 must define exactly four Tide candidates, found ${BALANCE_1_4_CANDIDATES.length}`);
  }
  return errors;
}
