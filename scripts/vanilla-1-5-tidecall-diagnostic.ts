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
const SCREEN_GAMES = Math.max(10, Math.min(60, Number(process.argv[2]) || 16));
const SCREEN_STRATA = Math.max(3, Math.min(6, Number(process.argv[3]) || 3));
const writeIndex = process.argv.indexOf("--write");
const writePath = writeIndex >= 0 ? process.argv[writeIndex + 1] : "";
const overrides = vanillaExperimentalOverrides();
const matchups = vanillaBalanceMatchups().filter((row) => row.leftId === TARGET_ID || row.rightId === TARGET_ID);
if (matchups.length !== 11) throw new Error(`expected 11 Tidecall Vanguard matchups, found ${matchups.length}`);
if (SCREEN_STRATA > VANILLA_BALANCE_STRATUM_BASES.length) throw new Error("screen strata outside seed table");

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
function pct(n: number, d: number): number {
  return round1((n / Math.max(1, d)) * 100);
}

type Mutation = { defId: string; cost?: number; removeKeywords?: string[]; removeTrigger?: boolean };

function mutateCard(spec: Mutation): CardDef {
  const base = getCard(spec.defId);
  return {
    ...base,
    cost: spec.cost ?? base.cost,
    keywords: (base.keywords ?? []).filter((keyword) => !(spec.removeKeywords ?? []).includes(keyword)),
    trigger: spec.removeTrigger ? undefined : base.trigger,
  };
}

type ScenarioResult = {
  name: string;
  mutations: Mutation[];
  games: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  avgRounds: number;
  maxWinRate: number;
  minWinRate: number;
  health: { healthy: number; watch: number; critical: number };
  matchups: Array<{ opponent: string; games: number; winRate: number; status: string }>;
};

function runScenario(name: string, mutations: Mutation[]): ScenarioResult {
  const changedCards = mutations.map(mutateCard);
  const execute = () => {
    let wins = 0;
    let losses = 0;
    let draws = 0;
    let games = 0;
    let weightedRounds = 0;
    const health = { healthy: 0, watch: 0, critical: 0 };
    const matchupResults: ScenarioResult["matchups"] = [];
    for (const matchup of matchups) {
      const parts: SimulationSummary[] = [];
      for (let stratum = 0; stratum < SCREEN_STRATA; stratum += 1) {
        parts.push(runBalanceSimulation(matchup.leftId, matchup.rightId, SCREEN_GAMES, vanillaBalanceSeed(matchup, stratum), overrides));
      }
      const targetIsA = matchup.leftId === TARGET_ID;
      const mw = parts.reduce((sum, row) => sum + (targetIsA ? row.winsA : row.winsB), 0);
      const ml = parts.reduce((sum, row) => sum + (targetIsA ? row.winsB : row.winsA), 0);
      const md = parts.reduce((sum, row) => sum + row.draws, 0);
      const mg = parts.reduce((sum, row) => sum + row.completedGames, 0);
      const rate = pct(mw, mw + ml);
      const status = evaluateMatchup(rate).status;
      health[status] += 1;
      wins += mw;
      losses += ml;
      draws += md;
      games += mg;
      weightedRounds += parts.reduce((sum, row) => sum + row.avgRounds * row.completedGames, 0);
      matchupResults.push({ opponent: targetIsA ? matchup.rightId : matchup.leftId, games: mg, winRate: rate, status });
    }
    const rates = matchupResults.map((row) => row.winRate);
    return {
      name,
      mutations,
      games,
      wins,
      losses,
      draws,
      winRate: pct(wins, wins + losses),
      avgRounds: round1(weightedRounds / Math.max(1, games)),
      maxWinRate: Math.max(...rates),
      minWinRate: Math.min(...rates),
      health,
      matchups: matchupResults,
    };
  };
  return changedCards.length ? withRegisteredCardSnapshot(changedCards, execute) : execute();
}

const curve6: Mutation[] = [
  { defId: "van_tide_u04", cost: 3 },
  { defId: "van_tide_u06", cost: 4 },
  { defId: "van_tide_u09", cost: 5 },
  { defId: "van_tide_u10", cost: 5 },
  { defId: "van_tide_u17", cost: 8 },
  { defId: "van_tide_u18", cost: 9 },
];

function merge(base: Mutation[], extras: Mutation[]): Mutation[] {
  const byId = new Map<string, Mutation>();
  for (const item of [...base, ...extras]) {
    const previous = byId.get(item.defId);
    byId.set(item.defId, {
      ...(previous ?? { defId: item.defId }),
      ...item,
      removeKeywords: [...new Set([...(previous?.removeKeywords ?? []), ...(item.removeKeywords ?? [])])],
      removeTrigger: Boolean(previous?.removeTrigger || item.removeTrigger),
    });
  }
  return [...byId.values()];
}

const scenarios: Array<{ name: string; mutations: Mutation[] }> = [
  { name: "baseline", mutations: [] },
  { name: "curve6", mutations: curve6 },
  { name: "curve6_minus_u18_lifesteal", mutations: merge(curve6, [{ defId: "van_tide_u18", removeKeywords: ["Lifesteal"] }]) },
  { name: "curve6_minus_top_lifesteal", mutations: merge(curve6, [{ defId: "van_tide_u13", removeKeywords: ["Lifesteal"] }, { defId: "van_tide_u18", removeKeywords: ["Lifesteal"] }]) },
  { name: "curve6_minus_early_legend_lifesteal", mutations: merge(curve6, [{ defId: "van_tide_u03", removeKeywords: ["Lifesteal"] }, { defId: "van_tide_u18", removeKeywords: ["Lifesteal"] }]) },
  { name: "curve6_minus_mid_legend_lifesteal", mutations: merge(curve6, [{ defId: "van_tide_u08", removeKeywords: ["Lifesteal"] }, { defId: "van_tide_u18", removeKeywords: ["Lifesteal"] }]) },
  { name: "curve6_minus_three_lifesteal", mutations: merge(curve6, [{ defId: "van_tide_u03", removeKeywords: ["Lifesteal"] }, { defId: "van_tide_u13", removeKeywords: ["Lifesteal"] }, { defId: "van_tide_u18", removeKeywords: ["Lifesteal"] }]) },
  { name: "curve6_minus_all_lifesteal", mutations: merge(curve6, [{ defId: "van_tide_u03", removeKeywords: ["Lifesteal"] }, { defId: "van_tide_u08", removeKeywords: ["Lifesteal"] }, { defId: "van_tide_u13", removeKeywords: ["Lifesteal"] }, { defId: "van_tide_u18", removeKeywords: ["Lifesteal"] }]) },
  { name: "curve5_minus_top_lifesteal", mutations: merge(curve6.filter((row) => row.defId !== "van_tide_u10"), [{ defId: "van_tide_u13", removeKeywords: ["Lifesteal"] }, { defId: "van_tide_u18", removeKeywords: ["Lifesteal"] }]) },
  { name: "curve4_minus_top_lifesteal", mutations: merge(curve6.filter((row) => !["van_tide_u06", "van_tide_u10"].includes(row.defId)), [{ defId: "van_tide_u13", removeKeywords: ["Lifesteal"] }, { defId: "van_tide_u18", removeKeywords: ["Lifesteal"] }]) },
  { name: "curve7_identity_preserved", mutations: merge(curve6, [{ defId: "van_tide_u12", cost: 6 }]) },
  { name: "draw_trim_curve5", mutations: merge(curve6.filter((row) => row.defId !== "van_tide_u10"), [{ defId: "van_tide_u04", removeTrigger: true }]) },
];

const results = scenarios.map((scenario) => runScenario(scenario.name, scenario.mutations));
const baseline = results[0];
const ranked = results.slice(1).map((result) => ({
  ...result,
  deltaVsBaseline: round1(result.winRate - baseline.winRate),
  productScore: round1(Math.abs(result.winRate - 64) + Math.max(0, result.maxWinRate - 80) * 2 + Math.max(0, 40 - result.minWinRate) * 2 + result.mutations.length * 0.15),
})).sort((a, b) => a.productScore - b.productScore || a.maxWinRate - b.maxWinRate || a.mutations.length - b.mutations.length);

const report = {
  version: "Vanilla 1.5 convergence sweep",
  methodology: "Tidecall Vanguard vs 11 opponents; exact real-engine Balance Lab simulator; paired deterministic seed strata; candidate mutations exist only in registry snapshots. Target is regional ceiling reduction without compensating for already-weak opposing decks.",
  screen: { gamesPerStratum: SCREEN_GAMES, strata: SCREEN_STRATA, gamesPerScenario: baseline.games, scenarios: results.length, totalGames: results.reduce((sum, row) => sum + row.games, 0) },
  baseline,
  ranked,
};
if (writePath) {
  fs.mkdirSync(writePath.split("/").slice(0, -1).join("/") || ".", { recursive: true });
  fs.writeFileSync(writePath, `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify(report, null, 2));
