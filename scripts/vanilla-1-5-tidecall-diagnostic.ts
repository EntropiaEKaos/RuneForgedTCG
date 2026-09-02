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

const TARGET_ID = "vanilla_tide_1";
const GAMES = Math.max(20, Math.min(80, Number(process.argv[2]) || 40));
const STRATA = Math.max(3, Math.min(5, Number(process.argv[3]) || 5));
const writeIndex = process.argv.indexOf("--write");
const writePath = writeIndex >= 0 ? process.argv[writeIndex + 1] : "";
const overrides = vanillaExperimentalOverrides();
const matchups = vanillaBalanceMatchups().filter((row) => row.leftId === TARGET_ID || row.rightId === TARGET_ID);
if (matchups.length !== 11) throw new Error(`expected 11 Tidecall Vanguard matchups, found ${matchups.length}`);
if (STRATA > VANILLA_BALANCE_STRATUM_BASES.length) throw new Error("strata outside seed table");

function round1(value: number): number { return Math.round(value * 10) / 10; }
function pct(n: number, d: number): number { return round1((n / Math.max(1, d)) * 100); }
type Mutation = { defId: string; cost?: number; removeKeywords?: string[] };
function mutateCard(spec: Mutation): CardDef {
  const base = getCard(spec.defId);
  return { ...base, cost: spec.cost ?? base.cost, keywords: (base.keywords ?? []).filter((keyword) => !(spec.removeKeywords ?? []).includes(keyword)) };
}
function merge(base: Mutation[], extras: Mutation[]): Mutation[] {
  const byId = new Map<string, Mutation>();
  for (const item of [...base, ...extras]) {
    const previous = byId.get(item.defId);
    byId.set(item.defId, { ...(previous ?? { defId: item.defId }), ...item, removeKeywords: [...new Set([...(previous?.removeKeywords ?? []), ...(item.removeKeywords ?? [])])] });
  }
  return [...byId.values()];
}

type Result = {
  name: string; mutations: Mutation[]; games: number; wins: number; losses: number; draws: number; winRate: number; avgRounds: number;
  maxWinRate: number; minWinRate: number; health: { healthy: number; watch: number; critical: number };
  matchups: Array<{ opponent: string; games: number; winRate: number; status: string }>;
};
function runScenario(name: string, mutations: Mutation[]): Result {
  const changed = mutations.map(mutateCard);
  const execute = () => {
    let wins = 0, losses = 0, draws = 0, games = 0, weightedRounds = 0;
    const health = { healthy: 0, watch: 0, critical: 0 };
    const matchupResults: Result["matchups"] = [];
    for (const matchup of matchups) {
      const parts: SimulationSummary[] = [];
      for (let stratum = 0; stratum < STRATA; stratum += 1) {
        parts.push(runBalanceSimulation(matchup.leftId, matchup.rightId, GAMES, vanillaBalanceSeed(matchup, stratum), overrides));
      }
      const targetIsA = matchup.leftId === TARGET_ID;
      const mw = parts.reduce((sum, row) => sum + (targetIsA ? row.winsA : row.winsB), 0);
      const ml = parts.reduce((sum, row) => sum + (targetIsA ? row.winsB : row.winsA), 0);
      const md = parts.reduce((sum, row) => sum + row.draws, 0);
      const mg = parts.reduce((sum, row) => sum + row.completedGames, 0);
      const rate = pct(mw, mw + ml);
      const status = evaluateMatchup(rate).status;
      health[status] += 1;
      wins += mw; losses += ml; draws += md; games += mg;
      weightedRounds += parts.reduce((sum, row) => sum + row.avgRounds * row.completedGames, 0);
      matchupResults.push({ opponent: targetIsA ? matchup.rightId : matchup.leftId, games: mg, winRate: rate, status });
    }
    const rates = matchupResults.map((row) => row.winRate);
    return { name, mutations, games, wins, losses, draws, winRate: pct(wins, wins + losses), avgRounds: round1(weightedRounds / games), maxWinRate: Math.max(...rates), minWinRate: Math.min(...rates), health, matchups: matchupResults };
  };
  return changed.length ? withRegisteredCardSnapshot(changed, execute) : execute();
}

const curve6: Mutation[] = [
  { defId: "van_tide_u04", cost: 3 }, { defId: "van_tide_u06", cost: 4 }, { defId: "van_tide_u09", cost: 5 },
  { defId: "van_tide_u10", cost: 5 }, { defId: "van_tide_u17", cost: 8 }, { defId: "van_tide_u18", cost: 9 },
];
const scenarios = [
  { name: "baseline", mutations: [] as Mutation[] },
  { name: "finalist_mid_legend", mutations: merge(curve6, [{ defId: "van_tide_u08", removeKeywords: ["Lifesteal"] }, { defId: "van_tide_u18", removeKeywords: ["Lifesteal"] }]) },
  { name: "finalist_early_legend", mutations: merge(curve6, [{ defId: "van_tide_u03", removeKeywords: ["Lifesteal"] }, { defId: "van_tide_u18", removeKeywords: ["Lifesteal"] }]) },
];
const results = scenarios.map((scenario) => runScenario(scenario.name, scenario.mutations));
const baseline = results[0];
const candidates = results.slice(1).map((row) => ({ ...row, deltaVsBaseline: round1(row.winRate - baseline.winRate) }));
const report = {
  version: "Vanilla 1.5 finalist validation",
  methodology: "Two identity-preserving finalists versus the exact 1.4 baseline; Tidecall Vanguard against all 11 opponents; 5 deterministic seed strata using the real Balance Lab engine; mutations remain in-memory only.",
  run: { gamesPerStratum: GAMES, strata: STRATA, gamesPerScenario: baseline.games, totalGames: results.reduce((sum, row) => sum + row.games, 0) },
  baseline, candidates,
};
if (writePath) {
  fs.mkdirSync(writePath.split("/").slice(0, -1).join("/") || ".", { recursive: true });
  fs.writeFileSync(writePath, `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify(report, null, 2));
