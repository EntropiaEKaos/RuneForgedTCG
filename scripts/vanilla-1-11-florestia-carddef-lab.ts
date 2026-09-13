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
const PRODUCT_BASELINE_SHA = "dd0c85072f7a01d105ae02253c8c1071a869ba98";
const RECIPE_SCREEN_SHA = "a4828bc134d501d90606ab6e0fadac1bdc2278c2";
const gamesPerStratum = Math.max(10, Math.min(60, Number(process.argv[2]) || 20));
const strata = Math.max(3, Math.min(VANILLA_BALANCE_STRATUM_BASES.length, Number(process.argv[3]) || 3));
const writeIndex = process.argv.indexOf("--write");
const writePath = writeIndex >= 0 ? process.argv[writeIndex + 1] : "";

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

function cloneCard(defId: string, patch: Partial<CardDef>): CardDef {
  const current = VANILLA_FLORESTIA_CARDS[defId];
  if (!current) throw new Error(`Missing Florestia CardDef ${defId}`);
  return { ...current, ...patch } as CardDef;
}

function normalizeBeastTaxonomy(): CardDef[] {
  return Object.values(VANILLA_FLORESTIA_CARDS)
    .filter((card) => card.race === "Beast" || card.secondaryRaces?.includes("Beast"))
    .map((card) => ({
      ...card,
      race: card.race === "Beast" ? "Besta" : card.race,
      secondaryRaces: card.secondaryRaces?.map((race) => race === "Beast" ? "Besta" : race),
    } as CardDef));
}

const u04 = VANILLA_FLORESTIA_CARDS.van_forest_u04;
const u05 = VANILLA_FLORESTIA_CARDS.van_forest_u05;
if (!u04 || !u05) throw new Error("Missing u04/u05 CardDefs");

const candidates: Array<{ id: string; rationale: string; definitions: CardDef[] }> = [
  {
    id: "baseline_current",
    rationale: "Current post-1.10 product CardDefs; no registry override.",
    definitions: [],
  },
  {
    id: "u05_health_plus_1",
    rationale: "Javali de Casca is tripled in Ascendant but only doubled in Vanguard; +1 health tests early Haste-body persistence against Vanguard pressure.",
    definitions: [cloneCard("van_forest_u05", { health: (u05.health ?? 0) + 1 })],
  },
  {
    id: "u04_health_plus_1",
    rationale: "Caçadora da Alcateia is tripled in Ascendant but only doubled in Vanguard; +1 health tests survival of the early board-wide pressure enabler.",
    definitions: [cloneCard("van_forest_u04", { health: (u04.health ?? 0) + 1 })],
  },
  {
    id: "u04_u05_health_plus_1",
    rationale: "Combined early-board persistence ceiling test. This is intentionally a lab-only upper bound, not a promotion recommendation.",
    definitions: [
      cloneCard("van_forest_u04", { health: (u04.health ?? 0) + 1 }),
      cloneCard("van_forest_u05", { health: (u05.health ?? 0) + 1 }),
    ],
  },
  {
    id: "normalize_beast_to_besta",
    rationale: "Taxonomy diagnostic only: tests whether mixed Beast/Besta labels materially suppress Besta-specific Florestia tribal effects. No stat changes.",
    definitions: normalizeBeastTaxonomy(),
  },
];

const affectedMatchups = vanillaBalanceMatchups().filter(
  (row) => row.leftId === ASCENDANT || row.rightId === ASCENDANT || row.leftId === VANGUARD || row.rightId === VANGUARD,
);
if (affectedMatchups.length !== 21) throw new Error(`Expected 21 Florestia-affected matchups, found ${affectedMatchups.length}`);

function runCandidate(candidate: (typeof candidates)[number]) {
  const simulate = () => {
    const overrides = vanillaExperimentalOverrides();
    const rows = [];
    for (const matchup of affectedMatchups) {
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
      const totals = aggregate(parts);
      const health = evaluateMatchup(totals.winRateA);
      rows.push({
        leftId: matchup.leftId,
        rightId: matchup.rightId,
        ...totals,
        status: health.status,
        deviation: health.deviation,
      });
    }
    return rows;
  };

  const rows = candidate.definitions.length > 0
    ? withRegisteredCardSnapshot(candidate.definitions, simulate)
    : simulate();

  const summarizeDeck = (deckId: string) => {
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
        const health = evaluateMatchup(winRate);
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
          status: health.status,
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
  };

  return {
    id: candidate.id,
    rationale: candidate.rationale,
    mutatedCardDefs: candidate.definitions.map((card) => ({
      defId: card.defId,
      name: card.name,
      cost: card.cost,
      power: card.power,
      health: card.health,
      race: card.race,
      secondaryRaces: card.secondaryRaces,
    })),
    affectedRows: rows,
    affectedHealth: {
      healthy: rows.filter((row) => row.status === "healthy").length,
      watch: rows.filter((row) => row.status === "watch").length,
      critical: rows.filter((row) => row.status === "critical").length,
    },
    ascendant: summarizeDeck(ASCENDANT),
    vanguard: summarizeDeck(VANGUARD),
  };
}

const rawResults = candidates.map(runCandidate);
const baseline = rawResults.find((row) => row.id === "baseline_current");
if (!baseline) throw new Error("Missing CardDef lab baseline");
type AffectedRow = (typeof baseline.affectedRows)[number];
const baselineRows = new Map<string, AffectedRow>(
  baseline.affectedRows.map((row) => [`${row.leftId}__${row.rightId}`, row]),
);

const results = rawResults.map((row) => {
  const deltas = row.affectedRows.map((matchup) => {
    const key = `${matchup.leftId}__${matchup.rightId}`;
    const base = baselineRows.get(key);
    if (!base) throw new Error(`Missing baseline row ${key}`);
    return {
      key,
      baselineWinRateA: base.winRateA,
      candidateWinRateA: matchup.winRateA,
      deltaLeftPp: round1(matchup.winRateA - base.winRateA),
      baselineStatus: base.status,
      candidateStatus: matchup.status,
    };
  });
  return {
    ...row,
    deltaAscendantPp: round1(row.ascendant.winRate - baseline.ascendant.winRate),
    deltaVanguardPp: round1(row.vanguard.winRate - baseline.vanguard.winRate),
    deltaAffectedCriticals: row.affectedHealth.critical - baseline.affectedHealth.critical,
    newCriticals: deltas.filter((d) => d.baselineStatus !== "critical" && d.candidateStatus === "critical").length,
    clearedCriticals: deltas.filter((d) => d.baselineStatus === "critical" && d.candidateStatus !== "critical").length,
    deltas,
  };
});

results.sort(
  (a, b) =>
    a.affectedHealth.critical - b.affectedHealth.critical ||
    a.newCriticals - b.newCriticals ||
    a.ascendant.health.critical - b.ascendant.health.critical ||
    a.vanguard.health.critical - b.vanguard.health.critical ||
    b.ascendant.worstMatchupWinRate - a.ascendant.worstMatchupWinRate ||
    b.ascendant.winRate - a.ascendant.winRate ||
    a.id.localeCompare(b.id),
);

const report = {
  version: "1.11-florestia-carddef-lab-1",
  methodology:
    "Read-only CardDef lab after composition-only headroom failed to produce a clean 1.11 candidate. Each candidate is injected through the isolated custom-card registry snapshot and affects both Florestia Vanguard and Ascendant exactly as a shared regional CardDef change would. Only the 21 matchups involving either Florestia deck are resimulated because all 45 non-Florestia matchups are invariant.",
  productBaselineSource: PRODUCT_BASELINE_SHA,
  recipeScreenSource: RECIPE_SCREEN_SHA,
  gamesPerStratum,
  strata,
  gamesPerMatchup: gamesPerStratum * strata,
  affectedMatchups: affectedMatchups.length,
  gamesPerCandidate: affectedMatchups.length * gamesPerStratum * strata,
  candidateCount: candidates.length,
  totalGames: candidates.length * affectedMatchups.length * gamesPerStratum * strata,
  baseline: results.find((row) => row.id === "baseline_current"),
  ranking: results,
};

if (writePath) fs.writeFileSync(writePath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
const leader = results[0];
console.log(
  `VANILLA 1.11 FLORESTIA CARDDEF LAB: PASS — ${report.totalGames} games · leader=${leader.id} · Ascendant=${leader.ascendant.winRate}%/${leader.ascendant.health.critical}C · Vanguard=${leader.vanguard.winRate}%/${leader.vanguard.health.critical}C · affectedCriticals=${leader.affectedHealth.critical}`,
);
