import { getDeck, validateDeck } from "./decks";
import { SEMANTIC_ALPHA_CARDS } from "./cards/semantic-alpha";
import type { DeckInput } from "./types";
import type { AlphaStarterId } from "./alpha-starter-balance";

export const ALPHA_STARTER_BALANCE_RECIPE_VERSION = "1.1";

export type AlphaRecipeFamily = "florestia" | "ember";

export interface AlphaRecipeReplacement {
  from: string;
  to: string;
}

export interface AlphaRecipeCandidate {
  id: string;
  family: AlphaRecipeFamily;
  deckId: AlphaStarterId;
  label: string;
  rationale: string;
  replacements: AlphaRecipeReplacement[];
}

/**
 * Round 3 tests controlled recipe softening of the two decks that appear in
 * all three certified critical matchups.
 *
 * No card is edited. Candidates only redistribute existing recipe slots.
 */
export const ALPHA_RECIPE_CANDIDATES: readonly AlphaRecipeCandidate[] = [
  {
    id: "forest_packrunner_to_summon",
    family: "florestia",
    deckId: "florestia_tribal",
    label: "Florestia: Packrunner -> Summon Pack",
    rationale: "Reduce one high-tempo +1/+0 tribal summon while preserving Beast/token identity through a slower 4-mana summon spell.",
    replacements: [{ from: "forest_packrunner", to: "forest_summon_pack" }],
  },
  {
    id: "forest_alpha_to_summon",
    family: "florestia",
    deckId: "florestia_tribal",
    label: "Florestia: Alpha -> Summon Pack",
    rationale: "Remove one large +2/+2 tribal swing and replace it with slower token development.",
    replacements: [{ from: "forest_alpha", to: "forest_summon_pack" }],
  },
  {
    id: "forest_champion_to_summon",
    family: "florestia",
    deckId: "florestia_tribal",
    label: "Florestia: Champion -> Summon Pack",
    rationale: "Reduce one resilient Challenger finisher while retaining the deck's Beast-count and token plan.",
    replacements: [{ from: "forest_champion", to: "forest_summon_pack" }],
  },
  {
    id: "forest_packrunner_alpha_to_summon_mend",
    family: "florestia",
    deckId: "florestia_tribal",
    label: "Florestia: Packrunner+Alpha -> Summon+Mend",
    rationale: "Moderate two-slot softening: one early tribal amplifier and one late board amplifier become slower token/heal utility.",
    replacements: [
      { from: "forest_packrunner", to: "forest_summon_pack" },
      { from: "forest_alpha", to: "wood_mend" },
    ],
  },
  {
    id: "forest_packrunner_champion_to_summon_mend",
    family: "florestia",
    deckId: "florestia_tribal",
    label: "Florestia: Packrunner+Champion -> Summon+Mend",
    rationale: "Reduce both early snowball and one finisher while preserving tribal teaching identity and legal regions.",
    replacements: [
      { from: "forest_packrunner", to: "forest_summon_pack" },
      { from: "forest_champion", to: "wood_mend" },
    ],
  },
  {
    id: "forest_alpha_champion_to_summon_mend",
    family: "florestia",
    deckId: "florestia_tribal",
    label: "Florestia: Alpha+Champion -> Summon+Mend",
    rationale: "Strongest Florestia softening candidate: reduce two top-end power spikes without changing low-curve tribal identity.",
    replacements: [
      { from: "forest_alpha", to: "forest_summon_pack" },
      { from: "forest_champion", to: "wood_mend" },
    ],
  },

  {
    id: "ember_bolt_to_stun",
    family: "ember",
    deckId: "ember_aggro",
    label: "Ember: Bolt -> second Flame Lash",
    rationale: "Trade one efficient 3-damage removal spell for lower damage plus Stun, preserving tempo while reducing raw pressure into Ironwood.",
    replacements: [{ from: "ember_bolt", to: "ember_stun" }],
  },
  {
    id: "ember_whelp_to_flare",
    family: "ember",
    deckId: "ember_aggro",
    label: "Ember: Whelp -> second Flare Line",
    rationale: "Reduce one explosive 1-drop while retaining burn identity through a slower 3-mana damage spell.",
    replacements: [{ from: "ember_whelp", to: "ember_flare_line" }],
  },
  {
    id: "ember_whelp_bolt_to_stun_flare",
    family: "ember",
    deckId: "ember_aggro",
    label: "Ember: Whelp+Bolt -> Stun+Flare",
    rationale: "Moderate two-slot softening across both early board and efficient removal while keeping aggressive interaction.",
    replacements: [
      { from: "ember_whelp", to: "ember_stun" },
      { from: "ember_bolt", to: "ember_flare_line" },
    ],
  },
  {
    id: "ember_drake_bolt_to_stun_flare",
    family: "ember",
    deckId: "ember_aggro",
    label: "Ember: Drake+Bolt -> Stun+Flare",
    rationale: "Reduce one Dragon tribal amplifier and one efficient removal spell without removing cheap pressure entirely.",
    replacements: [
      { from: "ember_drake", to: "ember_stun" },
      { from: "ember_bolt", to: "ember_flare_line" },
    ],
  },
  {
    id: "ember_whelp_drake_to_stun_flare",
    family: "ember",
    deckId: "ember_aggro",
    label: "Ember: Whelp+Drake -> Stun+Flare",
    rationale: "Reduce both early curve density and Dragon snowball while preserving interactive aggressive spells.",
    replacements: [
      { from: "ember_whelp", to: "ember_stun" },
      { from: "ember_drake", to: "ember_flare_line" },
    ],
  },
  {
    id: "ember_champion_bolt_to_stun_flare",
    family: "ember",
    deckId: "ember_aggro",
    label: "Ember: Champion+Bolt -> Stun+Flare",
    rationale: "Strongest Ember softening candidate: reduce one top-end finisher and one efficient removal spell while keeping core aggro identity.",
    replacements: [
      { from: "ember_champion", to: "ember_stun" },
      { from: "ember_bolt", to: "ember_flare_line" },
    ],
  },
] as const;

function replaceFirst(cards: string[], from: string, to: string): void {
  const index = cards.indexOf(from);
  if (index < 0) throw new Error(`Recipe candidate expected ${from} but it is absent`);
  cards[index] = to;
}

export function recipeForCandidate(candidate: AlphaRecipeCandidate): DeckInput {
  const base = getDeck(candidate.deckId);
  const cards = [...base.cards];
  for (const replacement of candidate.replacements) {
    replaceFirst(cards, replacement.from, replacement.to);
  }
  return { id: base.id, name: base.name, cards };
}

export function recipeOverridesForCandidates(
  candidates: readonly AlphaRecipeCandidate[],
): Record<string, DeckInput> {
  const byDeck = new Map<AlphaStarterId, AlphaRecipeCandidate[]>();
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

export function validateRecipeCandidate(candidate: AlphaRecipeCandidate): string[] {
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
  return errors;
}

export function validateRecipeCandidateSet(): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const candidate of ALPHA_RECIPE_CANDIDATES) {
    if (ids.has(candidate.id)) errors.push(`duplicate candidate id ${candidate.id}`);
    ids.add(candidate.id);
    errors.push(...validateRecipeCandidate(candidate));
  }
  return errors;
}
