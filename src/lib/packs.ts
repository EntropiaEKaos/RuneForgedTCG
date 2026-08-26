import type { Rarity } from "@/game/types";
import { nextRng, normalizeSeed } from "@/game/rng";

export interface PackDef {
  id: string;
  name: string;
  price: number;
  icon: string;
  cardsCount: number;
  dropRates: Record<Rarity, number>;
  guaranteedRarity?: Rarity;
  description: string;
  color: string;
  /** Optional set restriction. When present, only cards from this collection can be opened. */
  collectionKey?: string;
}

export const PACK_DEFS: PackDef[] = [
  {
    id: "basic",
    name: "Pacote Comum",
    price: 100,
    icon: "📦",
    cardsCount: 5,
    dropRates: { Common: 0.7, Rare: 0.25, Epic: 0.04, Legend: 0.01 },
    description: "5 cartas. Chance rara de Epic/Legend.",
    color: "from-slate-500 to-slate-700",
    collectionKey: "vanilla",
  },
  {
    id: "epic",
    name: "Pacote Épico",
    price: 300,
    icon: "🎁",
    cardsCount: 5,
    dropRates: { Common: 0.4, Rare: 0.4, Epic: 0.17, Legend: 0.03 },
    guaranteedRarity: "Rare",
    description: "5 cartas com garantia de Rare ou melhor.",
    color: "from-purple-500 to-purple-800",
    collectionKey: "vanilla",
  },
  {
    id: "legendary",
    name: "Pacote Lendário",
    price: 700,
    icon: "🏆",
    cardsCount: 6,
    dropRates: { Common: 0.2, Rare: 0.4, Epic: 0.3, Legend: 0.1 },
    guaranteedRarity: "Epic",
    description: "6 cartas com garantia de Epic ou melhor. 10% chance de Legend.",
    color: "from-amber-500 to-orange-700",
    collectionKey: "vanilla",
  },
];

export function getPackDef(id: string): PackDef | undefined {
  return PACK_DEFS.find((p) => p.id === id);
}

export function createPackRandom(seed: number): () => number {
  let state = normalizeSeed(seed);
  return () => {
    const next = nextRng(state);
    state = next.state;
    return next.value;
  };
}

export function rollRarity(rates: Record<Rarity, number>, randomValue: number): Rarity {
  const roll = Math.max(0, Math.min(0.999999999999, randomValue));
  let cumulative = 0;
  for (const r of ["Legend", "Epic", "Rare", "Common"] as Rarity[]) {
    cumulative += rates[r];
    if (roll < cumulative) return r;
  }
  return "Common";
}

export interface LoginReward {
  day: number;
  gold: number;
  dust: number;
  pack?: string;
  icon: string;
}

export const LOGIN_REWARDS: LoginReward[] = [
  { day: 1, gold: 50, dust: 0, icon: "🪙" },
  { day: 2, gold: 75, dust: 10, icon: "💰" },
  { day: 3, gold: 100, dust: 20, pack: "basic", icon: "📦" },
  { day: 4, gold: 100, dust: 30, icon: "💎" },
  { day: 5, gold: 150, dust: 50, icon: "🎁" },
  { day: 6, gold: 200, dust: 75, pack: "epic", icon: "🎁" },
  { day: 7, gold: 300, dust: 100, pack: "legendary", icon: "🏆" },
];

export function getLoginReward(streak: number): LoginReward {
  const day = ((streak - 1) % 7) + 1;
  return LOGIN_REWARDS.find((r) => r.day === day) ?? LOGIN_REWARDS[0];
}
