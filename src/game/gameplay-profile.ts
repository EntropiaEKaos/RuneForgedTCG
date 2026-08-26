import { CARDS, getCard } from "./cards";
import type { DeckDef } from "./decks";
import type { CardDef, EffectKind, Region } from "./types";
import { cardRegions } from "./region-identity";

const INTERACTION_EFFECTS = new Set<EffectKind>([
  "damageUnit",
  "aoeEnemy",
  "destroyPermanent",
  "damagePermanent",
  "negateSpell",
  "frostbite",
  "stun",
  "recall",
  "killUnit",
  "poison",
]);

export interface DeckGameplayProfile {
  size: number;
  averageCost: number;
  earlyCards: number;
  midCards: number;
  lateCards: number;
  units: number;
  spells: number;
  permanents: number;
  champions: number;
  interaction: number;
  regions: Region[];
  curve: number[];
  identity: "Aggro" | "Tempo" | "Midrange" | "Control";
}

function cardHasInteraction(card: CardDef): boolean {
  const effects = [card.spell, card.trigger?.effect, ...(card.mechanics ?? []).map((mechanic) => mechanic.effect)];
  return effects.some((effect) => {
    let current = effect;
    while (current) {
      if (INTERACTION_EFFECTS.has(current.kind)) return true;
      current = current.also;
    }
    return false;
  });
}

function classify(profile: Omit<DeckGameplayProfile, "identity">): DeckGameplayProfile["identity"] {
  if (profile.averageCost <= 3 && profile.earlyCards >= 20) return "Aggro";
  if (profile.units >= 22 && profile.averageCost <= 3.3 && profile.interaction >= 7) return "Tempo";
  if (profile.spells >= 10 && profile.interaction >= 9) return "Control";
  if (profile.averageCost <= 3.45 && profile.interaction >= 7) return "Tempo";
  return "Midrange";
}

export function profileDeck(cards: string[]): DeckGameplayProfile {
  const definitions = cards.map((id) => { try { return getCard(id); } catch { return null; } }).filter((card): card is CardDef => Boolean(card));
  const curve = Array(8).fill(0) as number[];
  for (const card of definitions) curve[Math.min(7, Math.max(0, card.cost))] += 1;
  const regionSet = new Set(definitions.flatMap((card) => cardRegions(card)));
  const base = {
    size: definitions.length,
    averageCost: definitions.length
      ? Number((definitions.reduce((sum, card) => sum + card.cost, 0) / definitions.length).toFixed(2))
      : 0,
    earlyCards: definitions.filter((card) => card.cost <= 2).length,
    midCards: definitions.filter((card) => card.cost >= 3 && card.cost <= 5).length,
    lateCards: definitions.filter((card) => card.cost >= 6).length,
    units: definitions.filter((card) => card.type === "Unit").length,
    spells: definitions.filter((card) => card.type === "Spell").length,
    permanents: definitions.filter((card) => card.type === "Artifact" || card.type === "Enchantment" || card.type === "Equipment" || card.type === "Sentinela").length,
    champions: definitions.filter((card) => card.isChampion && card.collectible !== false).length,
    interaction: definitions.filter(cardHasInteraction).length,
    regions: [...regionSet],
    curve,
  };
  return { ...base, identity: classify(base) };
}

export interface BalanceFinding {
  severity: "error" | "warning";
  code: string;
  message: string;
}

export function auditStarterDeck(deck: DeckDef): BalanceFinding[] {
  const p = profileDeck(deck.cards);
  const findings: BalanceFinding[] = [];
  if (p.size !== 40) findings.push({ severity: "error", code: "DECK_SIZE", message: `${deck.name} has ${p.size}/40 cards.` });
  if (p.earlyCards < 8) findings.push({ severity: "warning", code: "EARLY_GAME", message: `${deck.name} has only ${p.earlyCards} cards costing 0–2.` });
  if (p.units < 16) findings.push({ severity: "warning", code: "BOARD_DENSITY", message: `${deck.name} has only ${p.units} units.` });
  if (p.interaction < 4) findings.push({ severity: "warning", code: "INTERACTION", message: `${deck.name} has only ${p.interaction} interactive cards.` });
  if (p.averageCost < 1.8 || p.averageCost > 4.8) findings.push({ severity: "warning", code: "CURVE", message: `${deck.name} has an extreme ${p.averageCost} average cost.` });
  return findings;
}

export function catalogCoverage(): Record<Region, { collectible: number; units: number; spells: number; champions: number }> {
  const regions = ["Emberhold", "Tidecall", "Ironwood", "Voidborn", "Florestia", "Tempestade"] as const;
  return Object.fromEntries(regions.map((region) => {
    const cards = Object.values(CARDS).filter((card) => cardRegions(card).includes(region) && card.collectible !== false);
    return [region, {
      collectible: cards.length,
      units: cards.filter((card) => card.type === "Unit").length,
      spells: cards.filter((card) => card.type === "Spell").length,
      champions: cards.filter((card) => card.isChampion).length,
    }];
  })) as Record<Region, { collectible: number; units: number; spells: number; champions: number }>;
}
