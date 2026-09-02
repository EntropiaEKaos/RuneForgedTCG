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

type Mutation = {
  defId: string;
  cost?: number;
  power?: number;
  health?: number;
  removeKeywords?: string[];
  removeTrigger?: boolean;
};

function mutateCard(spec: Mutation): CardDef {
  const base = getCard(spec.defId);
  return {
    ...base,
    cost: spec.cost ?? base.cost,
    power: spec.power ?? base.power,
    health: spec.health ?? base.health,
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
        parts.push(
          runBalanceSimulation(
            matchup.leftId,
            matchup.rightId,
            SCREEN_GAMES,
            vanillaBalanceSeed(matchup, stratum),
            overrides,
          ),
        );
      }
      const targetIsA = matchup.leftId === TARGET_ID;
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
      matchupResults.push({
        opponent: targetIsA ? matchup.rightId : matchup.leftId,
        games: matchupGames,
        winRate: rate,
        status,
      });
    }

    return {
      name,
      mutations,
      games,
      wins,
      losses,
      draws,
      winRate: pct(wins, wins + losses),
      avgRounds: round1(weightedRounds / Math.max(1, games)),
      health,
      matchups: matchupResults,
    };
  };

  return changedCards.length > 0 ? withRegisteredCardSnapshot(changedCards, execute) : execute();
}

const scenarios: Array<{ name: string; mutations: Mutation[] }> = [
  { name: "baseline", mutations: [] },
  {
    name: "lifesteal_all_removed",
    mutations: [
      { defId: "van_tide_u03", removeKeywords: ["Lifesteal"] },
      { defId: "van_tide_u08", removeKeywords: ["Lifesteal"] },
      { defId: "van_tide_u13", removeKeywords: ["Lifesteal"] },
      { defId: "van_tide_u18", removeKeywords: ["Lifesteal"] },
    ],
  },
  {
    name: "lifesteal_top_removed",
    mutations: [
      { defId: "van_tide_u13", removeKeywords: ["Lifesteal"] },
      { defId: "van_tide_u18", removeKeywords: ["Lifesteal"] },
    ],
  },
  {
    name: "barrier_removed",
    mutations: [
      { defId: "van_tide_u02", removeKeywords: ["Barrier"] },
      { defId: "van_tide_u17", removeKeywords: ["Barrier"] },
    ],
  },
  {
    name: "sustain_all_removed",
    mutations: [
      { defId: "van_tide_u03", removeKeywords: ["Lifesteal", "Regeneration"] },
      { defId: "van_tide_u05", removeKeywords: ["Regeneration"] },
      { defId: "van_tide_u08", removeKeywords: ["Lifesteal"], removeTrigger: true },
      { defId: "van_tide_u13", removeKeywords: ["Lifesteal", "Regeneration"] },
      { defId: "van_tide_u18", removeKeywords: ["Lifesteal", "Regeneration"] },
    ],
  },
  {
    name: "minimal_cost_package",
    mutations: [
      { defId: "van_tide_u04", cost: 3 },
      { defId: "van_tide_u09", cost: 5 },
      { defId: "van_tide_u18", cost: 9 },
    ],
  },
  {
    name: "top_end_cost_package",
    mutations: [
      { defId: "van_tide_u09", cost: 5 },
      { defId: "van_tide_u10", cost: 5 },
      { defId: "van_tide_u17", cost: 8 },
      { defId: "van_tide_u18", cost: 9 },
    ],
  },
  {
    name: "curve_cost_package",
    mutations: [
      { defId: "van_tide_u04", cost: 3 },
      { defId: "van_tide_u06", cost: 4 },
      { defId: "van_tide_u09", cost: 5 },
      { defId: "van_tide_u10", cost: 5 },
      { defId: "van_tide_u17", cost: 8 },
      { defId: "van_tide_u18", cost: 9 },
    ],
  },
  {
    name: "draw_plus_top_cost_package",
    mutations: [
      { defId: "van_tide_u04", removeTrigger: true },
      { defId: "van_tide_u09", cost: 5 },
      { defId: "van_tide_u17", cost: 8 },
      { defId: "van_tide_u18", cost: 9 },
    ],
  },
  {
    name: "stats_only_package",
    mutations: [
      { defId: "van_tide_u06", power: 3, health: 2 },
      { defId: "van_tide_u09", power: 4, health: 3 },
      { defId: "van_tide_u10", power: 3, health: 4 },
      { defId: "van_tide_u17", power: 6, health: 6 },
      { defId: "van_tide_u18", power: 7, health: 8 },
    ],
  },
  {
    name: "identity_preserving_hybrid",
    mutations: [
      { defId: "van_tide_u04", cost: 3 },
      { defId: "van_tide_u09", power: 4, health: 3 },
      { defId: "van_tide_u10", power: 3, health: 4 },
      { defId: "van_tide_u17", power: 6, health: 6 },
      { defId: "van_tide_u18", power: 7, health: 8 },
    ],
  },
  {
    name: "lifesteal_draw_hybrid",
    mutations: [
      { defId: "van_tide_u04", cost: 3 },
      { defId: "van_tide_u13", removeKeywords: ["Lifesteal"] },
      { defId: "van_tide_u18", removeKeywords: ["Lifesteal"] },
      { defId: "van_tide_u18", cost: 9 },
    ],
  },
];

// Coalesce accidental duplicate specs for the same card inside a scenario.
function coalesce(mutations: Mutation[]): Mutation[] {
  const byId = new Map<string, Mutation>();
  for (const mutation of mutations) {
    const current = byId.get(mutation.defId) ?? { defId: mutation.defId };
    byId.set(mutation.defId, {
      ...current,
      ...mutation,
      removeKeywords: [...new Set([...(current.removeKeywords ?? []), ...(mutation.removeKeywords ?? [])])],
      removeTrigger: Boolean(current.removeTrigger || mutation.removeTrigger),
    });
  }
  return [...byId.values()];
}

const results = scenarios.map((scenario) => runScenario(scenario.name, coalesce(scenario.mutations)));
const baseline = results.find((result) => result.name === "baseline")!;
const ranked = results
  .filter((result) => result.name !== "baseline")
  .map((result) => ({
    ...result,
    deltaVsBaseline: round1(result.winRate - baseline.winRate),
    distanceFromTargetBand: result.winRate > 60 ? round1(result.winRate - 60) : result.winRate < 40 ? round1(40 - result.winRate) : 0,
  }))
  .sort((a, b) => a.distanceFromTargetBand - b.distanceFromTargetBand || b.health.healthy - a.health.healthy || a.winRate - b.winRate);

const report = {
  version: "Vanilla 1.5 package sweep",
  methodology: "Tidecall Vanguard only; 11 opponents; exact real-engine Balance Lab simulator; paired deterministic seed strata; in-memory card snapshots only; candidate packages preserve product sources",
  screen: {
    gamesPerStratum: SCREEN_GAMES,
    strata: SCREEN_STRATA,
    gamesPerScenario: baseline.games,
    scenarios: results.length,
    totalGames: results.reduce((sum, result) => sum + result.games, 0),
  },
  baseline,
  ranked,
};

if (writePath) {
  fs.mkdirSync(writePath.split("/").slice(0, -1).join("/") || ".", { recursive: true });
  fs.writeFileSync(writePath, `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify(report, null, 2));
