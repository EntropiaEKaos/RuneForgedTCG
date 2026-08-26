/**
 * Mapeamentos de internacionalização (PT-BR) para a UI do Runeforge.
 *
 * Regra de engenharia: os valores internos (Region, Race, Keyword, CardType, Rarity)
 * permanecem em inglês no motor e no banco de dados para compatibilidade.
 * Esta camada traduz apenas na camada de apresentação.
 */
import type { Region, Race, Keyword, CardType, Rarity } from "./types";

/** Nome em português de cada Cor. */
export const NOME_COR: Record<Region, string> = {
  Emberhold:  "Chama",
  Tidecall:   "Maré",
  Ironwood:   "Floresta",
  Voidborn:   "Vazio",
  Florestia:  "Florestia",
  Tempestade: "Tempestade",
};

/** Nome em português de cada Raça. */
export const NOME_RACA: Record<Race, string> = {
  Dragon:      "Dragão",
  Sprite:      "Sprite",
  Beast:       "Fera",
  Voidling:    "Voidling",
  Warrior:     "Guerreiro",
  Elemental:   "Elemental",
  Spirit:      "Espírito",
  Besta:       "Besta",
  Tempesteiro: "Tempesteiro",
  Anjo:        "Anjo",
};

/** Emoji de cada Raça. */
export const EMOJI_RACA: Record<Race, string> = {
  Dragon:      "🐉",
  Sprite:      "🌊",
  Beast:       "🐾",
  Voidling:    "👁",
  Warrior:     "⚔️",
  Elemental:   "🔥",
  Spirit:      "👻",
  Besta:       "🦌",
  Tempesteiro: "⚡",
  Anjo:        "🦅",
};

/** Nome em português de cada Palavra-chave. */
export const NOME_KEYWORD: Record<Keyword, string> = {
  Overwhelm:   "Atropelar",
  QuickAttack: "Ataque Rápido",
  DoubleStrike:"Ataque Duplo",
  Elusive:     "Evasivo",
  Lifesteal:   "Vampírico",
  Barrier:     "Barreira",
  Fearsome:    "Assustador",
  Tough:       "Resistente",
  Regeneration:"Regeneração",
  Challenger:  "Desafiador",
  Unblockable: "Imparável",
  Ephemeral:   "Efêmero",
  LastBreath:  "Último Suspiro",
  Deathtouch:  "Toque Mortal",
  Poisonous:   "Venenoso",
  Haste:       "Ímpeto",
  Wither:      "Murchar",
  Hexproof:    "Hexproof",
  Reach:       "Alcance",
  Flying:      "Voo",
};

/** Nome em português de cada Tipo de Carta. */
export const NOME_TIPO: Partial<Record<CardType, string>> & Record<string, string> = {
  Unit:        "Unidade",
  Spell:       "Feitiço",
  Enchantment: "Encantamento",
  Artifact:    "Artefato",
  Equipment:   "Equipamento",
};

/** Nome em português de cada Raridade. */
export const NOME_RARIDADE: Partial<Record<Rarity, string>> & Record<string, string> = {
  Common:  "Comum",
  Rare:    "Rara",
  Epic:    "Épica",
  Legend:  "Lendária",
};

/** Retorna o nome em PT de uma região/cor. */
export function nomeCor(region: Region): string {
  return NOME_COR[region] ?? region;
}
/** Retorna o nome em PT de uma raça. */
export function nomeRaca(race: Race | undefined): string {
  if (!race) return "";
  return NOME_RACA[race] ?? race;
}
/** Retorna o nome em PT de uma palavra-chave. */
export function nomeKeyword(kw: Keyword): string {
  return NOME_KEYWORD[kw] ?? kw;
}
