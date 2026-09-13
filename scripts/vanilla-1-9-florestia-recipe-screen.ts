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
const gamesPerStratum = Math.max(10, Math.min(60, Number(process.argv[2]) || 20));
const strata = Math.max(3, Math.min(VANILLA_BALANCE_STRATUM_BASES.length, Number(process.argv[3]) || 3));
const writeIndex = process.argv.indexOf("--write");
const writePath = writeIndex >= 0 ? process.argv[writeIndex + 1] : "";

const targetDeck = VANILLA_EXPERIMENTAL_DECKS.find((deck) => deck.id === TARGET);
if (!targetDeck) throw new Error(`Missing ${TARGET}`);
const baseThirty = [...new Set(targetDeck.cards)];
if (baseThirty.length !== 30) throw new Error(`Expected 30 unique Florestia cards, found ${baseThirty.length}`);

const id = (suffix: string) => `van_forest_${suffix}`;
const candidates = [
  { id: "baseline_1_8", core: ["u11", "u13", "u14", "u16", "u17"] },
  { id: "u11_to_u03", core: ["u03", "u13", "u14", "u16", "u17"] },
  { id: "u11_to_u04", core: ["u04", "u13", "u14", "u16", "u17"] },
  { id: "u11_to_u05", core: ["u05", "u13", "u14", "u16", "u17"] },
  { id: "u17_to_u03", core: ["u03", "u11", "u13", "u14", "u16"] },
  { id: "u17_to_u05", core: ["u05", "u11", "u13", "u14", "u16"] },
  { id: "u16_to_u03", core: ["u03", "u11", "u13", "u14", "u17"] },
  { id: "u16_to_u05", core: ["u05", "u11", "u13", "u14", "u17"] },
  { id: "double_early_u03_u05", core: ["u03", "u05", "u13", "u14", "u16"] },
  { id: "wide_u03_u04", core: ["u03", "u04", "u13", "u14", "u16"] },
  { id: "wide_u04_u05", core: ["u04", "u05", "u13", "u14", "u16"] },
  { id: "tempo_u03_u08", core: ["u03", "u08", "u13", "u14", "u16"] },
] as const;

function recipe(core: readonly string[]): string[] {
  if (core.length !== 5 || new Set(core).size !== 5) throw new Error(`Invalid five-card core: ${core.join(",")}`);
  const extras = core.flatMap((suffix) => [id(suffix), id(suffix)]);
  const cards = [...baseThirty, ...extras];
  if (cards.length !== 40) throw new Error(`Expected 40 cards, found ${cards.length}`);
  const counts = new Map<string, number>();
  for (const card of cards) counts.set(card, (counts.get(card) ?? 0) + 1);
  if (Math.max(...counts.values()) > 3) throw new Error(`Recipe exceeds three-copy ceiling`);
  if (counts.size !== 30) throw new Error(`Recipe lost regional coverage`);
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
  const vanguardCritical = critical.filter((row) => row.opponentId.endsWith("_1"));
  const overshootCritical = critical.filter((row) => row.winRate > 60);
  results.push({
    id: candidate.id,
    core: candidate.core.map(id),
    totalGames,
    wins: totalWins,
    losses: totalLosses,
    draws: totalDraws,
    winRate: pct(totalWins, totalLosses),
    health: { healthy: healthy.length, watch: watch.length, critical: critical.length },
    vanguardCritical: vanguardCritical.length,
    overshootCritical: overshootCritical.length,
    criticalMatchups: critical.sort((a, b) => a.winRate - b.winRate),
    matchups: matchups.sort((a, b) => a.opponentId.localeCompare(b.opponentId)),
  });
}

results.sort(
  (a, b) =>
    a.health.critical - b.health.critical ||
    a.overshootCritical - b.overshootCritical ||
    a.vanguardCritical - b.vanguardCritical ||
    b.winRate - a.winRate ||
    a.id.localeCompare(b.id),
);

const baseline = results.find((row) => row.id === "baseline_1_8")!;
const report = {
  version: "1.9-screen-1",
  methodology:
    "Composition-only Florestia Ascendant screen. Every candidate preserves all 30 regional definitions, exactly 40 cards and the runtime three-copy ceiling. No CardDef, AI or rules mutation.",
  gamesPerStratum,
  strata,
  gamesPerMatchup: gamesPerStratum * strata,
  gamesPerCandidate: 11 * gamesPerStratum * strata,
  candidateCount: candidates.length,
  totalGames: candidates.length * 11 * gamesPerStratum * strata,
  baseline,
  ranking: results,
};

if (report.totalGames !== results.reduce((sum, row) => sum + row.totalGames, 0)) {
  throw new Error(`Screen game count mismatch`);
}
if (writePath) fs.writeFileSync(writePath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
const leader = results[0];
console.log(
  `VANILLA 1.9 FLORESTIA SCREEN: PASS — ${report.totalGames} games · leader=${leader.id} ${leader.winRate}% · critical=${leader.health.critical} · baseline=${baseline.winRate}%/${baseline.health.critical} critical`,
);
