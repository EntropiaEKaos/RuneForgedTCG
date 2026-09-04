import { getDeck, validateDeck } from "./decks";
import { SEMANTIC_ALPHA_CARDS } from "./cards/semantic-alpha";
import type { DeckInput } from "./types";
import type { AlphaStarterId } from "./alpha-starter-balance";

export const ALPHA_STARTER_BALANCE_1_4_VERSION = "1.4";

export type Balance14Family = "storm" | "tide";

export interface Balance14Replacement {
  from: string;
  to: string;
}

export interface Balance14Candidate {
  id: string;
  family: Balance14Family;
  deckId: AlphaStarterId;
  label: string;
  rationale: string;
  replacements: readonly Balance14Replacement[];
}

/**
 * Round 2 follows a rejected Round 1.
 *
 * Round 1 proved that removing Ember scaling could compress watches globally,
 * but it recreated Ember × Tempestade as a critical. Round 2 therefore leaves
 * Emberhold untouched and redistributes power on Tempestade's winning side.
 *
 * Tidecall also pivots from one-slot heal removal to two-slot packages:
 * one anti-aggro heal plus one highly stranded Dispel become large-board
 * interaction. This aims to help Tide into Wood/Florestia without making its
 * Ember matchup stronger.
 */
export const BALANCE_1_4_CANDIDATES: readonly Balance14Candidate[] = [
  {
    id: "storm_emberbolt_to_gale",
    family: "storm",
    deckId: "tempestade_rush",
    label: "Tempestade: Ember Bolt -> Gale",
    rationale: "Trade cheap 3-damage removal that punishes fragile Ember units for bounce that scales better into large Ironwood bodies.",
    replacements: [{ from: "ember_bolt", to: "storm_gale" }],
  },
  {
    id: "storm_chainbolt_to_gale",
    family: "storm",
    deckId: "tempestade_rush",
    label: "Tempestade: Chain Bolt -> Gale",
    rationale: "Trade cheap damage plus Nexus chip for higher-cost bounce, softening small-unit pressure while improving large-body tempo.",
    replacements: [{ from: "storm_chain_bolt", to: "storm_gale" }],
  },
  {
    id: "storm_emberbolt_to_thunderangel",
    family: "storm",
    deckId: "tempestade_rush",
    label: "Tempestade: Ember Bolt -> Thunder Angel",
    rationale: "Reduce cheap removal density and add a five-mana Flying/Lifesteal threat that should scale better in slower Ironwood games.",
    replacements: [{ from: "ember_bolt", to: "storm_thunder_angel" }],
  },
  {
    id: "storm_chainbolt_to_thunderangel",
    family: "storm",
    deckId: "tempestade_rush",
    label: "Tempestade: Chain Bolt -> Thunder Angel",
    rationale: "Remove small-unit burn plus Nexus chip and add a slower resilient aerial threat.",
    replacements: [{ from: "storm_chain_bolt", to: "storm_thunder_angel" }],
  },

  {
    id: "tide_heal_dispel_to_recall_frostbite",
    family: "tide",
    deckId: "tide_control",
    label: "Tide: Heal+Dispel -> Recall+Freeze",
    rationale: "Remove one anti-aggro heal and one stranded permanent answer; add two large-body tempo tools.",
    replacements: [
      { from: "tide_heal", to: "tide_recall" },
      { from: "tide_dispel", to: "tide_frostbite" },
    ],
  },
  {
    id: "tide_heal_dispel_to_recall_glacial",
    family: "tide",
    deckId: "tide_control",
    label: "Tide: Heal+Dispel -> Recall+Glacial",
    rationale: "Convert anti-aggro sustain plus stranded permanent interaction into single-target bounce and board-wide attack suppression.",
    replacements: [
      { from: "tide_heal", to: "tide_recall" },
      { from: "tide_dispel", to: "tide_glacial" },
    ],
  },
  {
    id: "tide_heal_dispel_to_frostbite_glacial",
    family: "tide",
    deckId: "tide_control",
    label: "Tide: Heal+Dispel -> Freeze+Glacial",
    rationale: "Trade sustain and target-starved permanent removal for one single-target and one board-wide Frostbite effect.",
    replacements: [
      { from: "tide_heal", to: "tide_frostbite" },
      { from: "tide_dispel", to: "tide_glacial" },
    ],
  },
  {
    id: "tide_heal_dispel_to_recall_frostguard",
    family: "tide",
    deckId: "tide_control",
    label: "Tide: Heal+Dispel -> Recall+Frost Guard",
    rationale: "Move from pure sustain plus stranded interaction to large-unit tempo and a resilient blocker that Frostbites attackers.",
    replacements: [
      { from: "tide_heal", to: "tide_recall" },
      { from: "tide_dispel", to: "tide_frostguard" },
    ],
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

export function overridesForBalance14Candidates(
  candidates: readonly Balance14Candidate[],
): Record<string, DeckInput> {
  const byDeck = new Map<AlphaStarterId, Balance14Candidate[]>();
  for (const candidate of candidates) {
    const current = byDeck.get(candidate.deckId) ?? [];
    current.push(candidate);
    byDeck.set(candidate.deckId, current);
  }

  const overrides: Record<string, DeckInput> = {};
  for (const [deckId, deckCandidates] of byDeck) {
    const base = getDeck(deckId);
    const cards = [...base.cards];
    for (const candidate of deckCandidates) {
      for (const replacement of candidate.replacements) {
        replaceFirst(cards, replacement.from, replacement.to);
      }
    }
    overrides[deckId] = { id: base.id, name: base.name, cards };
  }
  return overrides;
}

export function validateBalance14Candidate(candidate: Balance14Candidate): string[] {
  const errors: string[] = [];
  let deck: DeckInput;
  try {
    deck = recipeForBalance14Candidate(candidate);
  } catch (error) {
    return [`${candidate.id}: ${error instanceof Error ? error.message : String(error)}`];
  }

  if (candidate.family === "storm" && candidate.deckId !== "tempestade_rush") {
    errors.push(`${candidate.id}: Storm family must target tempestade_rush`);
  }
  if (candidate.family === "tide" && candidate.deckId !== "tide_control") {
    errors.push(`${candidate.id}: Tide family must target tide_control`);
  }

  const expectedChanges = candidate.family === "storm" ? 1 : 2;
  if (candidate.replacements.length !== expectedChanges) {
    errors.push(`${candidate.id}: expected exactly ${expectedChanges} replacements`);
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
  if (changed.length !== expectedChanges) {
    errors.push(`${candidate.id}: expected exactly ${expectedChanges} changed recipe slots, found ${changed.length}`);
  }

  return errors;
}

export function validateBalance14CandidateSet(): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const familyCounts = new Map<Balance14Family, number>();

  for (const candidate of BALANCE_1_4_CANDIDATES) {
    if (ids.has(candidate.id)) errors.push(`duplicate candidate id ${candidate.id}`);
    ids.add(candidate.id);
    familyCounts.set(candidate.family, (familyCounts.get(candidate.family) ?? 0) + 1);
    errors.push(...validateBalance14Candidate(candidate));
  }

  if (familyCounts.get("storm") !== 4) errors.push("Balance 1.4 Round 2 must define exactly four Tempestade candidates");
  if (familyCounts.get("tide") !== 4) errors.push("Balance 1.4 Round 2 must define exactly four Tide candidates");

  return errors;
}
