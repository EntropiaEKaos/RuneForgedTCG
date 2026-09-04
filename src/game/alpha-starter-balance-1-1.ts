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
 * Round 4 is a surgical continuation of the only productive Round-3 line.
 *
 * Florestia keeps the softening that fixed Tide while replacing lost generic
 * sustain with Reach so it does not collapse against Tempestade.
 *
 * Ember keeps its aggressive identity but trades part of the raw curve/removal
 * package for Ashguard + tempo, aiming to move Ember×Wood below critical while
 * preserving its fragile Tempestade matchup.
 */
export const ALPHA_RECIPE_CANDIDATES: readonly AlphaRecipeCandidate[] = [
  {
    id: "forest_packrunner_champion_to_summon_canopy",
    family: "florestia",
    deckId: "florestia_tribal",
    label: "Florestia: Packrunner+Champion -> Summon+Canopy",
    rationale: "Preserve the Round-3 softening shape, but replace Mending with a 3/4 Reach Beast to recover anti-air defense.",
    replacements: [
      { from: "forest_packrunner", to: "forest_summon_pack" },
      { from: "forest_champion", to: "forest_canopy_warden" },
    ],
  },
  {
    id: "forest_packrunner_champion_to_summon_web",
    family: "florestia",
    deckId: "florestia_tribal",
    label: "Florestia: Packrunner+Champion -> Summon+Webweaver",
    rationale: "A softer 2/4 Reach replacement than Canopy; targets Tempestade without restoring Champion-level pressure.",
    replacements: [
      { from: "forest_packrunner", to: "forest_summon_pack" },
      { from: "forest_champion", to: "wood_webweaver" },
    ],
  },
  {
    id: "forest_packrunner_champion_to_canopy_web",
    family: "florestia",
    deckId: "florestia_tribal",
    label: "Florestia: Packrunner+Champion -> Canopy+Webweaver",
    rationale: "Remove one tribal amplifier and one finisher while increasing Reach density instead of token density.",
    replacements: [
      { from: "forest_packrunner", to: "forest_canopy_warden" },
      { from: "forest_champion", to: "wood_webweaver" },
    ],
  },
  {
    id: "forest_packrunner_alpha_to_summon_canopy",
    family: "florestia",
    deckId: "florestia_tribal",
    label: "Florestia: Packrunner+Alpha -> Summon+Canopy",
    rationale: "Reduce early and late tribal amplification while retaining a real Reach body against aerial rush.",
    replacements: [
      { from: "forest_packrunner", to: "forest_summon_pack" },
      { from: "forest_alpha", to: "forest_canopy_warden" },
    ],
  },
  {
    id: "forest_packrunner_alpha_to_summon_web",
    family: "florestia",
    deckId: "florestia_tribal",
    label: "Florestia: Packrunner+Alpha -> Summon+Webweaver",
    rationale: "Round-3 Alpha softening with a cheaper Reach compensator instead of generic healing.",
    replacements: [
      { from: "forest_packrunner", to: "forest_summon_pack" },
      { from: "forest_alpha", to: "wood_webweaver" },
    ],
  },
  {
    id: "forest_packrunner_alpha_to_canopy_web",
    family: "florestia",
    deckId: "florestia_tribal",
    label: "Florestia: Packrunner+Alpha -> Canopy+Webweaver",
    rationale: "Strong anti-air variant: removes two tribal power spikes but replaces both with durable Reach bodies.",
    replacements: [
      { from: "forest_packrunner", to: "forest_canopy_warden" },
      { from: "forest_alpha", to: "wood_webweaver" },
    ],
  },

  {
    id: "ember_drake_bolt_to_ashguard_stun",
    family: "ember",
    deckId: "ember_aggro",
    label: "Ember: Drake+Bolt -> Ashguard+Stun",
    rationale: "Reduce Dragon snowball and raw removal while adding a Tough blocker plus tempo to protect the Tempestade matchup.",
    replacements: [
      { from: "ember_drake", to: "ember_ashguard" },
      { from: "ember_bolt", to: "ember_stun" },
    ],
  },
  {
    id: "ember_drake_bolt_to_ashguard_flare",
    family: "ember",
    deckId: "ember_aggro",
    label: "Ember: Drake+Bolt -> Ashguard+Flare",
    rationale: "Convert one tribal amplifier and one efficient removal spell into defense plus slower burn.",
    replacements: [
      { from: "ember_drake", to: "ember_ashguard" },
      { from: "ember_bolt", to: "ember_flare_line" },
    ],
  },
  {
    id: "ember_whelp_bolt_to_ashguard_stun",
    family: "ember",
    deckId: "ember_aggro",
    label: "Ember: Whelp+Bolt -> Ashguard+Stun",
    rationale: "Reduce one premium 1-drop and one 3-damage answer while preserving interactive tempo and adding Tough defense.",
    replacements: [
      { from: "ember_whelp", to: "ember_ashguard" },
      { from: "ember_bolt", to: "ember_stun" },
    ],
  },
  {
    id: "ember_whelp_drake_to_ashguard_flare",
    family: "ember",
    deckId: "ember_aggro",
    label: "Ember: Whelp+Drake -> Ashguard+Flare",
    rationale: "Lower early curve and Dragon amplification while keeping slower direct-damage identity.",
    replacements: [
      { from: "ember_whelp", to: "ember_ashguard" },
      { from: "ember_drake", to: "ember_flare_line" },
    ],
  },
  {
    id: "ember_champion_bolt_to_ashguard_stun",
    family: "ember",
    deckId: "ember_aggro",
    label: "Ember: Champion+Bolt -> Ashguard+Stun",
    rationale: "Reduce one top-end finisher plus efficient removal, compensated by Tough defense and tempo.",
    replacements: [
      { from: "ember_champion", to: "ember_ashguard" },
      { from: "ember_bolt", to: "ember_stun" },
    ],
  },
  {
    id: "ember_whelp_drake_bolt_to_ashguard_stun_flare",
    family: "ember",
    deckId: "ember_aggro",
    label: "Ember: Whelp+Drake+Bolt -> Ashguard+Stun+Flare",
    rationale: "Strongest controlled softening: one early unit, one tribal amplifier and one premium removal become defense plus slower interaction.",
    replacements: [
      { from: "ember_whelp", to: "ember_ashguard" },
      { from: "ember_drake", to: "ember_stun" },
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
