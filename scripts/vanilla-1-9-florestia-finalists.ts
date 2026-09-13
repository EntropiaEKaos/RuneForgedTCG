import fs from "node:fs";
import { evaluateMatchup } from "../src/game/balance-health";
import {
  VANILLA_BALANCE_STRATUM_BASES,
  vanillaBalanceMatchups,
  vanillaBalanceSeed,
  vanillaExperimentalOverrides,
} from "../src/game/vanilla-balance-lab";
import { VANILLA_EXPERIMENTAL_DECKS } from "../src/game/vanilla-experimental-decks";
import { runBalanceSimulation, type SimulationSummary } from "../src/lib/balance-simulator";

const TARGET = "vanilla_forest_2";
const GAMES_PER_STRATUM = 40;
const STRATA = 5;
const writeIndex = process.argv.indexOf("--write");
const writePath = writeIndex >= 0 ? process.argv[writeIndex + 1] : "";

const targetDeck = VANILLA_EXPERIMENTAL_DECKS.find((deck) => deck.id === TARGET);
if (!targetDeck) throw new Error(`Missing ${TARGET}`);
const baseThirty = [...new Set(targetDeck.cards)];
if (baseThirty.length !== 30) throw new Error(`Expected 30 unique Florestia cards, found ${baseThirty.length}`);

const cardId = (suffix: string) => `van_forest_${suffix}`;
const finalists = [
  { id: "baseline_1_8", core: ["u11", "u13", "u14", "u16", "u17"] },
  { id: "wide_u03_u04", core: ["u03", "u04", "u13", "u14", "u16"] },
  { id: "wide_u04_u05", core: ["u04", "u05", "u13", "u14", "u16"] },
] as const;

function recipe(core: readonly string[]): string[] {
  if (core.length !== 5 || new Set(core).size !== 5) throw new Error(`Invalid five-card core: ${core.join(",")}`);
  const cards = [...baseThirty, ...core.flatMap((suffix) => [cardId(suffix), cardId(suffix)])];
  if (cards.length !== 40) throw new Error(`Expected 40 cards, found ${cards.length}`);
  const counts = new Map<string, number>();
  for (const id of cards) counts.set(id, (counts.get(id) ?? 0) + 1);
  if (counts.size !== 30) throw new Error(`Recipe lost the 30-card regional definition coverage`);
  if (Math.max(...counts.values()) > 3) throw new Error(`Recipe exceeds the three-copy ceiling`);
  return cards;
}

function pct(wins: number, losses: number): number {
  return Math.round((wins / Math.max(1, wins + losses)) * 1000) / 10;
}

function aggregate(parts: SimulationSummary[], targetIsA: boolean) {
  const wins = parts.reduce((sum, row) => sum + (targetIsA ? row.winsA : row.winsB), 0);
  const losses = parts.reduce((sum, row) => sum + (targetIsA ? row.winsB : row.winsA), 0);
  const draws = parts.reduce((sum, row) => sum + row.draws, 0);
  const completedGames = parts.reduce((sum, row) => sum + row.completedGames, 0);
  return { wins, losses, draws, completedGames, winRate: pct(wins, losses) };
}

const targetMatchups = vanillaBalanceMatchups().filter((row) => row.leftId === TARGET || row.rightId === TARGET);
if (targetMatchups.length !== 11) throw new Error(`Expected 11 target matchups, found ${targetMatchups.length}`);

const results = [];
for (const finalist of finalists) {
  const overrides = vanillaExperimentalOverrides();
  overrides[TARGET] = {
    id: TARGET,
    name: `${targetDeck.name} · ${finalist.id}`,
    cards: recipe(finalist.core),
  };

  const matchups = [];
  let wins = 0;
  let losses = 0;
  let draws = 0;
  let completedGames = 0;
  let incompleteRuns = 0;

  for (const matchup of targetMatchups) {
    const parts: SimulationSummary[] = [];
    for (let stratum = 0; stratum < STRATA; stratum += 1) {
      const summary = runBalanceSimulation(
        matchup.leftId,
        matchup.rightId,
        GAMES_PER_STRATUM,
        vanillaBalanceSeed(matchup, stratum),
        overrides,
      );
      if (summary.completedGames !== GAMES_PER_STRATUM) incompleteRuns += 1;
      parts.push(summary);
    }

    const targetIsA = matchup.leftId === TARGET;
    const row = aggregate(parts, targetIsA);
    const opponentId = targetIsA ? matchup.rightId : matchup.leftId;
    const health = evaluateMatchup(row.winRate);
    matchups.push({
      opponentId,
      ...row,
      status: health.status,
      deviation: health.deviation,
      isVanguard: opponentId.endsWith("_1"),
      isOvershootCritical: health.status === "critical" && row.winRate > 60,
      isFloorCritical: health.status === "critical" && row.winRate < 40,
    });
    wins += row.wins;
    losses += row.losses;
    draws += row.draws;
    completedGames += row.completedGames;
  }

  const critical = matchups.filter((row) => row.status === "critical");
  const watch = matchups.filter((row) => row.status === "watch");
  const healthy = matchups.filter((row) => row.status === "healthy");
  results.push({
    id: finalist.id,
    core: finalist.core.map(cardId),
    completedGames,
    wins,
    losses,
    draws,
    winRate: pct(wins, losses),
    incompleteRuns,
    health: { healthy: healthy.length, watch: watch.length, critical: critical.length },
    vanguardCritical: critical.filter((row) => row.isVanguard).length,
    floorCritical: critical.filter((row) => row.isFloorCritical).length,
    overshootCritical: critical.filter((row) => row.isOvershootCritical).length,
    worstMatchupWinRate: Math.min(...matchups.map((row) => row.winRate)),
    bestMatchupWinRate: Math.max(...matchups.map((row) => row.winRate)),
    criticalMatchups: critical.sort((a, b) => a.winRate - b.winRate || a.opponentId.localeCompare(b.opponentId)),
    matchups: matchups.sort((a, b) => a.opponentId.localeCompare(b.opponentId)),
  });
}

const expectedGamesPerFinalist = targetMatchups.length * STRATA * GAMES_PER_STRATUM;
for (const row of results) {
  if (row.completedGames !== expectedGamesPerFinalist) {
    throw new Error(`${row.id}: expected ${expectedGamesPerFinalist} games, found ${row.completedGames}`);
  }
  if (row.incompleteRuns !== 0) throw new Error(`${row.id}: ${row.incompleteRuns} incomplete simulation runs`);
}

const baseline = results.find((row) => row.id === "baseline_1_8");
if (!baseline) throw new Error("Missing baseline finalist");
const baselineCritical = new Set(baseline.criticalMatchups.map((row) => row.opponentId));

const ranked = results
  .map((row) => {
    const currentCritical = new Set(row.criticalMatchups.map((matchup) => matchup.opponentId));
    const clearedCriticals = [...baselineCritical].filter((id) => !currentCritical.has(id)).sort();
    const newCriticals = [...currentCritical].filter((id) => !baselineCritical.has(id)).sort();
    const cleanImprovement =
      row.id !== baseline.id &&
      row.health.critical < baseline.health.critical &&
      row.overshootCritical === 0 &&
      newCriticals.length === 0;
    return { ...row, clearedCriticals, newCriticals, cleanImprovement };
  })
  .sort(
    (a, b) =>
      Number(b.cleanImprovement) - Number(a.cleanImprovement) ||
      a.health.critical - b.health.critical ||
      a.overshootCritical - b.overshootCritical ||
      b.worstMatchupWinRate - a.worstMatchupWinRate ||
      b.winRate - a.winRate ||
      a.id.localeCompare(b.id),
  );

const report = {
  version: "1.9-finalist-confirmation-1",
  methodology:
    "High-sample composition-only confirmation using the official Vanilla Balance Lab configuration: 11 matchups × 5 deterministic strata × 40 games. No CardDef, AI, rules or product mutation.",
  gamesPerStratum: GAMES_PER_STRATUM,
  strata: STRATA,
  gamesPerMatchup: GAMES_PER_STRATUM * STRATA,
  gamesPerFinalist: expectedGamesPerFinalist,
  finalistCount: finalists.length,
  totalGames: expectedGamesPerFinalist * finalists.length,
  baselineId: baseline.id,
  baselineCriticalOpponents: [...baselineCritical].sort(),
  ranking: ranked,
  cleanImprovementIds: ranked.filter((row) => row.cleanImprovement).map((row) => row.id),
};

if (writePath) fs.writeFileSync(writePath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
console.log(
  `VANILLA 1.9 FLORESTIA FINALISTS: PASS — ${report.totalGames} games · baseline=${baseline.winRate}%/${baseline.health.critical} critical · clean=${report.cleanImprovementIds.join(",") || "none"}`,
);
