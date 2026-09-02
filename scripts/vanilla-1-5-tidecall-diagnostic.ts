import fs from "node:fs";
import { evaluateMatchup } from "../src/game/balance-health";
import { getCard } from "../src/game/cards";
import { withRegisteredCardSnapshot } from "../src/game/custom-registry";
import {
  VANILLA_BALANCE_STRATUM_BASES,
  vanillaBalanceMatchups,
  vanillaBalanceSeed,
  vanillaExperimentalOverrides,
} from "../src/game/vanilla-balance-lab";
import type { CardDef } from "../src/game/types";
import { runBalanceSimulation, type SimulationSummary } from "../src/lib/balance-simulator";

const GAMES = Math.max(20, Math.min(80, Number(process.argv[2]) || 40));
const STRATA = Math.max(3, Math.min(5, Number(process.argv[3]) || 5));
const writeIndex = process.argv.indexOf("--write");
const writePath = writeIndex >= 0 ? process.argv[writeIndex + 1] : "";
if (STRATA > VANILLA_BALANCE_STRATUM_BASES.length) throw new Error("strata outside seed table");
const overrides = vanillaExperimentalOverrides();
const matchups = vanillaBalanceMatchups();

const mutations = [
  { defId: "van_tide_u04", cost: 3 },
  { defId: "van_tide_u06", cost: 4 },
  { defId: "van_tide_u09", cost: 5 },
  { defId: "van_tide_u10", cost: 5 },
  { defId: "van_tide_u17", cost: 8 },
  { defId: "van_tide_u18", cost: 9, removeKeywords: ["Lifesteal"] },
  { defId: "van_tide_u08", removeKeywords: ["Lifesteal"] },
] as const;

function mutate(spec: (typeof mutations)[number]): CardDef {
  const base = getCard(spec.defId);
  const removeKeywords: readonly string[] = "removeKeywords" in spec ? spec.removeKeywords : [];
  return {
    ...base,
    cost: "cost" in spec ? spec.cost : base.cost,
    keywords: (base.keywords ?? []).filter((keyword) => !removeKeywords.includes(keyword)),
  };
}
function round1(value: number): number { return Math.round(value * 10) / 10; }
function pct(n: number, d: number): number { return round1((n / Math.max(1, d)) * 100); }

type DeckAggregate = { wins: number; losses: number; draws: number; games: number };

const report = withRegisteredCardSnapshot(mutations.map(mutate), () => {
  const decks: Record<string, DeckAggregate> = {};
  const matchupRows: Array<{ leftId: string; rightId: string; games: number; winRateA: number; status: string; maxSeedDeviation: number }> = [];
  let firstWins = 0;
  let decisive = 0;
  let draws = 0;
  let totalGames = 0;
  let maxSeedDeviation = 0;
  const health = { healthy: 0, watch: 0, critical: 0 };

  for (const matchup of matchups) {
    const parts: SimulationSummary[] = [];
    for (let stratum = 0; stratum < STRATA; stratum += 1) {
      parts.push(runBalanceSimulation(matchup.leftId, matchup.rightId, GAMES, vanillaBalanceSeed(matchup, stratum), overrides));
    }
    const completed = parts.reduce((sum, row) => sum + row.completedGames, 0);
    const winsA = parts.reduce((sum, row) => sum + row.winsA, 0);
    const winsB = parts.reduce((sum, row) => sum + row.winsB, 0);
    const matchupDraws = parts.reduce((sum, row) => sum + row.draws, 0);
    const rateA = pct(winsA, winsA + winsB);
    const status = evaluateMatchup(rateA).status;
    health[status] += 1;
    const seedRates = parts.map((row) => pct(row.winsA, row.winsA + row.winsB));
    const seedDeviation = Math.max(...seedRates.map((rate) => Math.abs(rate - rateA)));
    maxSeedDeviation = Math.max(maxSeedDeviation, seedDeviation);
    matchupRows.push({ leftId: matchup.leftId, rightId: matchup.rightId, games: completed, winRateA: rateA, status, maxSeedDeviation: round1(seedDeviation) });

    decks[matchup.leftId] ??= { wins: 0, losses: 0, draws: 0, games: 0 };
    decks[matchup.rightId] ??= { wins: 0, losses: 0, draws: 0, games: 0 };
    decks[matchup.leftId].wins += winsA;
    decks[matchup.leftId].losses += winsB;
    decks[matchup.leftId].draws += matchupDraws;
    decks[matchup.leftId].games += completed;
    decks[matchup.rightId].wins += winsB;
    decks[matchup.rightId].losses += winsA;
    decks[matchup.rightId].draws += matchupDraws;
    decks[matchup.rightId].games += completed;

    firstWins += parts.reduce((sum, row) => sum + row.firstPlayerWins, 0);
    decisive += parts.reduce((sum, row) => sum + row.firstPlayerWins + row.secondPlayerWins, 0);
    draws += matchupDraws;
    totalGames += completed;
  }

  const deckWinRates = Object.entries(decks).map(([deckId, row]) => ({
    deckId,
    games: row.games,
    wins: row.wins,
    losses: row.losses,
    draws: row.draws,
    winRate: pct(row.wins, row.wins + row.losses),
  })).sort((a, b) => b.winRate - a.winRate || a.deckId.localeCompare(b.deckId));

  return {
    version: "Vanilla 1.5 full-meta candidate validation",
    methodology: "Candidate Tidecall card changes are registered only in-memory; all 66 experimental matchups run through the exact real-engine Balance Lab simulator at the same 40x5 deterministic matrix used by Vanilla 1.4.",
    candidate: mutations,
    matrix: {
      matchups: matchupRows.length,
      gamesPerMatchup: GAMES * STRATA,
      totalGames,
      firstPlayerWinRate: pct(firstWins, decisive),
      drawRate: pct(draws, totalGames),
      maxSeedDeviation: round1(maxSeedDeviation),
      health,
      releaseGate: health.critical === 0 ? (health.watch === 0 ? "pass" : "review") : "blocked",
    },
    deckWinRates,
    matchups: matchupRows,
  };
});

if (writePath) {
  fs.mkdirSync(writePath.split("/").slice(0, -1).join("/") || ".", { recursive: true });
  fs.writeFileSync(writePath, `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify(report, null, 2));
