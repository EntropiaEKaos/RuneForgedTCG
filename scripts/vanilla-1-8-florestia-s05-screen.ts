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
if (selectedMatchups.length !== 21) throw new Error(`expected 21 Florestia matchups, found ${selectedMatchups.length}`);

const baselineS05 = structuredClone(CARDS.van_forest_s05);
const baselineS08 = structuredClone(CARDS.van_forest_s08);
if (!baselineS05?.spell || baselineS05.spell.kind !== "healNexus") throw new Error("s05 heal contract missing");
if (!baselineS08?.spell || baselineS08.spell.kind !== "buffRace") throw new Error("s08 tribal contract missing");

const variants = [
  { id: "baseline", s05Cost: 4, s05Heal: 4, s08Dual: false },
  { id: "s05_heal5", s05Cost: 4, s05Heal: 5, s08Dual: false },
  { id: "s05_cost3", s05Cost: 3, s05Heal: 4, s08Dual: false },
  { id: "s05_heal5_s08_dual", s05Cost: 4, s05Heal: 5, s08Dual: true },
  { id: "s05_cost3_s08_dual", s05Cost: 3, s05Heal: 4, s08Dual: true },
] as const;

function round1(value: number): number { return Math.round(value * 10) / 10; }
function resetCards() {
  CARDS.van_forest_s05 = structuredClone(baselineS05);
  CARDS.van_forest_s08 = structuredClone(baselineS08);
}
function applyVariant(variant: typeof variants[number]) {
  resetCards();
  const s05 = CARDS.van_forest_s05;
  if (!s05.spell || s05.spell.kind !== "healNexus") throw new Error("s05 effect disappeared");
  s05.cost = variant.s05Cost;
  s05.spell.amount = variant.s05Heal;
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
  return { completedGames, winsA, winsB, draws, winRateA: round1(winsA / decisive * 100), winRateB: round1(winsB / decisive * 100) };
}
type MatchRow = ReturnType<typeof aggregate> & { deckA: string; deckB: string };
function summarizeTarget(targetId: string, rows: MatchRow[]) {
  let wins = 0, losses = 0, draws = 0, healthy = 0, watch = 0, critical = 0;
  const matchups = [];
  for (const row of rows) {
    if (row.deckA !== targetId && row.deckB !== targetId) continue;
    const asA = row.deckA === targetId;
    const rate = asA ? row.winRateA : row.winRateB;
    const status = evaluateMatchup(rate).status;
    wins += asA ? row.winsA : row.winsB;
    losses += asA ? row.winsB : row.winsA;
    draws += row.draws;
    if (status === "healthy") healthy += 1; else if (status === "watch") watch += 1; else critical += 1;
    matchups.push({ opponent: asA ? row.deckB : row.deckA, winRate: rate, status });
  }
  return {
    targetId, games: wins + losses + draws, wins, losses, draws,
    winRate: round1(wins / Math.max(1, wins + losses) * 100),
    matchupHealth: { healthy, watch, critical },
    matchups: matchups.sort((a, b) => a.winRate - b.winRate || a.opponent.localeCompare(b.opponent)),
  };
}

const poolErrors = validateVanillaBalancePool();
let incompleteStrata = 0;
const variantReports = [];
for (const variant of variants) {
  applyVariant(variant);
  const rows: MatchRow[] = [];
  for (const matchup of selectedMatchups) {
    const parts: SimulationSummary[] = [];
    for (let stratum = 0; stratum < STRATA; stratum += 1) {
      const result = runBalanceSimulation(matchup.leftId, matchup.rightId, GAMES_PER_STRATUM, vanillaBalanceSeed(matchup, stratum), overrides);
      if (result.completedGames !== GAMES_PER_STRATUM) incompleteStrata += 1;
      parts.push(result);
    }
    rows.push({ deckA: matchup.leftId, deckB: matchup.rightId, ...aggregate(parts) });
  }
  variantReports.push({ id: variant.id, mutation: variant, totalGames: rows.reduce((sum, row) => sum + row.completedGames, 0), targets: TARGETS.map((target) => summarizeTarget(target, rows)), rows });
}
resetCards();

const baseline = variantReports[0];
const comparison = variantReports.map((variant) => ({
  id: variant.id,
  targets: variant.targets.map((target) => {
    const base = baseline.targets.find((row) => row.targetId === target.targetId)!;
    return {
      targetId: target.targetId,
      winRate: target.winRate,
      deltaVsBaseline: round1(target.winRate - base.winRate),
      matchupHealth: target.matchupHealth,
      criticalDelta: target.matchupHealth.critical - base.matchupHealth.critical,
    };
  }),
}));
const qualityGate = poolErrors.length === 0 && incompleteStrata === 0 ? "pass" : "blocked";
const report = {
  version: "Vanilla 1.8 Florestia recovery screen",
  methodology: "Exact production Balance Lab with common deterministic seeds. Screens the minimum s05 recovery changes and their combination with the evidence-neutral s08 dual-race semantic correction. No recipe, AI or engine mutation.",
  gamesPerStratum: GAMES_PER_STRATUM, strata: STRATA, gamesPerMatchup: GAMES_PER_STRATUM * STRATA,
  matchupsPerVariant: selectedMatchups.length, variants: variants.length,
  totalGames: variantReports.reduce((sum, row) => sum + row.totalGames, 0),
  quality: { gate: qualityGate, poolErrors, incompleteStrata }, comparison, variantReports,
};
if (writePath) {
  fs.mkdirSync(writePath.split("/").slice(0, -1).join("/") || ".", { recursive: true });
  fs.writeFileSync(writePath, `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify({ ...report, variantReports: undefined }, null, 2));
if (qualityGate !== "pass") {
  console.error(`VANILLA 1.8 FLORESTIA RECOVERY SCREEN: BLOCKED — ${poolErrors.length} pool errors · ${incompleteStrata} incomplete strata`);
  process.exitCode = 1;
} else console.log(`VANILLA 1.8 FLORESTIA RECOVERY SCREEN: PASS — ${report.totalGames} games · ${variants.length} paired variants`);
