import type { CardDef, CardRegionIdentity, PlayerState, Region, RegionalPerk } from "./types";
import { getCard } from "./cards";

export const REGION_ORDER: readonly Region[] = [
  "Emberhold", "Tidecall", "Ironwood", "Voidborn", "Florestia", "Tempestade",
];

export const REGION_IDENTITY_STYLE: Record<Region, { label: string; sigil: string; color: string }> = {
  Emberhold: { label: "Emberhold", sigil: "🔥", color: "#f97316" },
  Tidecall: { label: "Tidecall", sigil: "🌊", color: "#22d3ee" },
  Ironwood: { label: "Ironwood", sigil: "🌿", color: "#2dd4bf" },
  Voidborn: { label: "Vazio", sigil: "☠", color: "#d946ef" },
  Florestia: { label: "Florestia", sigil: "🐺", color: "#fbbf24" },
  Tempestade: { label: "Tempestade", sigil: "⚡", color: "#60a5fa" },
};

const DUAL_NAMES: Record<string, string> = {
  "Emberhold+Tidecall": "Forja a Vapor",
  "Emberhold+Ironwood": "Bosque Incandescente",
  "Emberhold+Voidborn": "Cinzas Profanas",
  "Emberhold+Florestia": "Caçada da Brasa",
  "Emberhold+Tempestade": "Forja do Trovão",
  "Tidecall+Ironwood": "Raízes da Maré",
  "Tidecall+Voidborn": "Abismo Afogado",
  "Tidecall+Florestia": "Matilha Lunar",
  "Tidecall+Tempestade": "Monção Celeste",
  "Ironwood+Voidborn": "Jardim do Crepúsculo",
  "Ironwood+Florestia": "Pacto Ancestral",
  "Ironwood+Tempestade": "Copa Fulminante",
  "Voidborn+Florestia": "Matilha Sombria",
  "Voidborn+Tempestade": "Eclipse Elétrico",
  "Florestia+Tempestade": "Uivo do Trovão",
};

const TRIAD_NAMES: Record<string, string> = {
  "Emberhold+Tidecall+Ironwood": "Tríade da Criação",
  "Emberhold+Ironwood+Florestia": "Árvore-Mundo em Chamas",
  "Emberhold+Voidborn+Tempestade": "Apocalipse da Tempestade Negra",
  "Tidecall+Ironwood+Voidborn": "Memória do Abismo Vivo",
  "Tidecall+Florestia+Tempestade": "Lua da Grande Monção",
  "Ironwood+Voidborn+Florestia": "Círculo da Raiz Sombria",
};

export interface RegionIdentityProfile {
  key: string;
  name: string;
  tier: "single" | "dual" | "triad";
  regions: CardRegionIdentity;
  sigils: string;
  description: string;
}

function canonicalRegions(regions: readonly Region[]): Region[] {
  return [...new Set(regions)]
    .filter((region): region is Region => REGION_ORDER.includes(region))
    .sort((a, b) => REGION_ORDER.indexOf(a) - REGION_ORDER.indexOf(b));
}

export function normalizeRegions(regions: readonly Region[]): CardRegionIdentity {
  const unique = canonicalRegions(regions).slice(0, 3);
  if (!unique.length) return ["Emberhold"];
  return unique as CardRegionIdentity;
}

export function cardRegions(card: Pick<CardDef, "region" | "regions">): CardRegionIdentity {
  return normalizeRegions([card.region, ...(card.regions ?? [])]);
}

export function identityForRegions(input: readonly Region[]): RegionIdentityProfile {
  const regions = normalizeRegions(input);
  const key = regions.join("+");
  const tier = regions.length === 1 ? "single" : regions.length === 2 ? "dual" : "triad";
  const name = tier === "single"
    ? REGION_IDENTITY_STYLE[regions[0]].label
    : tier === "dual"
      ? DUAL_NAMES[key] ?? regions.map((region) => REGION_IDENTITY_STYLE[region].label).join(" + ")
      : TRIAD_NAMES[key] ?? "Convergência de " + regions.map((region) => REGION_IDENTITY_STYLE[region].label).join(", ");
  return {
    key: key.toLowerCase().replaceAll("+", "-"),
    name,
    tier,
    regions,
    sigils: regions.map((region) => REGION_IDENTITY_STYLE[region].sigil).join(""),
    description: tier === "single"
      ? "Identidade regional pura."
      : tier === "dual"
        ? "Coalizão de duas regiões: exige ambas na identidade do deck."
        : "Convergência de três regiões: maior flexibilidade com compromisso estrutural máximo.",
  };
}

export function regionsFromCardIds(cards: readonly string[]): Region[] {
  const regions: Region[] = [];
  for (const defId of cards) {
    try {
      for (const region of cardRegions(getCard(defId))) if (!regions.includes(region)) regions.push(region);
    } catch {
      // Unknown cards are reported by deck validation.
    }
  }
  // Deck validation must receive the complete set. Truncating here would make
  // a four-region deck indistinguishable from a legal three-region deck.
  return canonicalRegions(regions);
}

export function regionalPerk(card: CardDef): RegionalPerk | null {
  return cardRegions(card).length > 1 ? card.regionalPerk ?? "convergence" : null;
}

export function hasRegionalMastery(player: Pick<PlayerState, "deckRegions"> | undefined, card: CardDef): boolean {
  const required = cardRegions(card);
  if (required.length < 2 || !player?.deckRegions) return false;
  return identityForRegions(player.deckRegions).key === identityForRegions(required).key;
}

export function regionalCostDiscount(player: Pick<PlayerState, "deckRegions"> | undefined, card: CardDef): number {
  return hasRegionalMastery(player, card) && regionalPerk(card) === "convergence" ? 1 : 0;
}

export function regionalUnitBonus(player: Pick<PlayerState, "deckRegions"> | undefined, card: CardDef): { power: number; health: number } {
  if (!hasRegionalMastery(player, card)) return { power: 0, health: 0 };
  const perk = regionalPerk(card);
  return { power: perk === "assault" ? 1 : 0, health: perk === "bulwark" ? 1 : 0 };
}

export function regionalRuleText(card: CardDef): string | null {
  const identity = identityForRegions(cardRegions(card));
  if (identity.tier === "single") return null;
  const perk = regionalPerk(card);
  const reward = perk === "assault"
    ? "+1 de Poder ao ser invocada"
    : perk === "bulwark"
      ? "+1 de Vida ao ser invocada"
      : "custa 1 a menos";
  return "Maestria — em um deck exatamente " + identity.name + ", esta carta " + reward + ".";
}
