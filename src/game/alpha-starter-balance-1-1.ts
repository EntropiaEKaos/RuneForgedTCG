import { getDeck, validateDeck } from "./decks";
import { SEMANTIC_ALPHA_CARDS } from "./cards/semantic-alpha";
import type { DeckInput } from "./types";
import type { AlphaStarterId } from "./alpha-starter-balance";

export const ALPHA_STARTER_BALANCE_RECIPE_VERSION = "1.1";

export type AlphaRecipeFamily = "wood" | "tide";

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
 * Round 2 is intentionally matchup-tech oriented.
 *
 * Round 1 replaced target-starved cards with generic proactive power and
 * over-buffed Ironwood globally. These candidates instead preserve the deck's
 * shape while importing defensive/control tools already legal in its certified
 * region identity.
 */
export const ALPHA_RECIPE_CANDIDATES: readonly AlphaRecipeCandidate[] = [
  {
    id: "wood_wither_to_tide_guard",
    family: "wood",
    deckId: "wood_midrange",
    label: "Wood: Wither -> Tidal Warden",
    rationale: "Replace one dead permanent-removal slot with a 2/5 Tough+Reach defender to absorb Ember and Florestia pressure.",
    replacements: [{ from: "wood_wither", to: "tide_guard" }],
  },
  {
    id: "wood_bark_to_tide_guard",
    family: "wood",
    deckId: "wood_midrange",
    label: "Wood: Bark Rupture -> Tidal Warden",
    rationale: "Keep both cheap Withers but trade one expensive permanent-only answer for a defensive blocker.",
    replacements: [{ from: "wood_bark_rupture", to: "tide_guard" }],
  },
  {
    id: "wood_wither_to_tide_heal",
    family: "wood",
    deckId: "wood_midrange",
    label: "Wood: Wither -> Soothing Tide",
    rationale: "Use Tidecall identity to buy four Nexus health against Ember rush without adding generic board power.",
    replacements: [{ from: "wood_wither", to: "tide_heal" }],
  },
  {
    id: "wood_wither_to_tide_stun",
    family: "wood",
    deckId: "wood_midrange",
    label: "Wood: Wither -> Riptide Stun",
    rationale: "Replace target-starved permanent interaction with cheap unit tempo that can answer Florestia and Ember threats.",
    replacements: [{ from: "wood_wither", to: "tide_stun" }],
  },
  {
    id: "wood_wither_to_tide_freeze",
    family: "wood",
    deckId: "wood_midrange",
    label: "Wood: Wither -> Riptide",
    rationale: "Trade dead permanent removal for two damage plus draw, a controlled anti-board tool rather than raw stat density.",
    replacements: [{ from: "wood_wither", to: "tide_freeze" }],
  },
  {
    id: "wood_bark_to_tide_stun",
    family: "wood",
    deckId: "wood_midrange",
    label: "Wood: Bark Rupture -> Riptide Stun",
    rationale: "Preserve both Withers while converting one expensive permanent-only answer into targeted combat tempo.",
    replacements: [{ from: "wood_bark_rupture", to: "tide_stun" }],
  },

  {
    id: "tide_dispel_to_heal",
    family: "tide",
    deckId: "tide_control",
    label: "Tide: Dispel -> third Soothing Tide",
    rationale: "Convert one 16.6%-play permanent answer into extra Nexus stabilization against Florestia's board pressure.",
    replacements: [{ from: "tide_dispel", to: "tide_heal" }],
  },
  {
    id: "tide_dispel_to_freeze",
    family: "tide",
    deckId: "tide_control",
    label: "Tide: Dispel -> third Riptide",
    rationale: "Add damage plus card flow against creature boards while preserving one Dispel for permanent coverage.",
    replacements: [{ from: "tide_dispel", to: "tide_freeze" }],
  },
  {
    id: "tide_dispel_to_stun",
    family: "tide",
    deckId: "tide_control",
    label: "Tide: Dispel -> third Riptide Stun",
    rationale: "Add a third cheap stun to interrupt Florestia's high-value attack turns.",
    replacements: [{ from: "tide_dispel", to: "tide_stun" }],
  },
  {
    id: "tide_dispel_to_frostbite",
    family: "tide",
    deckId: "tide_control",
    label: "Tide: Dispel -> third Flash Freeze",
    rationale: "Increase Burst combat suppression against large buffed Beasts while retaining one Dispel.",
    replacements: [{ from: "tide_dispel", to: "tide_frostbite" }],
  },
  {
    id: "tide_dispel_to_recall",
    family: "tide",
    deckId: "tide_control",
    label: "Tide: Dispel -> second Recall",
    rationale: "Use a broader unit answer that can reset expensive Florestia threats without adding raw stats.",
    replacements: [{ from: "tide_dispel", to: "tide_recall" }],
  },
  {
    id: "tide_dispel_to_shield",
    family: "tide",
    deckId: "tide_control",
    label: "Tide: Dispel -> third Ripcurrent Ward",
    rationale: "Increase Barrier density to convert more Florestia combat steps into unfavorable trades.",
    replacements: [{ from: "tide_dispel", to: "tide_shield" }],
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
