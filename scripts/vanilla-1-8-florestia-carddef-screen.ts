import fs from "node:fs";
import { evaluateMatchup } from "../src/game/balance-health";
import { CARDS } from "../src/game/cards";
import {
  VANILLA_BALANCE_STRATUM_BASES,
  validateVanillaBalancePool,
  vanillaBalanceMatchups,
  vanillaBalanceSeed,
  vanillaExperimentalOverrides,
} from "../src/game/vanilla-balance-lab";
import { runBalanceSimulation, type SimulationSummary } from "../src/lib/balance-simulator";

const TARGETS = ["vanilla_forest_1", "vanilla_forest_2"] as const;
const GAMES_PER_STRATUM = 40;
const STRATA = 5;
const writeIndex = process.argv.indexOf("--write");
const writePath = writeIndex >= 0 ? process.argv[writeIndex + 1] : "";
const overrides = vanillaExperimentalOverrides();
const selectedMatchups = vanillaBalanceMatchups().filter((row) => TARGETS.includes(row.leftId as typeof TARGETS[number]) || TARGETS.includes(row.rightId as typeof TARGETS[number]));

if (STRATA > VANILLA_BALANCE_STRATUM_BASES.length) throw new Error("strata outside certified seed table");
if (selectedMatchups.length !== 21) throw new Error(`expected 21 Florestia-involving matchups, found ${selectedMatchups.length}`);

const baselineU12 = structuredClone(CARDS.van_forest_u12);
const baselineS08 = structuredClone(CARDS.van_forest_s08);
if (!baselineU12?.trigger?.effect || baselineU12.trigger.effect.kind !== "buffRace") throw new Error("u12 buffRace contract missing");
if (!baselineS08?.spell || baselineS08.spell.kind !== "buffRace") throw new Error("s08 buffRace contract missing");

const variants = [
  { id: "baseline", u12Dual: false, s08Dual: false },
  { id: "u12_dual_scope", u12Dual: true, s08Dual: false },
  { id: "s08_dual_scope", u12Dual: false, s08Dual: true },
  { id: "both_dual_scope", u12Dual: true, s08Dual: true },
] as const;

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function resetCards() {
  CARDS.van_forest_u12 = structuredClone(baselineU12);
  CARDS.van_forest_s08 = structuredClone(baselineS08);
}

function applyVariant(variant: typeof variants[number]) {
  resetCards();
  if (variant.u12Dual) {
    const effect = CARDS.van_forest_u12.trigger?.effect;
    if (!effect || effect.kind !== "buffRace") throw new Error("u12 effect disappeared");
    delete effect.race;
    effect.races = ["Beast", "Besta"];
  }
  if (variant.s08Dual) {
    const effect = CARDS.van_forest_s08.spell;
    if (!effect || effect.kind !== "buffRace") throw new Error("s08 effect disappeared");
    delete effect.race;
    effect.races = ["Beast", "Besta"];
  }
}

function aggregate(parts: SimulationSummary[]) {
  const winsA = parts.reduce((sum, row) => sum + row.winsA, 0);
  const winsB = parts.reduce((sum, row) => sum + row.winsB, 0);
  const draws = parts.reduce((sum, row) => sum + row.draws, 0);
  const completedGames = parts.reduce((sum, row) => sum + row.completedGames, 0);
  const decisive = Math.max(1, winsA + winsB);
  return {
    completedGames,
    winsA,
    winsB,
    draws,
    winRateA: round1((winsA / decisive) * 100),
    winRateB: round1((winsB / decisive) * 100),
    avgRounds: round1(parts.reduce((sum, row) => sum + row.avgRounds * row.completedGames, 0) / Math.max(1, completedGames)),
  };
}

type MatchRow = ReturnType<typeof aggregate> & { deckA: string; deckB: string };

function summarizeTarget(targetId: string, rows: MatchRow[]) {
  let wins = 0;
  let losses = 0;
  let draws = 0;
  let healthy = 0;
  let watch = 0;
  let critical = 0;
  const matchups = [];
  for (const row of rows) {
    if (row.deckA !== targetId && row.deckB !== targetId) continue;
    const asA = row.deckA === targetId;
    const targetWins = asA ? row.winsA : row.winsB;
    const targetLosses = asA ? row.winsB : row.winsA;
    const rate = asA ? row.winRateA : row.winRateB;
    const health = evaluateMatchup(rate).status;
    wins += targetWins;
    losses += targetLosses;
    draws += row.draws;
    if (health === "healthy") healthy += 1;
    else if (health === "watch") watch += 1;
    else critical += 1;
    matchups.push({ opponent: asA ? row.deckB : row.deckA, winRate: rate, health, avgRounds: row.avgRounds });
  }
  return {
    targetId,
    games: wins + losses + draws,
    wins,
    losses,
    draws,
    winRate: round1((wins / Math.max(1, wins + losses)) * 100),
    matchupHealth: { healthy, watch, critical },
    matchups: matchups.sort((a, b) => a.winRate - b.winRate || a.opponent.localeCompare(b.opponent)),
  };
}

const poolErrors = validateVanillaBalancePool();
const variantReports = [];
let incompleteStrata = 0;

for (const variant of variants) {
  applyVariant(variant);
  const rows: MatchRow[] = [];
  for (const matchup of selectedMatchups) {
    const parts: SimulationSummary[] = [];
    for (let stratum = 0; stratum < STRATA; stratum += 1) {
      const result = runBalanceSimulation(
        matchup.leftId,
        matchup.rightId,
        GAMES_PER_STRATUM,
        vanillaBalanceSeed(matchup, stratum),
        overrides,
      );
      if (result.completedGames !== GAMES_PER_STRATUM) incompleteStrata += 1;
      parts.push(result);
    }
    rows.push({ deckA: matchup.leftId, deckB: matchup.rightId, ...aggregate(parts) });
  }
  const targets = TARGETS.map((target) => summarizeTarget(target, rows));
  variantReports.push({
    id: variant.id,
    cardDefMutation: {
      u12: variant.u12Dual ? { kind: "buffRace", races: ["Beast", "Besta"] } : { kind: "buffRace", race: "Besta" },
      s08: variant.s08Dual ? { kind: "buffRace", races: ["Beast", "Besta"] } : { kind: "buffRace", race: "Besta" },
    },
    totalGames: rows.reduce((sum, row) => sum + row.completedGames, 0),
    targets,
    rows,
  });
}
resetCards();

const baseline = variantReports.find((row) => row.id === "baseline")!;
const comparison = variantReports.map((variant) => ({
  id: variant.id,
  targets: variant.targets.map((target) => {
    const baseTarget = baseline.targets.find((row) => row.targetId === target.targetId)!;
    return {
      targetId: target.targetId,
      winRate: target.winRate,
      deltaVsBaseline: round1(target.winRate - baseTarget.winRate),
      matchupHealth: target.matchupHealth,
      criticalDelta: target.matchupHealth.critical - baseTarget.matchupHealth.critical,
    };
  }),
}));

const qualityGate = poolErrors.length === 0 && incompleteStrata === 0 ? "pass" : "blocked";
const report = {
  version: "Vanilla 1.8 Florestia CardDef semantic screen",
  methodology: "Exact production Balance Lab engine, recipe overrides, deterministic seeds and policies. Four paired CardDef variants; only Florestia-involving matchups run. No recipe, AI or engine mutation.",
  gamesPerStratum: GAMES_PER_STRATUM,
  strata: STRATA,
  gamesPerMatchup: GAMES_PER_STRATUM * STRATA,
  matchupsPerVariant: selectedMatchups.length,
  variants: variants.length,
  totalGames: variantReports.reduce((sum, row) => sum + row.totalGames, 0),
  quality: { gate: qualityGate, poolErrors, incompleteStrata },
  comparison,
  variantReports,
};

if (writePath) {
  fs.mkdirSync(writePath.split("/").slice(0, -1).join("/") || ".", { recursive: true });
  fs.writeFileSync(writePath, `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify({ ...report, variantReports: undefined }, null, 2));
if (qualityGate !== "pass") {
  console.error(`VANILLA 1.8 FLORESTIA CARDDEF SCREEN: BLOCKED — ${poolErrors.length} pool errors · ${incompleteStrata} incomplete strata`);
  process.exitCode = 1;
} else {
  console.log(`VANILLA 1.8 FLORESTIA CARDDEF SCREEN: PASS — ${report.totalGames} games · ${variants.length} paired variants`);
}
