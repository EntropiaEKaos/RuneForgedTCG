import fs from "node:fs";
import { evaluateMatchup } from "../src/game/balance-health";
import { VANILLA_FLORESTIA_CARDS } from "../src/game/cards/vanilla/forest";
import { withRegisteredCardSnapshot } from "../src/game/custom-registry";
import {
  VANILLA_BALANCE_STRATUM_BASES,
  vanillaBalanceMatchups,
  vanillaBalanceSeed,
  vanillaExperimentalOverrides,
} from "../src/game/vanilla-balance-lab";
import { runBalanceSimulation, type SimulationSummary } from "../src/lib/balance-simulator";
import type { CardDef } from "../src/game/types";

const ASCENDANT = "vanilla_forest_2";
const VANGUARD = "vanilla_forest_1";
const GAMES_PER_STRATUM = 40;
const STRATA = 5;
const writeIndex = process.argv.indexOf("--write");
const writePath = writeIndex >= 0 ? process.argv[writeIndex + 1] : "";
const globalIndex = process.argv.indexOf("--global");
const globalPath = globalIndex >= 0 ? process.argv[globalIndex + 1] : "";

if (VANILLA_BALANCE_STRATUM_BASES.length < STRATA) {
  throw new Error(`Expected at least ${STRATA} certified Vanilla strata, found ${VANILLA_BALANCE_STRATUM_BASES.length}`);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function pct(wins: number, losses: number): number {
  return round1((wins / Math.max(1, wins + losses)) * 100);
}

function aggregate(parts: SimulationSummary[]) {
  const winsA = parts.reduce((sum, row) => sum + row.winsA, 0);
  const winsB = parts.reduce((sum, row) => sum + row.winsB, 0);
  const draws = parts.reduce((sum, row) => sum + row.draws, 0);
  const completedGames = parts.reduce((sum, row) => sum + row.completedGames, 0);
  return { winsA, winsB, draws, completedGames, winRateA: pct(winsA, winsB) };
}

const u04 = VANILLA_FLORESTIA_CARDS.van_forest_u04;
if (!u04) throw new Error("Missing van_forest_u04");
const u04HealthPlusOne: CardDef = {
  ...u04,
  health: (u04.health ?? 0) + 1,
};

const affectedMatchups = vanillaBalanceMatchups().filter(
  (row) => row.leftId === ASCENDANT || row.rightId === ASCENDANT || row.leftId === VANGUARD || row.rightId === VANGUARD,
);
if (affectedMatchups.length !== 21) throw new Error(`Expected 21 Florestia-affected matchups, found ${affectedMatchups.length}`);

type Row = {
  leftId: string;
  rightId: string;
  winsA: number;
  winsB: number;
  draws: number;
  completedGames: number;
  winRateA: number;
  status: ReturnType<typeof evaluateMatchup>["status"];
};

function runRows(definitions: CardDef[]): Row[] {
  const simulate = () => {
    const overrides = vanillaExperimentalOverrides();
    return affectedMatchups.map((matchup) => {
      const parts: SimulationSummary[] = [];
      for (let stratum = 0; stratum < STRATA; stratum += 1) {
        parts.push(
          runBalanceSimulation(
            matchup.leftId,
            matchup.rightId,
            GAMES_PER_STRATUM,
            vanillaBalanceSeed(matchup, stratum),
            overrides,
          ),
        );
      }
      const totals = aggregate(parts);
      const health = evaluateMatchup(totals.winRateA);
      return {
        leftId: matchup.leftId,
        rightId: matchup.rightId,
        ...totals,
        status: health.status,
      };
    });
  };
  return definitions.length ? withRegisteredCardSnapshot(definitions, simulate) : simulate();
}

function summarizeDeck(rows: Row[], deckId: string) {
  let wins = 0;
  let losses = 0;
  let draws = 0;
  let games = 0;
  const matchups = rows
    .filter((row) => row.leftId === deckId || row.rightId === deckId)
    .map((row) => {
      const isLeft = row.leftId === deckId;
      const deckWins = isLeft ? row.winsA : row.winsB;
      const deckLosses = isLeft ? row.winsB : row.winsA;
      const winRate = pct(deckWins, deckLosses);
      const status = evaluateMatchup(winRate).status;
      wins += deckWins;
      losses += deckLosses;
      draws += row.draws;
      games += row.completedGames;
      return {
        opponentId: isLeft ? row.rightId : row.leftId,
        games: row.completedGames,
        wins: deckWins,
        losses: deckLosses,
        draws: row.draws,
        winRate,
        status,
      };
    })
    .sort((a, b) => a.winRate - b.winRate || a.opponentId.localeCompare(b.opponentId));
  return {
    games,
    wins,
    losses,
    draws,
    winRate: pct(wins, losses),
    health: {
      healthy: matchups.filter((row) => row.status === "healthy").length,
      watch: matchups.filter((row) => row.status === "watch").length,
      critical: matchups.filter((row) => row.status === "critical").length,
    },
    worstMatchupWinRate: Math.min(...matchups.map((row) => row.winRate)),
    matchups,
  };
}

const baselineRows = runRows([]);

if (globalPath) {
  const globalReport = JSON.parse(fs.readFileSync(globalPath, "utf8")) as {
    gamesPerStratum?: number;
    strata?: number;
    rows?: Array<{
      deckA: string;
      deckB: string;
      winsA: number;
      winsB: number;
      draws: number;
      completedGames: number;
      winRateA: number;
    }>;
  };
  if (globalReport.gamesPerStratum !== GAMES_PER_STRATUM || globalReport.strata !== STRATA) {
    throw new Error("Global diagnostic sample does not match finalist sample");
  }
  const globalRows = new Map(
    (globalReport.rows ?? []).map((row) => [`${row.deckA}__${row.deckB}`, row]),
  );
  for (const baseline of baselineRows) {
    const global = globalRows.get(`${baseline.leftId}__${baseline.rightId}`);
    if (!global) throw new Error(`Global diagnostic missing ${baseline.leftId} vs ${baseline.rightId}`);
    if (
      global.winsA !== baseline.winsA ||
      global.winsB !== baseline.winsB ||
      global.draws !== baseline.draws ||
      global.completedGames !== baseline.completedGames ||
      global.winRateA !== baseline.winRateA
    ) {
      throw new Error(`Baseline drift detected for ${baseline.leftId} vs ${baseline.rightId}`);
    }
  }
}

const candidateRows = runRows([u04HealthPlusOne]);
const baselineMap = new Map<string, Row>(
  baselineRows.map((row) => [`${row.leftId}__${row.rightId}`, row]),
);
const deltas = candidateRows.map((row) => {
  const key = `${row.leftId}__${row.rightId}`;
  const baseline = baselineMap.get(key);
  if (!baseline) throw new Error(`Missing baseline row ${key}`);
  return {
    key,
    baselineWinRateA: baseline.winRateA,
    candidateWinRateA: row.winRateA,
    deltaLeftPp: round1(row.winRateA - baseline.winRateA),
    baselineStatus: baseline.status,
    candidateStatus: row.status,
  };
});

const baseline = {
  affectedHealth: {
    healthy: baselineRows.filter((row) => row.status === "healthy").length,
    watch: baselineRows.filter((row) => row.status === "watch").length,
    critical: baselineRows.filter((row) => row.status === "critical").length,
  },
  ascendant: summarizeDeck(baselineRows, ASCENDANT),
  vanguard: summarizeDeck(baselineRows, VANGUARD),
  rows: baselineRows,
};
const candidateAscendant = summarizeDeck(candidateRows, ASCENDANT);
const candidateVanguard = summarizeDeck(candidateRows, VANGUARD);
const candidate = {
  mutation: {
    defId: u04HealthPlusOne.defId,
    name: u04HealthPlusOne.name,
    before: { power: u04.power, health: u04.health },
    after: { power: u04HealthPlusOne.power, health: u04HealthPlusOne.health },
  },
  affectedHealth: {
    healthy: candidateRows.filter((row) => row.status === "healthy").length,
    watch: candidateRows.filter((row) => row.status === "watch").length,
    critical: candidateRows.filter((row) => row.status === "critical").length,
  },
  ascendant: candidateAscendant,
  vanguard: candidateVanguard,
  deltaAscendantPp: round1(candidateAscendant.winRate - baseline.ascendant.winRate),
  deltaVanguardPp: round1(candidateVanguard.winRate - baseline.vanguard.winRate),
  newCriticals: deltas.filter((row) => row.baselineStatus !== "critical" && row.candidateStatus === "critical"),
  clearedCriticals: deltas.filter((row) => row.baselineStatus === "critical" && row.candidateStatus !== "critical"),
  deltas,
  rows: candidateRows,
};

const advance =
  candidate.newCriticals.length === 0 &&
  candidate.ascendant.health.critical < baseline.ascendant.health.critical &&
  candidate.vanguard.health.critical <= baseline.vanguard.health.critical &&
  candidate.affectedHealth.critical < baseline.affectedHealth.critical;

const report = {
  version: "1.11-florestia-carddef-finalist-1",
  methodology:
    "High-sample paired production-safety validation of the only plausible short-screen CardDef candidate. Baseline and candidate each use all 21 matchups affected by a shared Florestia CardDef, five certified strata and 40 games per stratum. The candidate is registry-injected only; no product CardDef is mutated. When --global is provided, the baseline is required to reproduce the same-sha 13,200-game global diagnostic exactly on all 21 affected rows.",
  gamesPerStratum: GAMES_PER_STRATUM,
  strata: STRATA,
  gamesPerMatchup: GAMES_PER_STRATUM * STRATA,
  affectedMatchups: affectedMatchups.length,
  gamesPerScenario: affectedMatchups.length * GAMES_PER_STRATUM * STRATA,
  totalGames: affectedMatchups.length * GAMES_PER_STRATUM * STRATA * 2,
  globalBaselineCrossCheck: Boolean(globalPath),
  baseline,
  candidate,
  verdict: advance ? "advance-to-product-candidate" : "reject-no-product-mutation",
  productionGate: {
    requiresNoNewCriticals: candidate.newCriticals.length === 0,
    requiresFewerAscendantCriticals: candidate.ascendant.health.critical < baseline.ascendant.health.critical,
    requiresNoVanguardCriticalIncrease: candidate.vanguard.health.critical <= baseline.vanguard.health.critical,
    requiresFewerAffectedCriticals: candidate.affectedHealth.critical < baseline.affectedHealth.critical,
  },
};

if (writePath) fs.writeFileSync(writePath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
console.log(
  `VANILLA 1.11 FLORESTIA CARDDEF FINALIST: ${report.verdict.toUpperCase()} — ${report.totalGames} games · Ascendant ${baseline.ascendant.winRate}%→${candidate.ascendant.winRate}% (${baseline.ascendant.health.critical}C→${candidate.ascendant.health.critical}C) · Vanguard ${baseline.vanguard.winRate}%→${candidate.vanguard.winRate}% (${baseline.vanguard.health.critical}C→${candidate.vanguard.health.critical}C) · newCriticals=${candidate.newCriticals.length}`,
);
