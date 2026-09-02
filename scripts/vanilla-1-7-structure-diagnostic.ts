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

const baseOverrides = vanillaExperimentalOverrides();

function round1(value: number): number { return Math.round(value * 10) / 10; }
function pct(n: number, d: number): number { return round1((n / Math.max(1, d)) * 100); }
function range(prefix: string, from: number, to: number): string[] {
  return Array.from({ length: to - from + 1 }, (_, index) => `${prefix}${String(from + index).padStart(2, "0")}`);
}
function copies(ids: readonly string[]): string[] { return ids.flatMap((id) => [id, id]); }
function singletonize(ids: readonly string[], singletonIds: readonly string[]): string[] {
  const singletons = new Set(singletonIds);
  return ids.flatMap((id) => singletons.has(id) ? [id] : [id, id]);
}

function assertRecipe(name: string, cards: string[], maxCopies = 3): void {
  if (cards.length !== 40) throw new Error(`${name}: expected 40 cards, found ${cards.length}`);
  const counts = new Map<string, number>();
  for (const defId of cards) {
    getCard(defId);
    counts.set(defId, (counts.get(defId) ?? 0) + 1);
  }
  for (const [defId, count] of counts) {
    if (count > maxCopies) throw new Error(`${name}: ${defId} has ${count} copies, max ${maxCopies}`);
  }
}

type Recipe = { name: string; rationale: string; cards: string[] };
type Result = {
  targetId: string;
  name: string;
  rationale: string;
  stats: ReturnType<typeof recipeStats>;
  games: number;
  winRate: number;
  minWinRate: number;
  maxWinRate: number;
  health: { healthy: number; watch: number; critical: number };
  matchups: Array<{ opponent: string; winRate: number; status: string }>;
};

function recipeStats(cards: string[]) {
  const defs = cards.map(getCard);
  const counts = cards.reduce<Record<string, number>>((acc, id) => {
    acc[id] = (acc[id] ?? 0) + 1;
    return acc;
  }, {});
  return {
    units: defs.filter((card) => card.type === "Unit").length,
    spells: defs.filter((card) => card.type === "Spell").length,
    permanents: defs.filter((card) => ["Enchantment", "Artifact", "Equipment", "Sentinela"].includes(card.type)).length,
    uniqueCards: new Set(cards).size,
    averageCost: round1(defs.reduce((sum, card) => sum + card.cost, 0) / cards.length),
    early0To2: defs.filter((card) => card.cost <= 2).length,
    topEnd7Plus: defs.filter((card) => card.cost >= 7).length,
    maxCopies: Math.max(...Object.values(counts)),
    tripledCards: Object.entries(counts).filter(([, count]) => count === 3).map(([id]) => id),
  };
}

function runRecipe(targetId: string, recipe: Recipe): Result {
  assertRecipe(recipe.name, recipe.cards);
  const targetBase = baseOverrides[targetId];
  if (!targetBase) throw new Error(`${targetId}: missing baseline override`);
  const overrides = { ...baseOverrides, [targetId]: { ...targetBase, cards: [...recipe.cards] } };
  const matchups = vanillaBalanceMatchups().filter((row) => row.leftId === targetId || row.rightId === targetId);
  let wins = 0;
  let losses = 0;
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
    const rate = pct(matchupWins, matchupWins + matchupLosses);
    const status = evaluateMatchup(rate).status;
    health[status] += 1;
    wins += matchupWins;
    losses += matchupLosses;
    matchupRows.push({ opponent: targetIsA ? matchup.rightId : matchup.leftId, winRate: rate, status });
  }
  const rates = matchupRows.map((row) => row.winRate);
  return {
    targetId,
    name: recipe.name,
    rationale: recipe.rationale,
    stats: recipeStats(recipe.cards),
    games: wins + losses,
    winRate: pct(wins, wins + losses),
    minWinRate: Math.min(...rates),
    maxWinRate: Math.max(...rates),
    health,
    matchups: matchupRows,
  };
}

const emberUnits = range("van_ember_u", 1, 18);
const e = (suffix: string) => `van_ember_${suffix}`;
const emberRecipes: Recipe[] = [
  { name: "baseline_36u4s", rationale: "Certified Vanilla 1.6 baseline.", cards: [...copies(emberUnits), e("s01"), e("s01"), e("s02"), e("s02")] },
  { name: "u18_single_stun", rationale: "Only legendary 8-drop u18 loses one copy; add one s04 Stun.", cards: [...singletonize(emberUnits, [e("u18")]), e("s01"), e("s01"), e("s02"), e("s02"), e("s04")] },
  { name: "u17_single_stun", rationale: "Only 7-drop Overwhelm u17 loses one copy; add one s04 Stun.", cards: [...singletonize(emberUnits, [e("u17")]), e("s01"), e("s01"), e("s02"), e("s02"), e("s04")] },
  { name: "u13_single_stun", rationale: "One copy of 5/5 Haste+Tough u13 becomes Stun.", cards: [...singletonize(emberUnits, [e("u13")]), e("s01"), e("s01"), e("s02"), e("s02"), e("s04")] },
  { name: "u08_single_stun", rationale: "One copy of 3-cost Haste pressure u08 becomes Stun.", cards: [...singletonize(emberUnits, [e("u08")]), e("s01"), e("s01"), e("s02"), e("s02"), e("s04")] },
  { name: "u04_single_stun", rationale: "One copy of direct-Nexus summon u04 becomes Stun.", cards: [...singletonize(emberUnits, [e("u04")]), e("s01"), e("s01"), e("s02"), e("s02"), e("s04")] },
  { name: "topend34_split", rationale: "u17/u18 become singletons; add one s04 and one s05 instead of double Stun.", cards: [...singletonize(emberUnits, [e("u17"), e("u18")]), e("s01"), e("s01"), e("s02"), e("s02"), e("s04"), e("s05")] },
  { name: "u18_single_aoe", rationale: "Only u18 loses one copy; add one s05 AoE.", cards: [...singletonize(emberUnits, [e("u18")]), e("s01"), e("s01"), e("s02"), e("s02"), e("s05")] },
];

const TARGET_PREFIXES = {
  vanilla_wood_2: "van_wood",
  vanilla_void_2: "van_void",
  vanilla_forest_2: "van_forest",
} as const;

type FloorTarget = keyof typeof TARGET_PREFIXES;
const BASE_DUPLICATES: Record<FloorTarget, readonly string[]> = {
  vanilla_wood_2: ["u04", "u03", "u02", "u05", "u08", "u01", "u13", "u11", "u14", "u06"],
  vanilla_void_2: ["u03", "u02", "u05", "u08", "u04", "u01", "u13", "u11", "u14", "u06"],
  vanilla_forest_2: ["u03", "u02", "u05", "u08", "u04", "u01", "u13", "u11", "u14", "u06"],
};

function ascendantUnique(prefix: string): string[] {
  return [
    ...range(`${prefix}_u`, 1, 18),
    ...range(`${prefix}_s`, 1, 8),
    `${prefix}_e01`, `${prefix}_e02`, `${prefix}_a01`, `${prefix}_q01`,
  ];
}

function concentratedAscendant(target: FloorTarget, triples: readonly string[], doubles: readonly string[] = []): string[] {
  const prefix = TARGET_PREFIXES[target];
  if (new Set([...triples, ...doubles]).size !== triples.length + doubles.length) throw new Error(`${target}: overlap in concentration policy`);
  const extras = triples.length * 2 + doubles.length;
  if (extras !== 10) throw new Error(`${target}: concentration policy must add exactly 10 cards, found ${extras}`);
  return [
    ...ascendantUnique(prefix),
    ...triples.flatMap((suffix) => [`${prefix}_${suffix}`, `${prefix}_${suffix}`]),
    ...doubles.map((suffix) => `${prefix}_${suffix}`),
  ];
}

function baselineAscendant(target: FloorTarget): string[] {
  const prefix = TARGET_PREFIXES[target];
  return [...ascendantUnique(prefix), ...BASE_DUPLICATES[target].map((suffix) => `${prefix}_${suffix}`)];
}

const concentrationPolicies = [
  { name: "top5_current_tripled", rationale: "Convert the five highest-priority Vanilla 1.4 power-aware slots into three-copy cores.", triples: ["u03", "u02", "u05", "u08", "u04"], doubles: [] },
  { name: "curve5_tripled", rationale: "Three copies each of u01-u05 while every regional card remains represented.", triples: ["u01", "u02", "u03", "u04", "u05"], doubles: [] },
  { name: "pressure5_tripled", rationale: "Concentrate efficient early/midgame power: u03/u05/u08/u13/u14.", triples: ["u03", "u05", "u08", "u13", "u14"], doubles: [] },
  { name: "finisher5_tripled", rationale: "Concentrate u03/u08/u11/u13/u18 to test stronger conversion and closing power.", triples: ["u03", "u08", "u11", "u13", "u18"], doubles: [] },
  { name: "mixed_early_power", rationale: "Triple three premium early threats; double four secondary power slots.", triples: ["u03", "u05", "u08"], doubles: ["u02", "u04", "u13", "u14"] },
  { name: "mixed_midgame_power", rationale: "Triple midgame leverage and double complementary early/late bodies.", triples: ["u08", "u11", "u13"], doubles: ["u03", "u05", "u14", "u18"] },
] as const;

const suites: Array<{ targetId: string; family: string; recipes: Recipe[] }> = [
  { targetId: "vanilla_ember_1", family: "ceiling", recipes: emberRecipes },
  ...Object.keys(TARGET_PREFIXES).map((id) => {
    const target = id as FloorTarget;
    return {
      targetId: target,
      family: "floor",
      recipes: [
        { name: "baseline_two_copy", rationale: "Vanilla 1.4 two-copy concentration baseline.", cards: baselineAscendant(target) },
        ...concentrationPolicies.map((policy) => ({
          name: policy.name,
          rationale: policy.rationale,
          cards: concentratedAscendant(target, policy.triples, policy.doubles),
        })),
      ],
    };
  }),
];

const results = suites.map((suite) => {
  const rows = suite.recipes.map((recipe) => runRecipe(suite.targetId, recipe));
  const baseline = rows[0];
  const target = suite.family === "ceiling" ? 55 : 45;
  const ranked = rows.map((row) => ({
    ...row,
    deltaVsBaseline: round1(row.winRate - baseline.winRate),
    score: round1(
      Math.abs(row.winRate - target) +
      row.health.critical * 1.5 +
      row.health.watch * 0.35 +
      Math.max(0, row.maxWinRate - 70) * 0.4 +
      Math.max(0, 30 - row.minWinRate) * 0.4,
    ),
  })).sort((a, b) => a.score - b.score || b.health.healthy - a.health.healthy || a.name.localeCompare(b.name));
  return { targetId: suite.targetId, family: suite.family, baseline, ranked };
});

const report = {
  version: "Vanilla 1.7 structural concentration screen",
  methodology:
    "No CardDef/engine/AI mutation. Emberhold Vanguard candidates make one- or two-slot concentration changes. Weak Ascendants preserve all 30 regional cards and use the runtime-legal maxCopies=3 to redistribute the same ten extra cards into concentrated three-copy cores. One target deck changes in-memory per simulation.",
  run: {
    gamesPerStratum: GAMES,
    strata: STRATA,
    gamesPerRecipe: 11 * GAMES * STRATA,
    recipes: results.reduce((sum, suite) => sum + suite.ranked.length, 0),
    totalGames: results.reduce((sum, suite) => sum + suite.ranked.reduce((inner, row) => inner + row.games, 0), 0),
  },
  suites: results,
};

if (writePath) {
  fs.mkdirSync(writePath.split("/").slice(0, -1).join("/") || ".", { recursive: true });
  fs.writeFileSync(writePath, `${JSON.stringify(report, null, 2)}\n`);
}

console.log(JSON.stringify({
  version: report.version,
  run: report.run,
  results: results.map((suite) => ({
    targetId: suite.targetId,
    baseline: { winRate: suite.baseline.winRate, health: suite.baseline.health, range: [suite.baseline.minWinRate, suite.baseline.maxWinRate] },
    topCandidates: suite.ranked.slice(0, 7).map((row) => ({
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
