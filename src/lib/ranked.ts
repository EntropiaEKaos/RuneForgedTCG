export interface RankTier {
  name: string;
  minMmr: number;
  maxMmr: number;
  icon: string;
  color: string;
  gradient: string;
}

export const RANK_TIERS: RankTier[] = [
  { name: "Bronze", minMmr: 0, maxMmr: 999, icon: "🥉", color: "text-orange-700", gradient: "from-orange-600 to-orange-900" },
  { name: "Prata", minMmr: 1000, maxMmr: 1249, icon: "🥈", color: "text-slate-300", gradient: "from-slate-400 to-slate-700" },
  { name: "Ouro", minMmr: 1250, maxMmr: 1499, icon: "🥇", color: "text-amber-400", gradient: "from-amber-400 to-amber-700" },
  { name: "Platina", minMmr: 1500, maxMmr: 1749, icon: "💎", color: "text-cyan-300", gradient: "from-cyan-400 to-cyan-700" },
  { name: "Diamante", minMmr: 1750, maxMmr: 1999, icon: "💠", color: "text-blue-300", gradient: "from-blue-400 to-blue-700" },
  { name: "Mestre", minMmr: 2000, maxMmr: 2299, icon: "👑", color: "text-purple-300", gradient: "from-purple-500 to-purple-800" },
  { name: "Grão-Mestre", minMmr: 2300, maxMmr: 9999, icon: "🏆", color: "text-amber-300", gradient: "from-yellow-400 via-orange-500 to-red-600" },
];

export function rankTierFor(tiers: readonly RankTier[], mmr: number): RankTier {
  if (!tiers.length) throw new Error("Rank tiers are not configured");
  const ordered = [...tiers].sort((a, b) => a.minMmr - b.minMmr);
  const exact = ordered.find((tier) => mmr >= tier.minMmr && mmr <= tier.maxMmr);
  if (exact) return exact;
  return mmr < ordered[0].minMmr ? ordered[0] : ordered[ordered.length - 1];
}

export function getRankTier(mmr: number): RankTier {
  return rankTierFor(RANK_TIERS, mmr);
}

export function progressWithinTier(mmr: number): { current: number; total: number; pct: number } {
  const tier = getRankTier(mmr);
  const current = mmr - tier.minMmr;
  const total = tier.maxMmr - tier.minMmr + 1;
  return { current, total, pct: Math.min(100, (current / total) * 100) };
}

/**
 * Elo-based MMR calculation.
 * K-factor of 32 for placements, 24 for normal matches.
 */
export interface RankedCalculationConfig {
  eloDivisor: number;
  placementK: number;
  normalK: number;
  minimumMmr: number;
}

export const DEFAULT_RANKED_CALCULATION: RankedCalculationConfig = {
  eloDivisor: 400,
  placementK: 40,
  normalK: 24,
  minimumMmr: 0,
};

export function calculateMmrChange(
  playerMmr: number,
  opponentMmr: number,
  won: boolean,
  inPlacement: boolean,
  config: RankedCalculationConfig = DEFAULT_RANKED_CALCULATION,
): number {
  const kFactor = inPlacement ? config.placementK : config.normalK;
  const expected = 1 / (1 + Math.pow(10, (opponentMmr - playerMmr) / config.eloDivisor));
  const actual = won ? 1 : 0;
  return Math.round(kFactor * (actual - expected));
}

export function calculateAppliedMmrResult(
  playerMmr: number,
  opponentMmr: number,
  won: boolean,
  inPlacement: boolean,
  config: RankedCalculationConfig = DEFAULT_RANKED_CALCULATION,
): { mmrChange: number; mmrAfter: number } {
  const requestedChange = calculateMmrChange(playerMmr, opponentMmr, won, inPlacement, config);
  const mmrAfter = Math.max(config.minimumMmr, playerMmr + requestedChange);
  return { mmrChange: mmrAfter - playerMmr, mmrAfter };
}
