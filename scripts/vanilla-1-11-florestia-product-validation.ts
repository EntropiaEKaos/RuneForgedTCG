import fs from "node:fs";
import { evaluateMatchup } from "../src/game/balance-health";
import { getCard } from "../src/game/cards";
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
  throw new Error(`Expected at least ${STRATA} certified Vanilla strata`);
}

const historicalU04 = VANILLA_FLORESTIA_CARDS.van_forest_u04;
if (!historicalU04) throw new Error("Missing historical van_forest_u04");
const runtimeU04 = getCard("van_forest_u04");
if (historicalU04.health !== 3 || runtimeU04.health !== 4 || runtimeU04.power !== 2 || runtimeU04.cost !== 2) {
  throw new Error(
    `Vanilla 1.11 CardDef contract mismatch: source=${historicalU04.power}/${historicalU04.health}, runtime=${runtimeU04.power}/${runtimeU04.health}, cost=${runtimeU04.cost}`,
  );
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

function runRows(cardSnapshot: CardDef[] = []): Row[] {
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
      return {
        leftId: matchup.leftId,
        rightId: matchup.rightId,
        ...totals,
        status: evaluateMatchup(totals.winRateA).status,
      };
    });
  };
  return cardSnapshot.length ? withRegisteredCardSnapshot(cardSnapshot, simulate) : simulate();
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

// Reconstruct the legacy 1.10 product by shadowing only the 1.11 runtime override.
const legacyRows = runRows([historicalU04]);
const productRows = runRows();

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
    throw new Error("Global diagnostic sample does not match product-validation sample");
  }
  const globalRows = new Map((globalReport.rows ?? []).map((row) => [`${row.deckA}__${row.deckB}`, row]));
  for (const product of productRows) {
    const global = globalRows.get(`${product.leftId}__${product.rightId}`);
    if (!global) throw new Error(`Global diagnostic missing ${product.leftId} vs ${product.rightId}`);
    if (
      global.winsA !== product.winsA ||
      global.winsB !== product.winsB ||
      global.draws !== product.draws ||
      global.completedGames !== product.completedGames ||
      global.winRateA !== product.winRateA
    ) {
      throw new Error(`Product/global baseline drift for ${product.leftId} vs ${product.rightId}`);
    }
  }
}

const legacyMap = new Map<string, Row>(legacyRows.map((row) => [`${row.leftId}__${row.rightId}`, row]));
const deltas = productRows.map((row) => {
  const key = `${row.leftId}__${row.rightId}`;
  const legacy = legacyMap.get(key);
  if (!legacy) throw new Error(`Missing legacy row ${key}`);
  return {
    key,
    legacyWinRateA: legacy.winRateA,
    productWinRateA: row.winRateA,
    deltaLeftPp: round1(row.winRateA - legacy.winRateA),
    legacyStatus: legacy.status,
    productStatus: row.status,
  };
});

const legacy = {
  affectedHealth: {
    healthy: legacyRows.filter((row) => row.status === "healthy").length,
    watch: legacyRows.filter((row) => row.status === "watch").length,
    critical: legacyRows.filter((row) => row.status === "critical").length,
  },
  ascendant: summarizeDeck(legacyRows, ASCENDANT),
  vanguard: summarizeDeck(legacyRows, VANGUARD),
};
const productAscendant = summarizeDeck(productRows, ASCENDANT);
const productVanguard = summarizeDeck(productRows, VANGUARD);
const product = {
  affectedHealth: {
    healthy: productRows.filter((row) => row.status === "healthy").length,
    watch: productRows.filter((row) => row.status === "watch").length,
    critical: productRows.filter((row) => row.status === "critical").length,
  },
  ascendant: productAscendant,
  vanguard: productVanguard,
  deltaAscendantPp: round1(productAscendant.winRate - legacy.ascendant.winRate),
  deltaVanguardPp: round1(productVanguard.winRate - legacy.vanguard.winRate),
  newCriticals: deltas.filter((row) => row.legacyStatus !== "critical" && row.productStatus === "critical"),
  clearedCriticals: deltas.filter((row) => row.legacyStatus === "critical" && row.productStatus !== "critical"),
};

const gate = {
  runtimeCardDefIsExact: runtimeU04.cost === 2 && runtimeU04.power === 2 && runtimeU04.health === 4,
  noNewCriticals: product.newCriticals.length === 0,
  fewerAscendantCriticals: product.ascendant.health.critical < legacy.ascendant.health.critical,
  noVanguardCriticalIncrease: product.vanguard.health.critical <= legacy.vanguard.health.critical,
  fewerAffectedCriticals: product.affectedHealth.critical < legacy.affectedHealth.critical,
};
const pass = Object.values(gate).every(Boolean);

const report = {
  version: "1.11-florestia-product-validation-1",
  methodology:
    "Production-candidate verification of the actual Vanilla 1.11 runtime CardDef. The historical regional snapshot (u04 2/3) is injected only to reconstruct the pre-1.11 baseline; the candidate side uses the real runtime catalog (u04 2/4). All 21 affected matchups use five certified strata and 40 games per stratum. Product rows must match the same-SHA 13,200-game global audit exactly.",
  mutation: {
    defId: runtimeU04.defId,
    name: runtimeU04.name,
    legacy: { cost: historicalU04.cost, power: historicalU04.power, health: historicalU04.health },
    product: { cost: runtimeU04.cost, power: runtimeU04.power, health: runtimeU04.health },
  },
  gamesPerStratum: GAMES_PER_STRATUM,
  strata: STRATA,
  gamesPerMatchup: GAMES_PER_STRATUM * STRATA,
  affectedMatchups: affectedMatchups.length,
  gamesPerScenario: affectedMatchups.length * GAMES_PER_STRATUM * STRATA,
  totalGames: affectedMatchups.length * GAMES_PER_STRATUM * STRATA * 2,
  globalProductCrossCheck: Boolean(globalPath),
  legacy,
  product,
  deltas,
  productionGate: gate,
  verdict: pass ? "production-candidate-pass" : "production-candidate-blocked",
};

if (writePath) fs.writeFileSync(writePath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
console.log(
  `VANILLA 1.11 FLORESTIA PRODUCT: ${report.verdict.toUpperCase()} — ${report.totalGames} games · Ascendant ${legacy.ascendant.winRate}%→${product.ascendant.winRate}% (${legacy.ascendant.health.critical}C→${product.ascendant.health.critical}C) · Vanguard ${legacy.vanguard.winRate}%→${product.vanguard.winRate}% (${legacy.vanguard.health.critical}C→${product.vanguard.health.critical}C) · newCriticals=${product.newCriticals.length}`,
);
if (!pass) process.exitCode = 1;
