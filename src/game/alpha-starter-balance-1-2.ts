import { getDeck, validateDeck } from "./decks";
import { SEMANTIC_ALPHA_CARDS } from "./cards/semantic-alpha";
import type { DeckInput } from "./types";
import type { AlphaStarterId } from "./alpha-starter-balance";

export const ALPHA_STARTER_BALANCE_1_2_VERSION = "1.2";

export type Balance12Family = "ember" | "florestia";

export interface Balance12Candidate {
  id: string;
  family: Balance12Family;
  deckId: AlphaStarterId;
  label: string;
  rationale: string;
  from: string;
  to: string;
}

/**
 * Round 3 abandons Wood-only power increases. It redistributes power on the
 * two winning sides using matchup-specific replacements:
 *
 * - Ember loses Shatterforge (permanent hate, disproportionately useful into
 *   Ironwood) for small-unit/AoE interaction that better protects Tempestade.
 * - Florestia loses Recall/Pounce interaction into large Ironwood bodies for
 *   Reach bodies that protect its fragile Tempestade matchup.
 */
export const BALANCE_1_2_CANDIDATES: readonly Balance12Candidate[] = [
  {
    id: "ember_shatter_to_cinder",
    family: "ember",
    deckId: "ember_aggro",
    label: "Ember: Shatter -> Cinder Snap",
    rationale: "Trade dead/permanent hate for Burst 2 damage: useful into small Tempestade units, weak against Ironwood's larger bodies.",
    from: "ember_shatter",
    to: "ember_cinder",
  },
  {
    id: "ember_shatter_to_emberstorm",
    family: "ember",
    deckId: "ember_aggro",
    label: "Ember: Shatter -> Emberstorm",
    rationale: "Replace permanent hate with 2-damage AoE, explicitly shifting value toward Tempestade/swarm boards and away from Ironwood.",
    from: "ember_shatter",
    to: "ember_rain",
  },
  {
    id: "ember_shatter_to_flare",
    family: "ember",
    deckId: "ember_aggro",
    label: "Ember: Shatter -> second Flare Line",
    rationale: "Replace matchup-specific permanent destruction with slower 2-damage unit interaction plus 1 Nexus damage.",
    from: "ember_shatter",
    to: "ember_flare_line",
  },
  {
    id: "ember_shatter_to_stun",
    family: "ember",
    deckId: "ember_aggro",
    label: "Ember: Shatter -> third Flame Lash",
    rationale: "Replace permanent hate with low-damage tempo, preserving Ember identity while reducing direct answers to Ironwood permanents.",
    from: "ember_shatter",
    to: "ember_stun",
  },

  {
    id: "forest_recall_to_canopy",
    family: "florestia",
    deckId: "florestia_tribal",
    label: "Florestia: Recall -> third Canopy Warden",
    rationale: "Remove one 4-mana answer to large Ironwood units and replace it with 3/4 Reach to preserve Tempestade defense.",
    from: "forest_primal_recall",
    to: "forest_canopy_warden",
  },
  {
    id: "forest_recall_to_webweaver",
    family: "florestia",
    deckId: "florestia_tribal",
    label: "Florestia: Recall -> third Webweaver",
    rationale: "Trade one high-value answer to large Ironwood units for a lower-power 2/4 Reach body.",
    from: "forest_primal_recall",
    to: "wood_webweaver",
  },
  {
    id: "forest_pounce_to_canopy",
    family: "florestia",
    deckId: "florestia_tribal",
    label: "Florestia: Pounce -> third Canopy Warden",
    rationale: "Reduce direct damage interaction into Ironwood while adding anti-air body density.",
    from: "forest_predator_pounce",
    to: "forest_canopy_warden",
  },
  {
    id: "forest_pounce_to_webweaver",
    family: "florestia",
    deckId: "florestia_tribal",
    label: "Florestia: Pounce -> third Webweaver",
    rationale: "Reduce direct removal into Ironwood and add the lowest-power Reach replacement for Tempestade protection.",
    from: "forest_predator_pounce",
    to: "wood_webweaver",
  },
] as const;

function replaceFirst(cards: string[], from: string, to: string): void {
  const index = cards.indexOf(from);
  if (index < 0) throw new Error(`Balance 1.2 candidate expected ${from} but it is absent`);
  cards[index] = to;
}

export function recipeForCandidate(candidate: Balance12Candidate): DeckInput {
  const base = getDeck(candidate.deckId);
  const cards = [...base.cards];
  replaceFirst(cards, candidate.from, candidate.to);
  return { id: base.id, name: base.name, cards };
}

export function overridesForCandidates(
  candidates: readonly Balance12Candidate[],
): Record<string, DeckInput> {
  const byDeck = new Map<AlphaStarterId, Balance12Candidate[]>();
  for (const candidate of candidates) {
    const current = byDeck.get(candidate.deckId) ?? [];
    current.push(candidate);
    byDeck.set(candidate.deckId, current);
  }

  const overrides: Record<string, DeckInput> = {};
  for (const [deckId, deckCandidates] of byDeck) {
    const base = getDeck(deckId);
    const cards = [...base.cards];
    for (const candidate of deckCandidates) replaceFirst(cards, candidate.from, candidate.to);
    overrides[deckId] = { id: base.id, name: base.name, cards };
  }
  return overrides;
}

export function validateCandidate(candidate: Balance12Candidate): string[] {
  const errors: string[] = [];
  let deck: DeckInput;
  try {
    deck = recipeForCandidate(candidate);
  } catch (error) {
    return [`${candidate.id}: ${error instanceof Error ? error.message : String(error)}`];
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
  if (changed.length !== 1) errors.push(`${candidate.id}: expected exactly one changed recipe slot, found ${changed.length}`);

  return errors;
}

export function validateCandidateSet(): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const candidate of BALANCE_1_2_CANDIDATES) {
    if (ids.has(candidate.id)) errors.push(`duplicate candidate id ${candidate.id}`);
    ids.add(candidate.id);
    errors.push(...validateCandidate(candidate));
  }
  return errors;
}
