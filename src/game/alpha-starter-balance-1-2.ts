import { getDeck, validateDeck } from "./decks";
import { SEMANTIC_ALPHA_CARDS } from "./cards/semantic-alpha";
import type { DeckInput } from "./types";
import type { AlphaStarterId } from "./alpha-starter-balance";

export const ALPHA_STARTER_BALANCE_1_2_VERSION = "1.2";

export type Balance12Family = "ember" | "florestia";

export interface Balance12Replacement {
  from: string;
  to: string;
}

export interface Balance12Candidate {
  id: string;
  family: Balance12Family;
  deckId: AlphaStarterId;
  label: string;
  rationale: string;
  replacements: Balance12Replacement[];
}

/**
 * Round 4 increases the same matchup-specific redistribution tested in Round 3
 * to two recipe slots per deck.
 *
 * Ember loses Shatterforge plus one pressure piece whose value is high into
 * large resilient blockers, receiving low-damage tempo/AoE that is better into
 * small Tempestade boards.
 *
 * Florestia loses Predator Pounce plus a second removal/tempo slot, receiving
 * Reach + Barrier/defensive bodies so its Tempestade matchup remains protected.
 */
export const BALANCE_1_2_CANDIDATES: readonly Balance12Candidate[] = [
  {
    id: "ember_shatter_soulblade_to_stun_rain",
    family: "ember",
    deckId: "ember_aggro",
    label: "Ember: Shatter+Soulbrand -> Lash+Emberstorm",
    rationale: "Remove permanent hate plus premium +2/+1 Overwhelm equipment; replace with low-damage Stun and anti-swarm AoE.",
    replacements: [
      { from: "ember_shatter", to: "ember_stun" },
      { from: "ember_soulblade", to: "ember_rain" },
    ],
  },
  {
    id: "ember_shatter_blade_to_stun_rain",
    family: "ember",
    deckId: "ember_aggro",
    label: "Ember: Shatter+Flamebrand -> Lash+Emberstorm",
    rationale: "Remove permanent hate plus one +2/+0 Overwhelm equipment; replace with unit tempo and anti-small-board AoE.",
    replacements: [
      { from: "ember_shatter", to: "ember_stun" },
      { from: "ember_blade", to: "ember_rain" },
    ],
  },
  {
    id: "ember_shatter_wyrm_to_stun_rain",
    family: "ember",
    deckId: "ember_aggro",
    label: "Ember: Shatter+Steamscale -> Lash+Emberstorm",
    rationale: "Remove permanent hate plus a Tough tribal +1/+1 amplifier; replace with tempo and AoE concentrated on swarm matchups.",
    replacements: [
      { from: "ember_shatter", to: "ember_stun" },
      { from: "ember_tide_wyrm", to: "ember_rain" },
    ],
  },
  {
    id: "ember_shatter_face_to_stun_cinder",
    family: "ember",
    deckId: "ember_aggro",
    label: "Ember: Shatter+Meteor -> Lash+Cinder",
    rationale: "Remove permanent hate and direct Nexus pressure; replace with lower-damage unit interaction that is poor into large Ironwood bodies.",
    replacements: [
      { from: "ember_shatter", to: "ember_stun" },
      { from: "ember_face", to: "ember_cinder" },
    ],
  },

  {
    id: "forest_double_pounce_to_web_canopy",
    family: "florestia",
    deckId: "florestia_tribal",
    label: "Florestia: 2×Pounce -> Webweaver+Canopy",
    rationale: "Remove both 3-damage unit answers into Ironwood and replace them with two Reach bodies for Tempestade protection.",
    replacements: [
      { from: "forest_predator_pounce", to: "wood_webweaver" },
      { from: "forest_predator_pounce", to: "forest_canopy_warden" },
    ],
  },
  {
    id: "forest_pounce_recall_to_web_shelter",
    family: "florestia",
    deckId: "florestia_tribal",
    label: "Florestia: Pounce+Recall -> Webweaver+Shelter",
    rationale: "Remove damage plus high-value bounce against large Ironwood units; preserve aerial/combat defense with Reach and Barrier.",
    replacements: [
      { from: "forest_predator_pounce", to: "wood_webweaver" },
      { from: "forest_primal_recall", to: "forest_pack_shelter" },
    ],
  },
  {
    id: "forest_pounce_moonsnare_to_web_shelter",
    family: "florestia",
    deckId: "florestia_tribal",
    label: "Florestia: Pounce+Moon Snare -> Webweaver+Shelter",
    rationale: "Remove direct damage plus one Fast Stun while adding Reach and Barrier to keep defensive value against Tempestade.",
    replacements: [
      { from: "forest_predator_pounce", to: "wood_webweaver" },
      { from: "forest_moon_snare", to: "forest_pack_shelter" },
    ],
  },
  {
    id: "forest_pounce_entangle_to_web_shelter",
    family: "florestia",
    deckId: "florestia_tribal",
    label: "Florestia: Pounce+Entangle -> Webweaver+Shelter",
    rationale: "Reduce two unit-interaction slots into Ironwood, compensating with Reach and Barrier instead of raw tribal power.",
    replacements: [
      { from: "forest_predator_pounce", to: "wood_webweaver" },
      { from: "forest_entangle", to: "forest_pack_shelter" },
    ],
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
  for (const replacement of candidate.replacements) {
    replaceFirst(cards, replacement.from, replacement.to);
  }
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
    for (const candidate of deckCandidates) {
      for (const replacement of candidate.replacements) {
        replaceFirst(cards, replacement.from, replacement.to);
      }
    }
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
  if (changed.length !== candidate.replacements.length) {
    errors.push(
      `${candidate.id}: expected exactly ${candidate.replacements.length} changed recipe slots, found ${changed.length}`,
    );
  }

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
