export const BRAWL_RULE_CONTRACT = [
  { key: "startingMana", label: "Mana inicial", min: 0, max: 10, description: "Mana máxima e disponível no início para ambos os lados." },
  { key: "startingHand", label: "Mão inicial", min: 0, max: 10, description: "Quantidade inicial de cartas compradas por ambos os lados." },
  { key: "startingNexus", label: "Nexus inicial", min: 1, max: 100, description: "Vida inicial do Nexus para jogador e IA." },
] as const;

export const BRAWL_UNSUPPORTED_LEGACY_RULES = ["spellsOnly", "unitsOnly", "doubleMana"] as const;

export type BrawlRuleKey = (typeof BRAWL_RULE_CONTRACT)[number]["key"];

export function brawlRuleContractByKey(key: string) {
  return BRAWL_RULE_CONTRACT.find((field) => field.key === key) ?? null;
}
