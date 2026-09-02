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
import { VANILLA_EXPERIMENTAL_DECKS } from "../src/game/vanilla-experimental-decks";
import type { CardDef } from "../src/game/types";
import {
  mergeBalanceSimulationTelemetry,
  runBalanceSimulation,
  runBalanceSimulationWithTelemetry,
  type SimulationSummary,
} from "../src/lib/balance-simulator";

const TARGET_ID = "vanilla_tide_1";
const SCREEN_GAMES = Math.max(10, Math.min(40, Number(process.argv[2]) || 16));
const SCREEN_STRATA = Math.max(3, Math.min(5, Number(process.argv[3]) || 3));
const TELEMETRY_GAMES = 20;
const TELEMETRY_STRATA = 3;
const writeIndex = process.argv.indexOf("--write");
const writePath = writeIndex >= 0 ? process.argv[writeIndex + 1] : "";
const overrides = vanillaExperimentalOverrides();
const matchups = vanillaBalanceMatchups().filter((row) => row.leftId === TARGET_ID || row.rightId === TARGET_ID);
const targetDeck = VANILLA_EXPERIMENTAL_DECKS.find((deck) => deck.id === TARGET_ID);
if (!targetDeck) throw new Error(`${TARGET_ID} missing`);
if (matchups.length !== 11) throw new Error(`expected 11 Tidecall Vanguard matchups, found ${matchups.length}`);
if (SCREEN_STRATA > VANILLA_BALANCE_STRATUM_BASES.length) throw new Error("screen strata outside seed table");

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function pct(n: number, d: number): number {
  return round1((n / Math.max(1, d)) * 100);
}

function cloneCard(defId: string, mutate: (card: CardDef) => CardDef): CardDef {
  const card = getCard(defId);
  return mutate({ ...card, keywords: card.keywords ? [...card.keywords] : undefined });
}

function withoutKeyword(defId: string, keyword: string): CardDef {
  return cloneCard(defId, (card) => ({ ...card, keywords: (card.keywords ?? []).filter((item) => item !== keyword) }));
}

function withCost(defId: string, cost: number): CardDef {
  return cloneCard(defId, (card) => ({ ...card, cost }));
}

function withoutTrigger(defId: string): CardDef {
  return cloneCard(defId, (card) => ({ ...card, trigger: undefined }));
}

type ScenarioResult = {
  name: string;
  changedCards: string[];
  games: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  avgRounds: number;
  health: { healthy: number; watch: number; critical: number };
  matchups: Array<{ opponent: string; games: number; winRate: number; status: string }>;
};

function runScenario(name: string, changedCards: CardDef[]): ScenarioResult {
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
      changedCards: changedCards.map((card) => card.defId),
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

function runTelemetry() {
  const parts = [];
  for (const matchup of matchups) {
    for (let stratum = 0; stratum < TELEMETRY_STRATA; stratum += 1) {
      parts.push(
        runBalanceSimulationWithTelemetry(
          matchup.leftId,
          matchup.rightId,
          TELEMETRY_GAMES,
          vanillaBalanceSeed(matchup, stratum),
          overrides,
        ).telemetry,
      );
    }
  }
  const telemetry = mergeBalanceSimulationTelemetry(parts);
  const deck = telemetry.decks[TARGET_ID];
  if (!deck) throw new Error("Tidecall Vanguard telemetry missing");
  const copies = targetDeck.cards.reduce<Record<string, number>>((acc, defId) => {
    acc[defId] = (acc[defId] ?? 0) + 1;
    return acc;
  }, {});
  return {
    games: deck.games,
    cardsPlayedPerGame: round1(deck.cardsPlayed / Math.max(1, deck.games)),
    finalHandPerGame: round1(deck.finalHandSize / Math.max(1, deck.games)),
    alliesSummonedPerGame: round1(deck.finalAlliesSummoned / Math.max(1, deck.games)),
    nexusDamagePerGame: round1(deck.finalNexusDamageDealt / Math.max(1, deck.games)),
    cards: Object.values(deck.cards)
      .map((row) => {
        const def = getCard(row.defId);
        return {
          defId: row.defId,
          name: row.name,
          copies: copies[row.defId] ?? 0,
          type: def.type,
          cost: def.cost,
          power: def.power ?? null,
          health: def.health ?? null,
          keywords: def.keywords ?? [],
          trigger: def.trigger?.effect?.kind ?? null,
          spell: def.spell?.kind ?? null,
          seen: row.seen,
          played: row.played,
          playedPerGame: round1(row.played / Math.max(1, deck.games)),
          playRateWhenSeen: pct(row.played, row.seen),
          endHandRateWhenSeen: pct(row.endHand, row.seen),
          ignoredPlayableSamples: row.ignoredPlayableSamples,
          targetStarvedSamples: row.targetStarvedSamples,
        };
      })
      .sort((a, b) => b.playedPerGame - a.playedPerGame || b.playRateWhenSeen - a.playRateWhenSeen),
  };
}

const baseline = runScenario("baseline", []);
const uniqueTargetCards = [...new Set(targetDeck.cards)];
const costSensitivity = uniqueTargetCards
  .map((defId) => {
    const base = getCard(defId);
    const result = runScenario(`${defId}_cost_plus_1`, [withCost(defId, base.cost + 1)]);
    return {
      defId,
      name: base.name,
      fromCost: base.cost,
      toCost: base.cost + 1,
      winRate: result.winRate,
      deltaVsBaseline: round1(result.winRate - baseline.winRate),
      critical: result.health.critical,
      watch: result.health.watch,
      healthy: result.health.healthy,
    };
  })
  .sort((a, b) => a.deltaVsBaseline - b.deltaVsBaseline || a.defId.localeCompare(b.defId));

const mechanics = [
  runScenario("u03_remove_regeneration", [withoutKeyword("van_tide_u03", "Regeneration")]),
  runScenario("u04_cost_3", [withCost("van_tide_u04", 3)]),
  runScenario("u04_remove_draw_trigger", [withoutTrigger("van_tide_u04")]),
  runScenario("u08_remove_heal_trigger", [withoutTrigger("van_tide_u08")]),
  runScenario("u13_remove_regeneration", [withoutKeyword("van_tide_u13", "Regeneration")]),
  runScenario("s02_cost_3", [withCost("van_tide_s02", 3)]),
  runScenario("identity_soft_combo", [
    withoutKeyword("van_tide_u03", "Regeneration"),
    withCost("van_tide_u04", 3),
    withoutTrigger("van_tide_u08"),
    withoutKeyword("van_tide_u13", "Regeneration"),
  ]),
  runScenario("curve_soft_combo", [
    withCost("van_tide_u02", 2),
    withCost("van_tide_u04", 3),
    withCost("van_tide_u08", 4),
    withCost("van_tide_s02", 3),
  ]),
].map((result) => ({
  ...result,
  deltaVsBaseline: round1(result.winRate - baseline.winRate),
}));

const telemetry = runTelemetry();
const report = {
  version: "Vanilla 1.5 diagnostic screen",
  methodology: "Tidecall Vanguard only; 11 opponents; exact real-engine Balance Lab simulator; paired deterministic seed strata; card registry snapshots for in-memory candidate mutations only; no product card mutation",
  screen: {
    gamesPerStratum: SCREEN_GAMES,
    strata: SCREEN_STRATA,
    gamesPerScenario: baseline.games,
  },
  baseline,
  telemetry,
  costSensitivity,
  mechanics: mechanics.sort((a, b) => a.deltaVsBaseline - b.deltaVsBaseline || a.name.localeCompare(b.name)),
};

if (writePath) {
  fs.mkdirSync(writePath.split("/").slice(0, -1).join("/") || ".", { recursive: true });
  fs.writeFileSync(writePath, `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify(report, null, 2));
