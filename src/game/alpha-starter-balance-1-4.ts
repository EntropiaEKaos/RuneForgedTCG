import { getDeck, validateDeck } from "./decks";
import { SEMANTIC_ALPHA_CARDS } from "./cards/semantic-alpha";
import type { DeckInput } from "./types";
import type { AlphaStarterId } from "./alpha-starter-balance";

export const ALPHA_STARTER_BALANCE_1_4_VERSION = "1.4";

export type Balance14Family = "ember" | "tide";

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
  replacement: Balance14Replacement;
}

/**
 * Balance 1.4 starts from the certified zero-critical 1.3 recipes.
 *
 * The goal is watch compression, not raw power:
 *
 * - Emberhold is 40/60 into Tempestade but 58/42 into Ironwood. Its candidates
 *   replace one large-body/scaling pressure card with small-board interaction.
 * - Tidecall is 40.5/59.5 into Ironwood and 42.5/57.5 into Florestia while
 *   already 57/43 into Emberhold. Its candidates replace one pure anti-aggro
 *   Nexus heal with interaction that scales better against large boards.
 *
 * All candidates are one-slot read-only simulator overrides.
 */
export const BALANCE_1_4_CANDIDATES: readonly Balance14Candidate[] = [
  {
    id: "ember_soulblade_to_cinder",
    family: "ember",
    deckId: "ember_aggro",
    label: "Ember: Soulbrand -> Cinder Snap",
    rationale: "Trade premium scaling equipment for cheap 2-damage interaction that is stronger into Tempestade-sized bodies and weaker into Ironwood.",
    replacement: { from: "ember_soulblade", to: "ember_cinder" },
  },
  {
    id: "ember_soulblade_to_pyromancer",
    family: "ember",
    deckId: "ember_aggro",
    label: "Ember: Soulbrand -> Senior Pyromancer",
    rationale: "Trade premium scaling equipment for a 4-cost body with 1-damage enemy AoE, concentrating value on small-board matchups.",
    replacement: { from: "ember_soulblade", to: "ember_pyromancer" },
  },
  {
    id: "ember_wyrm_to_cinder",
    family: "ember",
    deckId: "ember_aggro",
    label: "Ember: Steamscale Wyrm -> Cinder Snap",
    rationale: "Remove the remaining Tough tribal amplifier that is efficient into Ironwood and replace it with cheap anti-small-body interaction.",
    replacement: { from: "ember_tide_wyrm", to: "ember_cinder" },
  },
  {
    id: "ember_wyrm_to_pyromancer",
    family: "ember",
    deckId: "ember_aggro",
    label: "Ember: Steamscale Wyrm -> Senior Pyromancer",
    rationale: "Keep the four-mana slot but exchange a resilient tribal amplifier for an anti-swarm summon effect.",
    replacement: { from: "ember_tide_wyrm", to: "ember_pyromancer" },
  },

  {
    id: "tide_heal_to_recall",
    family: "tide",
    deckId: "tide_control",
    label: "Tide: Soothing Tide -> Recall",
    rationale: "Reduce pure anti-aggro sustain while adding high-value tempo against large Ironwood and Florestia units.",
    replacement: { from: "tide_heal", to: "tide_recall" },
  },
  {
    id: "tide_heal_to_frostbite",
    family: "tide",
    deckId: "tide_control",
    label: "Tide: Soothing Tide -> Flash Freeze",
    rationale: "Trade Nexus healing for Burst power suppression that scales with large attackers.",
    replacement: { from: "tide_heal", to: "tide_frostbite" },
  },
  {
    id: "tide_heal_to_glacial",
    family: "tide",
    deckId: "tide_control",
    label: "Tide: Soothing Tide -> Glacial Tomb",
    rationale: "Trade anti-aggro sustain for a board-wide large-attack suppressor aimed at Wood and Florestia boards.",
    replacement: { from: "tide_heal", to: "tide_glacial" },
  },
  {
    id: "tide_heal_to_frostguard",
    family: "tide",
    deckId: "tide_control",
    label: "Tide: Soothing Tide -> Frost Guard",
    rationale: "Exchange pure Nexus healing for a resilient blocker that Frostbites attackers on block.",
    replacement: { from: "tide_heal", to: "tide_frostguard" },
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
  replaceFirst(cards, candidate.replacement.from, candidate.replacement.to);
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
      replaceFirst(cards, candidate.replacement.from, candidate.replacement.to);
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

  if (candidate.family === "ember" && candidate.deckId !== "ember_aggro") {
    errors.push(`${candidate.id}: Ember family must target ember_aggro`);
  }
  if (candidate.family === "tide" && candidate.deckId !== "tide_control") {
    errors.push(`${candidate.id}: Tide family must target tide_control`);
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
  if (changed.length !== 1) {
    errors.push(`${candidate.id}: expected exactly 1 changed recipe slot, found ${changed.length}`);
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

  if (familyCounts.get("ember") !== 4) errors.push("Balance 1.4 must define exactly four Ember candidates");
  if (familyCounts.get("tide") !== 4) errors.push("Balance 1.4 must define exactly four Tide candidates");

  return errors;
}
