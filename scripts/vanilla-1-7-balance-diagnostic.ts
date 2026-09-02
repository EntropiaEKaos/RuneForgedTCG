import fs from "node:fs";
import { evaluateMatchup } from "../src/game/balance-health";
import { getCard } from "../src/game/cards";
import {
  VANILLA_BALANCE_STRATUM_BASES,
  vanillaBalanceMatchups,
  vanillaBalanceSeed,
  vanillaExperimentalOverrides,
} from "../src/game/vanilla-balance-lab";
import { runBalanceSimulation, type SimulationSummary } from "../src/lib/balance-simulator";

const GAMES = Math.max(10, Math.min(80, Number(process.argv[2]) || 16));
const STRATA = Math.max(3, Math.min(5, Number(process.argv[3]) || 3));
const writeIndex = process.argv.indexOf("--write");
const writePath = writeIndex >= 0 ? process.argv[writeIndex + 1] : "";
if (STRATA > VANILLA_BALANCE_STRATUM_BASES.length) throw new Error("strata outside seed table");

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
function pct(n: number, d: number): number {
  return round1((n / Math.max(1, d)) * 100);
}
function range(prefix: string, from: number, to: number): string[] {
  return Array.from({ length: to - from + 1 }, (_, index) => `${prefix}${String(from + index).padStart(2, "0")}`);
}
function copies(ids: readonly string[]): string[] {
  return ids.flatMap((id) => [id, id]);
}
function singletonize(ids: readonly string[], singletonIds: readonly string[]): string[] {
  const singletons = new Set(singletonIds);
  return ids.flatMap((id) => singletons.has(id) ? [id] : [id, id]);
}
function assertRecipe(name: string, cards: string[]): void {
  if (cards.length !== 40) throw new Error(`${name}: expected 40 cards, found ${cards.length}`);
  const counts = new Map<string, number>();
  for (const defId of cards) {
    getCard(defId);
    counts.set(defId, (counts.get(defId) ?? 0) + 1);
  }
  for (const [defId, count] of counts) {
    if (count > 2) throw new Error(`${name}: ${defId} has ${count} copies`);
  }
}

const baseOverrides = vanillaExperimentalOverrides();

type Recipe = { name: string; rationale: string; cards: string[] };
type Result = {
  targetId: string;
  name: string;
  rationale: string;
  stats: ReturnType<typeof recipeStats>;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  avgRounds: number;
  minWinRate: number;
  maxWinRate: number;
  health: { healthy: number; watch: number; critical: number };
  matchups: Array<{ opponent: string; games: number; winRate: number; status: string }>;
};

function recipeStats(cards: string[]) {
  const defs = cards.map(getCard);
  return {
    units: defs.filter((card) => card.type === "Unit").length,
    spells: defs.filter((card) => card.type === "Spell").length,
    permanents: defs.filter((card) => ["Enchantment", "Artifact", "Equipment", "Sentinela"].includes(card.type)).length,
    uniqueCards: new Set(cards).size,
    averageCost: round1(defs.reduce((sum, card) => sum + card.cost, 0) / cards.length),
    early0To2: defs.filter((card) => card.cost <= 2).length,
    topEnd7Plus: defs.filter((card) => card.cost >= 7).length,
    hasteCopies: defs.filter((card) => (card.keywords ?? []).includes("Haste")).length,
    directNexusEffects: defs.filter((card) =>
      card.spell?.kind === "damageNexus" || card.trigger?.effect?.kind === "damageNexus",
    ).length,
  };
}

function runRecipe(targetId: string, recipe: Recipe): Result {
  assertRecipe(recipe.name, recipe.cards);
  const targetBase = baseOverrides[targetId];
  if (!targetBase) throw new Error(`${targetId}: missing baseline override`);
  const overrides = { ...baseOverrides, [targetId]: { ...targetBase, cards: [...recipe.cards] } };
  const matchups = vanillaBalanceMatchups().filter((row) => row.leftId === targetId || row.rightId === targetId);
  if (matchups.length !== 11) throw new Error(`${targetId}: expected 11 matchups, found ${matchups.length}`);

  let wins = 0;
  let losses = 0;
  let draws = 0;
  let games = 0;
  let weightedRounds = 0;
  const health = { healthy: 0, watch: 0, critical: 0 };
  const matchupRows: Result["matchups"] = [];

  for (const matchup of matchups) {
    const parts: SimulationSummary[] = [];
    for (let stratum = 0; stratum < STRATA; stratum += 1) {
      parts.push(runBalanceSimulation(
        matchup.leftId,
        matchup.rightId,
        GAMES,
        vanillaBalanceSeed(matchup, stratum),
        overrides,
      ));
    }
    const targetIsA = matchup.leftId === targetId;
    const matchupWins = parts.reduce((sum, row) => sum + (targetIsA ? row.winsA : row.winsB), 0);
    const matchupLosses = parts.reduce((sum, row) => sum + (targetIsA ? row.winsB : row.winsA), 0);
    const matchupDraws = parts.reduce((sum, row) => sum + row.draws, 0);
    const matchupGames = parts.reduce((sum, row) => sum + row.completedGames, 0);
    const rate = pct(matchupWins, matchupWins + matchupLosses);
    const status = evaluateMatchup(rate).status;
    health[status] += 1;
    wins += matchupWins;
    losses += matchupLosses;
    draws += matchupDraws;
    games += matchupGames;
    weightedRounds += parts.reduce((sum, row) => sum + row.avgRounds * row.completedGames, 0);
    matchupRows.push({
      opponent: targetIsA ? matchup.rightId : matchup.leftId,
      games: matchupGames,
      winRate: rate,
      status,
    });
  }

  const rates = matchupRows.map((row) => row.winRate);
  return {
    targetId,
    name: recipe.name,
    rationale: recipe.rationale,
    stats: recipeStats(recipe.cards),
    games,
    wins,
    losses,
    draws,
    winRate: pct(wins, wins + losses),
    avgRounds: round1(weightedRounds / Math.max(1, games)),
    minWinRate: Math.min(...rates),
    maxWinRate: Math.max(...rates),
    health,
    matchups: matchupRows,
  };
}

const emberUnits = range("van_ember_u", 1, 18);
const ember = (suffix: string) => `van_ember_${suffix}`;
const emberVanguardRecipes: Recipe[] = [
  {
    name: "baseline_36u4s",
    rationale: "Historical Emberhold Vanguard: every Unit duplicated plus 2x s01/s02.",
    cards: [...copies(emberUnits), ember("s01"), ember("s01"), ember("s02"), ember("s02")],
  },
  {
    name: "topend34_stun",
    rationale: "Singletonize u17/u18 and add 2x s04 Stun while preserving cheap burn.",
    cards: [...singletonize(emberUnits, [ember("u17"), ember("u18")]), ember("s01"), ember("s01"), ember("s02"), ember("s02"), ember("s04"), ember("s04")],
  },
  {
    name: "haste34_stun",
    rationale: "Singletonize u08/u13, the densest midgame Haste bodies, and add 2x s04 Stun.",
    cards: [...singletonize(emberUnits, [ember("u08"), ember("u13")]), ember("s01"), ember("s01"), ember("s02"), ember("s02"), ember("s04"), ember("s04")],
  },
  {
    name: "haste32_control",
    rationale: "Singletonize u03/u08/u13/u18 and add Stun + AoE while retaining s01/s02.",
    cards: [...singletonize(emberUnits, [ember("u03"), ember("u08"), ember("u13"), ember("u18")]), ember("s01"), ember("s01"), ember("s02"), ember("s02"), ember("s04"), ember("s04"), ember("s05"), ember("s05")],
  },
  {
    name: "pressure32_control",
    rationale: "Singletonize direct-damage u04 plus u08/u11/u13 and add Stun + AoE.",
    cards: [...singletonize(emberUnits, [ember("u04"), ember("u08"), ember("u11"), ember("u13")]), ember("s01"), ember("s01"), ember("s02"), ember("s02"), ember("s04"), ember("s04"), ember("s05"), ember("s05")],
  },
  {
    name: "pressure32_tempo",
    rationale: "Singletonize u04/u08/u11/u13 and shift extra slots to Burst buff + Stun.",
    cards: [...singletonize(emberUnits, [ember("u04"), ember("u08"), ember("u11"), ember("u13")]), ember("s01"), ember("s01"), ember("s02"), ember("s02"), ember("s03"), ember("s03"), ember("s04"), ember("s04")],
  },
  {
    name: "burnless32_control",
    rationale: "Singletonize four Haste/direct-pressure Units and remove duplicated direct Nexus burn in favor of board tools.",
    cards: [...singletonize(emberUnits, [ember("u04"), ember("u08"), ember("u13"), ember("u18")]), ember("s01"), ember("s01"), ember("s03"), ember("s03"), ember("s04"), ember("s04"), ember("s05"), ember("s05")],
  },
  {
    name: "broad30_toolbox",
    rationale: "Singletonize six leverage threats and use a 10-Spell toolbox to test whether concentration is the ceiling.",
    cards: [...singletonize(emberUnits, [ember("u03"), ember("u04"), ember("u08"), ember("u11"), ember("u13"), ember("u18")]), ember("s01"), ember("s01"), ember("s02"), ember("s02"), ember("s03"), ember("s03"), ember("s04"), ember("s04"), ember("s05"), ember("s05")],
  },
];

const ASCENDANT_PREFIXES = {
  vanilla_wood_2: "van_wood",
  vanilla_void_2: "van_void",
  vanilla_forest_2: "van_forest",
} as const;

const BASE_DUPLICATES: Record<keyof typeof ASCENDANT_PREFIXES, readonly string[]> = {
  vanilla_wood_2: ["u04", "u03", "u02", "u05", "u08", "u01", "u13", "u11", "u14", "u06"],
  vanilla_void_2: ["u03", "u02", "u05", "u08", "u04", "u01", "u13", "u11", "u14", "u06"],
  vanilla_forest_2: ["u03", "u02", "u05", "u08", "u04", "u01", "u13", "u11", "u14", "u06"],
};

const ASCENDANT_POLICIES: Array<{ name: string; rationale: string; duplicateSuffixes: readonly string[] }> = [
  { name: "baseline_power_aware", rationale: "Vanilla 1.4 evidence-selected baseline.", duplicateSuffixes: [] },
  { name: "unit_curve", rationale: "Duplicate the first ten Units to maximize board density and smooth the curve.", duplicateSuffixes: ["u01", "u02", "u03", "u04", "u05", "u06", "u07", "u08", "u09", "u10"] },
  { name: "low_curve_interaction", rationale: "Eight early Units plus the two cheapest regional Spells.", duplicateSuffixes: ["u01", "u02", "u03", "u04", "u05", "u06", "u07", "u08", "s01", "s02"] },
  { name: "tempo_interaction", rationale: "Six early Units, two proven tempo bodies and cheap interaction.", duplicateSuffixes: ["u01", "u02", "u03", "u04", "u05", "u06", "u08", "u11", "s01", "s04"] },
  { name: "control_interaction", rationale: "Six early Units plus cheap removal/tempo and two mid-cost interaction tools.", duplicateSuffixes: ["u01", "u02", "u03", "u04", "u05", "u06", "s01", "s04", "s05", "s07"] },
  { name: "midrange_engines", rationale: "Six early Units, two midrange bodies and both regional Enchantments.", duplicateSuffixes: ["u01", "u02", "u03", "u04", "u05", "u06", "u09", "u10", "e01", "e02"] },
  { name: "permanent_engines", rationale: "Six early Units plus both Enchantments, Artifact and Equipment.", duplicateSuffixes: ["u01", "u02", "u03", "u04", "u05", "u06", "e01", "e02", "a01", "q01"] },
  { name: "midgame_pressure", rationale: "Keep six early Units and concentrate four midgame/finisher Units.", duplicateSuffixes: ["u01", "u02", "u03", "u04", "u05", "u06", "u11", "u13", "u14", "u18"] },
];

function ascendantRecipe(targetId: keyof typeof ASCENDANT_PREFIXES, duplicateSuffixes: readonly string[]): string[] {
  const prefix = ASCENDANT_PREFIXES[targetId];
  const unique = [
    ...range(`${prefix}_u`, 1, 18),
    ...range(`${prefix}_s`, 1, 8),
    `${prefix}_e01`, `${prefix}_e02`, `${prefix}_a01`, `${prefix}_q01`,
  ];
  const suffixes = duplicateSuffixes.length ? duplicateSuffixes : BASE_DUPLICATES[targetId];
  if (suffixes.length !== 10 || new Set(suffixes).size !== 10) throw new Error(`${targetId}: duplicate policy must contain ten unique suffixes`);
  return [...unique, ...suffixes.map((suffix) => `${prefix}_${suffix}`)];
}

const suites: Array<{ targetId: string; family: string; recipes: Recipe[] }> = [
  { targetId: "vanilla_ember_1", family: "ceiling", recipes: emberVanguardRecipes },
  ...Object.keys(ASCENDANT_PREFIXES).map((targetId) => ({
    targetId,
    family: "floor",
    recipes: ASCENDANT_POLICIES.map((policy) => ({
      name: policy.name,
      rationale: policy.rationale,
      cards: ascendantRecipe(targetId as keyof typeof ASCENDANT_PREFIXES, policy.duplicateSuffixes),
    })),
  })),
];

const suiteResults = suites.map((suite) => {
  const results = suite.recipes.map((recipe) => runRecipe(suite.targetId, recipe));
  const baseline = results[0];
  const targetWinRate = suite.family === "ceiling" ? 55 : 45;
  const ranked = results.map((row) => ({
    ...row,
    deltaVsBaseline: round1(row.winRate - baseline.winRate),
    score: round1(
      Math.abs(row.winRate - targetWinRate) +
      row.health.critical * 1.5 +
      row.health.watch * 0.35 +
      Math.max(0, row.maxWinRate - 70) * 0.4 +
      Math.max(0, 30 - row.minWinRate) * 0.4,
    ),
  })).sort((a, b) => a.score - b.score || b.health.healthy - a.health.healthy || a.name.localeCompare(b.name));
  return {
    targetId: suite.targetId,
    family: suite.family,
    targetWinRate,
    baseline,
    ranked,
  };
});

const report = {
  version: "Vanilla 1.7 Emberhold ceiling + Ascendant floor recipe laboratory",
  methodology:
    "No CardDef mutation. Each candidate changes exactly one experimental deck in-memory and runs it against all 11 opponents with the same deterministic Balance Lab seed strata. Emberhold Vanguard candidates reduce concentration while preserving regional identity. Weak Ascendant candidates keep all 30 regional cards and change only their ten duplicate slots.",
  run: {
    gamesPerStratum: GAMES,
    strata: STRATA,
    gamesPerRecipe: 11 * GAMES * STRATA,
    recipes: suiteResults.reduce((sum, suite) => sum + suite.ranked.length, 0),
    totalGames: suiteResults.reduce((sum, suite) => sum + suite.ranked.reduce((inner, row) => inner + row.games, 0), 0),
  },
  suites: suiteResults,
};

if (writePath) {
  fs.mkdirSync(writePath.split("/").slice(0, -1).join("/") || ".", { recursive: true });
  fs.writeFileSync(writePath, `${JSON.stringify(report, null, 2)}\n`);
}

console.log(JSON.stringify({
  version: report.version,
  run: report.run,
  results: report.suites.map((suite) => ({
    targetId: suite.targetId,
    family: suite.family,
    baseline: {
      name: suite.baseline.name,
      winRate: suite.baseline.winRate,
      health: suite.baseline.health,
      range: [suite.baseline.minWinRate, suite.baseline.maxWinRate],
    },
    topCandidates: suite.ranked.slice(0, 5).map((row) => ({
      name: row.name,
      winRate: row.winRate,
      deltaVsBaseline: row.deltaVsBaseline,
      health: row.health,
      range: [row.minWinRate, row.maxWinRate],
      stats: row.stats,
      score: row.score,
    })),
  })),
}, null, 2));
