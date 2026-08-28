import type { CardDef, CardEffect } from "./types";
import type { SimulationSummary } from "@/lib/balance-simulator";

export const BALANCE_TARGET = {
  healthyLow: 45,
  healthyHigh: 55,
  criticalLow: 40,
  criticalHigh: 60,
} as const;

export type MatchupHealth = "healthy" | "watch" | "critical";

export function evaluateMatchup(winRate: number): { status: MatchupHealth; deviation: number } {
  const deviation = Math.max(0, BALANCE_TARGET.healthyLow - winRate, winRate - BALANCE_TARGET.healthyHigh);
  const status = winRate < BALANCE_TARGET.criticalLow || winRate > BALANCE_TARGET.criticalHigh
    ? "critical"
    : deviation > 0
      ? "watch"
      : "healthy";
  return { status, deviation: Math.round(deviation * 10) / 10 };
}

export function summarizeBalance(rows: SimulationSummary[]) {
  const decisive = rows.reduce((sum, row) => sum + row.firstPlayerWins + row.secondPlayerWins, 0);
  const firstWins = rows.reduce((sum, row) => sum + row.firstPlayerWins, 0);
  const evaluated = rows.map((row) => ({ ...row, health: evaluateMatchup(row.winRateA) }));
  const deviation = evaluated.reduce((sum, row) => sum + row.health.deviation, 0) / Math.max(evaluated.length, 1);
  const critical = evaluated.filter((row) => row.health.status === "critical");
  const watch = evaluated.filter((row) => row.health.status === "watch");
  return {
    target: BALANCE_TARGET,
    healthScore: Math.max(0, Math.round(100 - deviation * 7)),
    firstPlayerWinRate: decisive ? Math.round(firstWins / decisive * 1000) / 10 : 0,
    healthyMatchups: evaluated.length - critical.length - watch.length,
    watchMatchups: watch.length,
    criticalMatchups: critical.length,
    releaseGate: critical.length === 0 ? watch.length === 0 ? "pass" : "review" : "blocked",
    outliers: [...critical, ...watch].map((row) => ({
      deckA: row.deckA,
      deckB: row.deckB,
      winRateA: row.winRateA,
      winRateB: row.winRateB,
      status: row.health.status,
      deviation: row.health.deviation,
    })),
  };
}

function effectValue(effect: CardEffect | undefined): number {
  let score = 0;
  let current = effect;
  let depth = 0;
  while (current && depth++ < 12) {
    const multiplier = ["draw", "killUnit", "negateSpell", "recall", "aoeEnemy"].includes(current.kind) ? 1.5 : 1;
    score += Math.max(1, Math.abs(current.amount || current.buffPower || current.buffHealth || 1)) * multiplier;
    current = current.also;
  }
  return score;
}

/** Designer aid, not an authoritative balance verdict. */
export function estimateCardPower(card: Partial<CardDef>) {
  const cost = Math.max(0, Number(card.cost) || 0);
  const stats = Math.max(0, Number(card.power) || 0) + Math.max(0, Number(card.health) || 0);
  const keywordValue = (card.keywords?.length || 0) * 1.35;
  const rulesValue = effectValue(card.spell) + effectValue(card.trigger?.effect) + (card.mechanics || []).reduce((sum, mechanic) => sum + effectValue(mechanic.effect), 0);
  const regions = new Set([card.region, ...(card.regions || [])].filter(Boolean)).size;
  const commitmentCredit = Math.max(0, regions - 1) * 0.8;
  const raw = stats + keywordValue + rulesValue - commitmentCredit;
  const expected = card.type === "Unit" ? cost * 2 + 2.5 : cost * 2 + 1;
  const delta = Math.round((raw - expected) * 10) / 10;
  return {
    raw: Math.round(raw * 10) / 10,
    expected: Math.round(expected * 10) / 10,
    delta,
    band: delta > 3 ? "high" : delta < -3 ? "low" : "healthy",
    note: "Estimativa heurística. Confirme no Card Lab e em matrizes determinísticas.",
  } as const;
}
