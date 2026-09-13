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
const PRODUCT_BASELINE_SHA = "dd0c85072f7a01d105ae02253c8c1071a869ba98";
const HISTORICAL_SCREEN_SHA = "49e96405a8e3437ee74f67fba5f5514247be17f2";
const gamesPerStratum = Math.max(10, Math.min(60, Number(process.argv[2]) || 20));
const strata = Math.max(3, Math.min(VANILLA_BALANCE_STRATUM_BASES.length, Number(process.argv[3]) || 3));
const writeIndex = process.argv.indexOf("--write");
const writePath = writeIndex >= 0 ? process.argv[writeIndex + 1] : "";

const targetDeck = VANILLA_EXPERIMENTAL_DECKS.find((deck) => deck.id === TARGET);
if (!targetDeck) throw new Error(`Missing ${TARGET}`);
const baseThirty = [...new Set(targetDeck.cards)];
if (baseThirty.length !== 30) throw new Error(`Expected 30 unique Florestia cards, found ${baseThirty.length}`);

const id = (suffix: string) => `van_forest_${suffix}`;

// Vanilla 1.9 already screened the u03/u04/u05 substitutions around the old
// u11/u13/u14/u16/u17 core. Vanilla 1.11 deliberately explores a different
// hypothesis from current telemetry: increase cheap/durable board density so
// the five target-starved singleton interaction cards have legal bodies/targets.
// u04/u05/u16 remain the proven pressure/finisher spine unless a candidate is
// explicitly testing how much closing power can be exchanged for board density.
const candidates = [
  { id: "baseline_1_10_current", core: ["u04", "u05", "u13", "u14", "u16"] },
  { id: "u14_to_u01", core: ["u01", "u04", "u05", "u13", "u16"] },
  { id: "u14_to_u02", core: ["u02", "u04", "u05", "u13", "u16"] },
  { id: "u13_to_u01", core: ["u01", "u04", "u05", "u14", "u16"] },
  { id: "u13_to_u02", core: ["u02", "u04", "u05", "u14", "u16"] },
  { id: "u14_to_u07", core: ["u04", "u05", "u07", "u13", "u16"] },
  { id: "u14_to_u10", core: ["u04", "u05", "u10", "u13", "u16"] },
  { id: "double_low_u01_u02", core: ["u01", "u02", "u04", "u05", "u16"] },
] as const;

function recipe(core: readonly string[]): string[] {
  if (core.length !== 5 || new Set(core).size !== 5) throw new Error(`Invalid five-card core: ${core.join(",")}`);
  const extras = core.flatMap((suffix) => [id(suffix), id(suffix)]);
  const cards = [...baseThirty, ...extras];
  if (cards.length !== 40) throw new Error(`Expected 40 cards, found ${cards.length}`);
  const counts = new Map<string, number>();
  for (const card of cards) counts.set(card, (counts.get(card) ?? 0) + 1);
  if (Math.max(...counts.values()) > 3) throw new Error("Recipe exceeds three-copy ceiling");
  if (counts.size !== 30) throw new Error("Recipe lost regional coverage");
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

const rawResults = [];
for (const candidate of candidates) {
  const overrides = vanillaExperimentalOverrides();
  overrides[TARGET] = { id: TARGET, name: `${targetDeck.name} · ${candidate.id}`, cards: recipe(candidate.core) };
  const matchups = [];
  let totalWins = 0;
  let totalLosses = 0;
  let totalDraws = 0;
  let totalGames = 0;

  for (const matchup of targetMatchups) {
    const parts: SimulationSummary[] = [];
    for (let stratum = 0; stratum < strata; stratum += 1) {
      parts.push(
        runBalanceSimulation(
          matchup.leftId,
          matchup.rightId,
          gamesPerStratum,
          vanillaBalanceSeed(matchup, stratum),
          overrides,
        ),
      );
    }
    const targetIsA = matchup.leftId === TARGET;
    const aggregateRow = aggregate(parts, targetIsA);
    const opponentId = targetIsA ? matchup.rightId : matchup.leftId;
    const health = evaluateMatchup(aggregateRow.winRate);
    matchups.push({ opponentId, ...aggregateRow, status: health.status, deviation: health.deviation });
    totalWins += aggregateRow.wins;
    totalLosses += aggregateRow.losses;
    totalDraws += aggregateRow.draws;
    totalGames += aggregateRow.completedGames;
  }

  const critical = matchups.filter((row) => row.status === "critical");
  const watch = matchups.filter((row) => row.status === "watch");
  const healthy = matchups.filter((row) => row.status === "healthy");
  const overshootCritical = critical.filter((row) => row.winRate > 60);
  rawResults.push({
    id: candidate.id,
    core: candidate.core.map(id),
    totalGames,
    wins: totalWins,
    losses: totalLosses,
    draws: totalDraws,
    winRate: pct(totalWins, totalLosses),
    worstMatchupWinRate: Math.min(...matchups.map((row) => row.winRate)),
    health: { healthy: healthy.length, watch: watch.length, critical: critical.length },
    overshootCritical: overshootCritical.length,
    criticalMatchups: [...critical].sort((a, b) => a.winRate - b.winRate),
    matchups: [...matchups].sort((a, b) => a.opponentId.localeCompare(b.opponentId)),
  });
}

const baseline = rawResults.find((row) => row.id === "baseline_1_10_current");
if (!baseline) throw new Error("Missing current baseline result");
const baselineByOpponent = new Map(baseline.matchups.map((row) => [row.opponentId, row] as const));

const results = rawResults.map((row) => {
  const matchupDeltas = row.matchups.map((matchup) => {
    const base = baselineByOpponent.get(matchup.opponentId);
    if (!base) throw new Error(`Missing baseline matchup ${matchup.opponentId}`);
    return {
      opponentId: matchup.opponentId,
      baselineWinRate: base.winRate,
      candidateWinRate: matchup.winRate,
      deltaPp: Math.round((matchup.winRate - base.winRate) * 10) / 10,
      baselineStatus: base.status,
      candidateStatus: matchup.status,
    };
  });
  const newCriticals = matchupDeltas.filter(
    (delta) => delta.baselineStatus !== "critical" && delta.candidateStatus === "critical",
  );
  const clearedCriticals = matchupDeltas.filter(
    (delta) => delta.baselineStatus === "critical" && delta.candidateStatus !== "critical",
  );
  const regressions5pp = matchupDeltas.filter((delta) => delta.deltaPp <= -5);
  return {
    ...row,
    deltaVsBaselinePp: Math.round((row.winRate - baseline.winRate) * 10) / 10,
    newCriticals: newCriticals.length,
    clearedCriticals: clearedCriticals.length,
    regressions5pp: regressions5pp.length,
    matchupDeltas,
  };
});

results.sort(
  (a, b) =>
    a.health.critical - b.health.critical ||
    a.newCriticals - b.newCriticals ||
    a.overshootCritical - b.overshootCritical ||
    b.clearedCriticals - a.clearedCriticals ||
    a.regressions5pp - b.regressions5pp ||
    b.worstMatchupWinRate - a.worstMatchupWinRate ||
    b.winRate - a.winRate ||
    a.id.localeCompare(b.id),
);

const report = {
  version: "1.11-florestia-screen-1",
  methodology:
    "Composition-only Florestia Ascendant screen against all 11 current opponents. Candidates are new relative to the 1.9 twelve-recipe screen, preserve all 30 regional definitions, exactly 40 cards and the three-copy ceiling, and mutate no CardDef, AI or rules.",
  productBaselineSource: PRODUCT_BASELINE_SHA,
  historicalRecipeScreenSource: HISTORICAL_SCREEN_SHA,
  gamesPerStratum,
  strata,
  gamesPerMatchup: gamesPerStratum * strata,
  gamesPerCandidate: 11 * gamesPerStratum * strata,
  candidateCount: candidates.length,
  totalGames: candidates.length * 11 * gamesPerStratum * strata,
  baseline: results.find((row) => row.id === "baseline_1_10_current"),
  ranking: results,
};

if (report.totalGames !== results.reduce((sum, row) => sum + row.totalGames, 0)) {
  throw new Error("Screen game count mismatch");
}
if (writePath) fs.writeFileSync(writePath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
const leader = results[0];
console.log(
  `VANILLA 1.11 FLORESTIA SCREEN: PASS — ${report.totalGames} games · leader=${leader.id} ${leader.winRate}% · critical=${leader.health.critical} · newCriticals=${leader.newCriticals} · baseline=${report.baseline?.winRate}%/${report.baseline?.health.critical} critical`,
);
