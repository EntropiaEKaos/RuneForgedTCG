import { getDeck, validateDeck } from "./decks";
import { SEMANTIC_ALPHA_CARDS } from "./cards/semantic-alpha";
import type { DeckInput } from "./types";

export const ALPHA_STARTER_BALANCE_1_2_VERSION = "1.2";

export interface WoodRecipeCandidate {
  id: string;
  label: string;
  rationale: string;
  from: "wood_wither" | "wood_bark_rupture";
  to: "tide_glacial" | "convergence_rootwater_sage" | "tide_memory_tide" | "wood_elderbear";
}

/**
 * Round 2 moves away from single-target tempo that failed to shift the
 * certified criticals. These candidates test anti-swarm or resilient
 * defensive cards whose value should be concentrated against Ember/Florestia.
 */
export const WOOD_1_2_CANDIDATES: readonly WoodRecipeCandidate[] = [
  {
    id: "wood_wither_to_glacial",
    label: "Wood: Wither -> Glacial Tomb",
    rationale: "Replace one dead permanent-only slot with a 5-mana Frostbite-all effect aimed at full Ember/Florestia attack turns.",
    from: "wood_wither",
    to: "tide_glacial",
  },
  {
    id: "wood_bark_to_glacial",
    label: "Wood: Bark Rupture -> Glacial Tomb",
    rationale: "Preserve both cheap Withers while converting one expensive dead answer into anti-swarm Frostbite.",
    from: "wood_bark_rupture",
    to: "tide_glacial",
  },
  {
    id: "wood_wither_to_rootwater_sage",
    label: "Wood: Wither -> Rootwater Sage",
    rationale: "Use the exact Tidecall/Ironwood convergence identity for a 2/4 body plus Nexus heal 2.",
    from: "wood_wither",
    to: "convergence_rootwater_sage",
  },
  {
    id: "wood_bark_to_rootwater_sage",
    label: "Wood: Bark Rupture -> Rootwater Sage",
    rationale: "Trade one expensive permanent-only answer for a defensive 2/4 body with summon healing.",
    from: "wood_bark_rupture",
    to: "convergence_rootwater_sage",
  },
  {
    id: "wood_wither_to_memory_tide",
    label: "Wood: Wither -> Memory Tide",
    rationale: "Replace a stranded slot with draw 2 plus Nexus heal 2, prioritizing stabilization over raw stats.",
    from: "wood_wither",
    to: "tide_memory_tide",
  },
  {
    id: "wood_bark_to_memory_tide",
    label: "Wood: Bark Rupture -> Memory Tide",
    rationale: "Convert one expensive dead answer into card flow plus modest Nexus stabilization.",
    from: "wood_bark_rupture",
    to: "tide_memory_tide",
  },
  {
    id: "wood_wither_to_elderbear",
    label: "Wood: Wither -> Elder Bear",
    rationale: "Replace one dead spell with a durable 4/6 Tough blocker to contest creature-heavy boards.",
    from: "wood_wither",
    to: "wood_elderbear",
  },
  {
    id: "wood_bark_to_elderbear",
    label: "Wood: Bark Rupture -> Elder Bear",
    rationale: "Preserve both cheap Withers while converting one expensive dead answer into a resilient 4/6 Tough unit.",
    from: "wood_bark_rupture",
    to: "wood_elderbear",
  },
] as const;

function replaceFirst(cards: string[], from: string, to: string): void {
  const index = cards.indexOf(from);
  if (index < 0) throw new Error(`Wood 1.2 candidate expected ${from} but it is absent`);
  cards[index] = to;
}

export function recipeForWoodCandidate(candidate: WoodRecipeCandidate): DeckInput {
  const base = getDeck("wood_midrange");
  const cards = [...base.cards];
  replaceFirst(cards, candidate.from, candidate.to);
  return { id: base.id, name: base.name, cards };
}

export function woodCandidateOverride(candidate: WoodRecipeCandidate): Record<string, DeckInput> {
  const deck = recipeForWoodCandidate(candidate);
  return { [deck.id]: deck };
}

export function validateWoodCandidate(candidate: WoodRecipeCandidate): string[] {
  const errors: string[] = [];
  let deck: DeckInput;
  try {
    deck = recipeForWoodCandidate(candidate);
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

  const base = getDeck("wood_midrange").cards;
  const changed = deck.cards.reduce<number[]>(
    (indexes, defId, index) => (defId === base[index] ? indexes : [...indexes, index]),
    [],
  );
  if (changed.length !== 1) errors.push(`${candidate.id}: expected exactly one changed recipe slot, found ${changed.length}`);

  return errors;
}

export function validateWoodCandidateSet(): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const candidate of WOOD_1_2_CANDIDATES) {
    if (ids.has(candidate.id)) errors.push(`duplicate candidate id ${candidate.id}`);
    ids.add(candidate.id);
    errors.push(...validateWoodCandidate(candidate));
  }
  return errors;
}
