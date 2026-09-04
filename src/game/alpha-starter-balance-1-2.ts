import { getDeck, validateDeck } from "./decks";
import { SEMANTIC_ALPHA_CARDS } from "./cards/semantic-alpha";
import type { DeckInput } from "./types";

export const ALPHA_STARTER_BALANCE_1_2_VERSION = "1.2";

export interface WoodRecipeCandidate {
  id: string;
  label: string;
  rationale: string;
  from: "wood_wither" | "wood_bark_rupture";
  to: "tide_frostbite" | "tide_stun" | "wood_root_prison" | "tide_heal";
}

export const WOOD_1_2_CANDIDATES: readonly WoodRecipeCandidate[] = [
  {
    id: "wood_wither_to_frostbite",
    label: "Wood: Wither -> Flash Freeze",
    rationale: "Replace one dead permanent-only slot with Burst power suppression aimed at Ember/Florestia attack turns.",
    from: "wood_wither",
    to: "tide_frostbite",
  },
  {
    id: "wood_bark_to_frostbite",
    label: "Wood: Bark Rupture -> Flash Freeze",
    rationale: "Preserve both cheap Withers while converting one expensive permanent-only answer into Burst combat suppression.",
    from: "wood_bark_rupture",
    to: "tide_frostbite",
  },
  {
    id: "wood_wither_to_stun",
    label: "Wood: Wither -> Riptide Stun",
    rationale: "Replace one target-starved permanent answer with cheap unit tempo against aggressive and tribal boards.",
    from: "wood_wither",
    to: "tide_stun",
  },
  {
    id: "wood_bark_to_stun",
    label: "Wood: Bark Rupture -> Riptide Stun",
    rationale: "Keep both Withers and trade one expensive dead slot for a low-cost enemy-unit stun.",
    from: "wood_bark_rupture",
    to: "tide_stun",
  },
  {
    id: "wood_wither_to_root_prison",
    label: "Wood: Wither -> third Root Prison",
    rationale: "Increase native Ironwood unit-control density without adding generic stats or off-plan power.",
    from: "wood_wither",
    to: "wood_root_prison",
  },
  {
    id: "wood_bark_to_root_prison",
    label: "Wood: Bark Rupture -> third Root Prison",
    rationale: "Retain cheap permanent interaction but turn one expensive permanent-only slot into a third native stun.",
    from: "wood_bark_rupture",
    to: "wood_root_prison",
  },
  {
    id: "wood_wither_to_heal",
    label: "Wood: Wither -> Soothing Tide",
    rationale: "Buy four Nexus health against Ember/Florestia pressure without increasing board stats.",
    from: "wood_wither",
    to: "tide_heal",
  },
  {
    id: "wood_bark_to_heal",
    label: "Wood: Bark Rupture -> Soothing Tide",
    rationale: "Preserve both cheap Withers while converting one stranded expensive answer into Nexus stabilization.",
    from: "wood_bark_rupture",
    to: "tide_heal",
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
