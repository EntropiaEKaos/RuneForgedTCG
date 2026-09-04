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

export const ALPHA_RECIPE_CANDIDATES: readonly AlphaRecipeCandidate[] = [
  {
    id: "wood_one_wither_to_champion",
    family: "wood",
    deckId: "wood_midrange",
    label: "Wood: 1 Wither -> Champion",
    rationale: "Remove one 17.6%-play target-starved Withering Vines slot for a 93.2%-play proactive threat.",
    replacements: [{ from: "wood_wither", to: "wood_champion" }],
  },
  {
    id: "wood_one_bark_to_champion",
    family: "wood",
    deckId: "wood_midrange",
    label: "Wood: 1 Bark Rupture -> Champion",
    rationale: "Remove one 18.7%-play Ruptura da Casca slot for a proactive Champion.",
    replacements: [{ from: "wood_bark_rupture", to: "wood_champion" }],
  },
  {
    id: "wood_split_champion_canopy",
    family: "wood",
    deckId: "wood_midrange",
    label: "Wood: Wither+Bark -> Champion+Canopy",
    rationale: "Replace one copy of each dead reactive slot with two high-utilization proactive units.",
    replacements: [
      { from: "wood_wither", to: "wood_champion" },
      { from: "wood_bark_rupture", to: "wood_canopy_bastion" },
    ],
  },
  {
    id: "wood_split_champion_ward",
    family: "wood",
    deckId: "wood_midrange",
    label: "Wood: Wither+Bark -> Champion+Ward",
    rationale: "Trade one copy of each stranded removal effect for Champion plus the 93.3%-play Barkskin protection spell.",
    replacements: [
      { from: "wood_wither", to: "wood_champion" },
      { from: "wood_bark_rupture", to: "wood_ward" },
    ],
  },
  {
    id: "wood_split_champion_ent",
    family: "wood",
    deckId: "wood_midrange",
    label: "Wood: Wither+Bark -> Champion+Ent",
    rationale: "Increase proactive midrange density while retaining one copy of each original conditional answer.",
    replacements: [
      { from: "wood_wither", to: "wood_champion" },
      { from: "wood_bark_rupture", to: "wood_ent" },
    ],
  },
  {
    id: "wood_both_wither_champion_canopy",
    family: "wood",
    deckId: "wood_midrange",
    label: "Wood: 2 Wither -> Champion+Canopy",
    rationale: "Remove both copies of the single most stranded Wood card while preserving both Bark Rupture answers.",
    replacements: [
      { from: "wood_wither", to: "wood_champion" },
      { from: "wood_wither", to: "wood_canopy_bastion" },
    ],
  },

  {
    id: "tide_one_dispel_to_draw",
    family: "tide",
    deckId: "tide_control",
    label: "Tide: 1 Dispel -> Draw",
    rationale: "Replace one 16.6%-play Disenchant Tide with the 93.4%-play draw spell.",
    replacements: [{ from: "tide_dispel", to: "tide_draw" }],
  },
  {
    id: "tide_one_dispel_to_mirror",
    family: "tide",
    deckId: "tide_control",
    label: "Tide: 1 Dispel -> Mirror",
    rationale: "Replace one stranded Dispel with the 95.9%-play Mirror Shell equipment.",
    replacements: [{ from: "tide_dispel", to: "tide_mirror" }],
  },
  {
    id: "tide_one_dispel_to_champion",
    family: "tide",
    deckId: "tide_control",
    label: "Tide: 1 Dispel -> Champion",
    rationale: "Replace one stranded Dispel with a third proactive Tide Champion.",
    replacements: [{ from: "tide_dispel", to: "tide_champion" }],
  },
  {
    id: "tide_both_dispel_draw_mirror",
    family: "tide",
    deckId: "tide_control",
    label: "Tide: 2 Dispel -> Draw+Mirror",
    rationale: "Remove both heavily target-starved Dispels in favor of the two highest-utilization non-semantic support cards.",
    replacements: [
      { from: "tide_dispel", to: "tide_draw" },
      { from: "tide_dispel", to: "tide_mirror" },
    ],
  },
  {
    id: "tide_both_dispel_champion_draw",
    family: "tide",
    deckId: "tide_control",
    label: "Tide: 2 Dispel -> Champion+Draw",
    rationale: "Convert both stranded Dispels into board pressure plus card flow.",
    replacements: [
      { from: "tide_dispel", to: "tide_champion" },
      { from: "tide_dispel", to: "tide_draw" },
    ],
  },
  {
    id: "tide_both_dispel_champion_mirror",
    family: "tide",
    deckId: "tide_control",
    label: "Tide: 2 Dispel -> Champion+Mirror",
    rationale: "Convert both stranded Dispels into a proactive finisher and high-utilization equipment.",
    replacements: [
      { from: "tide_dispel", to: "tide_champion" },
      { from: "tide_dispel", to: "tide_mirror" },
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
