import fs from "node:fs";
import path from "node:path";
import { aiChooseAction, aiChooseBlocks, aiChooseReaction, applyAiAction, aiResolveTurnEnd } from "../src/game/ai";
import { evaluateMatchup } from "../src/game/balance-health";
import { getCard } from "../src/game/cards";
import { getDeck } from "../src/game/decks";
import { applyStackedActionWithAi, createCustomGame, resolveCombat, type CardAction } from "../src/game/engine";
import { graveyardEntries } from "../src/game/graveyard";
import type { DeckInput, GameState, PlayerId } from "../src/game/types";
import { ENGINE_VERSION, RULESET_VERSION } from "../src/game/version";

const ECOS_ID = "ecos_do_abismo";
const OPPONENTS = [
  "ember_aggro",
  "tide_control",
  "wood_midrange",
  "void_shadow",
  "florestia_tribal",
  "tempestade_rush",
  "convergence_dual",
  "convergence_triad",
] as const;
const SEEDS = [173, 1009, 7919, 65537, 104729] as const;
const GAMES_PER_STRATUM = Math.max(8, Math.min(100, Number(process.env.ECOS_GAMES_PER_STRATUM) || 32));
const ENFORCE = process.argv.includes("--enforce");
const MAX_STEPS = 1000;

const OUTLETS = new Set([
  "rfalpha_reanimator_memory_smuggler",
  "rfalpha_reanimator_drowned_sepulcher",
]);
const FINISHERS = new Set([
  "rfalpha_reanimator_drowned_mirror_lady",
  "rfalpha_reanimator_dead_tide_devourer",
  "rfalpha_reanimator_hollow_rift_colossus",
]);
const SEAL_ID = "rfalpha_reanimator_seal_nothing";

interface MatchResult {
  opponent: string;
  seed: number;
  winner: PlayerId | null;
  ecosWon: boolean;
  ecosLost: boolean;
  draw: boolean;
  firstPlayerWon: boolean | null;
  rounds: number;
  completed: boolean;
  firstReanimationRound: number | null;
  reanimationEvents: number;
  reanimationAttempts: number;
  reanimationDisruptions: number;
  reactionUses: number;
  outletActivations: number;
  recoveries: number;
  sealUses: number;
  sealPlayableSamples: number;
  strandedFinishers: number;
  ecosActionCounts: Record<string, number>;
}

interface AppliedAction {
  next: GameState;
  reactionUsed: boolean;
}

function asDeck(id: string): DeckInput {
  const deck = getDeck(id);
  return { id: deck.id, name: deck.name, cards: [...deck.cards] };
}

function other(playerId: PlayerId): PlayerId {
  return playerId === "player" ? "ai" : "player";
}

/**
 * Resolve one AI-selected main-phase action with the same reaction-stack API
 * used by the live PvE path. Main-phase activated abilities remain direct,
 * matching reducer-core's certified `sentinela` transition; hand cards pass
 * through the stack so Deny, Traps and reaction abilities are represented.
 */
function applySymmetricAiAction(state: GameState, action: CardAction, side: PlayerId): AppliedAction {
  if (action.kind === "sentinela") {
    return { next: applyAiAction(state, action, side), reactionUsed: false };
  }

  const pending: CardAction = { ...action, player: side };
  const respondingSide = other(side);

  if (respondingSide === "player") {
    const response = aiChooseReaction(state, pending, "player");
    const result = applyStackedActionWithAi(
      state,
      pending,
      response ? "react" : "skip",
      response,
      (current, pendingAction) => aiChooseReaction(current, pendingAction, "ai"),
    );
    return { next: result.next, reactionUsed: Boolean(response) };
  }

  let chosenAiResponse: CardAction | null = null;
  const result = applyStackedActionWithAi(
    state,
    pending,
    "skip",
    null,
    (current, pendingAction) => {
      chosenAiResponse = aiChooseReaction(current, pendingAction, "ai");
      return chosenAiResponse;
    },
  );
  return { next: result.next, reactionUsed: Boolean(chosenAiResponse) };
}

function graveyardEntry(state: GameState, owner: PlayerId, instanceId: string | undefined) {
  return instanceId ? graveyardEntries(state, owner).find((entry) => entry.instanceId === instanceId) : undefined;
}

function countBenchDef(state: GameState, owner: PlayerId, defId: string): number {
  return state.players[owner].bench.filter((unit) => unit.defId === defId).length;
}

function countHandDef(state: GameState, owner: PlayerId, defId: string): number {
  return state.players[owner].hand.filter((card) => card.defId === defId).length;
}

function playMatch(opponentId: string, seed: number, gameIndex: number): MatchResult {
  const ecosIsPlayer = gameIndex % 2 === 0;
  const playerGoesFirst = Math.floor(gameIndex / 2) % 2 === 0;
  const ecosSide: PlayerId = ecosIsPlayer ? "player" : "ai";
  const playerDeck = asDeck(ecosIsPlayer ? ECOS_ID : opponentId);
  const aiDeck = asDeck(ecosIsPlayer ? opponentId : ECOS_ID);
  const matchSeed = (seed + gameIndex * 7919) & 0x7fffffff;

  let state: GameState = createCustomGame("Ecos Balance", playerDeck, aiDeck, {
    seed: matchSeed,
    playerGoesFirst,
    skipMulligan: true,
  });

  let firstReanimationRound: number | null = null;
  let reanimationEvents = 0;
  let reanimationAttempts = 0;
  let reanimationDisruptions = 0;
  let reactionUses = 0;
  let outletActivations = 0;
  let recoveries = 0;
  let sealUses = 0;
  let sealPlayableSamples = 0;
  const ecosActionCounts: Record<string, number> = {};
  let guard = 0;

  while (state.phase !== "gameover" && guard++ < MAX_STEPS) {
    if (state.phase === "blocking") {
      const defender: PlayerId = state.combat?.attackerId === "player" ? "ai" : "player";
      state = resolveCombat(state, aiChooseBlocks(state, defender));
      continue;
    }
    if (state.phase !== "main") continue;

    const side = state.activePlayer;
    if (side === ecosSide) {
      const ecos = state.players[ecosSide];
      const enemy = other(ecosSide);
      if (
        ecos.hand.some((card) => card.defId === SEAL_ID) &&
        graveyardEntries(state, enemy).length > 0
      ) {
        sealPlayableSamples += 1;
      }
    }

    const action = aiChooseAction(state, side);
    if (!action) {
      state = aiResolveTurnEnd(state, side);
      continue;
    }

    const before = state;
    const def = getCard(action.defId);
    const targetOwner = def.spell?.target === "enemyGraveyardCard" ? other(side) : side;
    const targetedGraveyard = graveyardEntry(before, targetOwner, action.targetInstanceId);
    const beforeTargetBenchCount = targetedGraveyard ? countBenchDef(before, side, targetedGraveyard.defId) : 0;
    const beforeTargetHandCount = targetedGraveyard ? countHandDef(before, side, targetedGraveyard.defId) : 0;

    if (side === ecosSide && def.spell?.kind === "reanimateUnit") reanimationAttempts += 1;

    const applied = applySymmetricAiAction(state, action, side);
    const next = applied.next;
    if (applied.reactionUsed) reactionUses += 1;
    if (next === before) {
      state = aiResolveTurnEnd(state, side);
      continue;
    }

    if (side === ecosSide) {
      ecosActionCounts[action.defId] = (ecosActionCounts[action.defId] ?? 0) + 1;
      if (action.kind === "sentinela" && OUTLETS.has(action.defId)) outletActivations += 1;

      if (def.spell?.kind === "reanimateUnit") {
        const targetConsumed = Boolean(targetedGraveyard) && !graveyardEntry(next, targetOwner, targetedGraveyard?.instanceId);
        const targetEnteredBench = Boolean(targetedGraveyard) &&
          countBenchDef(next, side, targetedGraveyard!.defId) > beforeTargetBenchCount;
        if (targetConsumed && targetEnteredBench) {
          reanimationEvents += 1;
          if (firstReanimationRound == null) firstReanimationRound = before.round;
        } else if (applied.reactionUsed) {
          reanimationDisruptions += 1;
        }
      }

      if (def.spell?.kind === "returnGraveyardToHand" && targetedGraveyard) {
        const targetConsumed = !graveyardEntry(next, targetOwner, targetedGraveyard.instanceId);
        const targetEnteredHand = countHandDef(next, side, targetedGraveyard.defId) > beforeTargetHandCount;
        if (targetConsumed && targetEnteredHand) recoveries += 1;
      }

      if (action.defId === SEAL_ID && def.spell?.kind === "banishGraveyardCard" && targetedGraveyard) {
        if (!graveyardEntry(next, targetOwner, targetedGraveyard.instanceId)) sealUses += 1;
      }
    }
    state = next;
  }

  const completed = state.phase === "gameover" && Boolean(state.winner);
  const winner = state.winner ?? null;
  const ecosWon = winner === ecosSide;
  const ecosLost = winner != null && winner !== ecosSide;
  const draw = !completed;
  const firstPlayerWon = winner == null
    ? null
    : (winner === "player" && playerGoesFirst) || (winner === "ai" && !playerGoesFirst);
  const strandedFinishers = state.players[ecosSide].hand.filter((card) => FINISHERS.has(card.defId)).length;

  return {
    opponent: opponentId,
    seed: matchSeed,
    winner,
    ecosWon,
    ecosLost,
    draw,
    firstPlayerWon,
    rounds: state.round,
    completed,
    firstReanimationRound,
    reanimationEvents,
    reanimationAttempts,
    reanimationDisruptions,
    reactionUses,
    outletActivations,
    recoveries,
    sealUses,
    sealPlayableSamples,
    strandedFinishers,
    ecosActionCounts,
  };
}

function pct(n: number, d: number): number {
  return d ? Math.round((n / d) * 1000) / 10 : 0;
}

function wilson95(wins: number, total: number): { low: number; high: number } {
  if (!total) return { low: 0, high: 0 };
  const z = 1.96;
  const p = wins / total;
  const z2 = z * z;
  const center = (p + z2 / (2 * total)) / (1 + z2 / total);
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total) / (1 + z2 / total);
  return {
    low: Math.round(Math.max(0, center - margin) * 1000) / 10,
    high: Math.round(Math.min(1, center + margin) * 1000) / 10,
  };
}

function cardUsageForGames(games: readonly MatchResult[]) {
  const defIds = [...new Set(games.flatMap((game) => Object.keys(game.ecosActionCounts)))];
  return defIds
    .map((defId) => {
      const used = games.filter((game) => (game.ecosActionCounts[defId] ?? 0) > 0);
      const wins = used.filter((game) => game.ecosWon).length;
      const losses = used.filter((game) => game.ecosLost).length;
      const uses = used.reduce((sum, game) => sum + (game.ecosActionCounts[defId] ?? 0), 0);
      return {
        defId,
        uses,
        gamesUsed: used.length,
        gameRate: pct(used.length, games.length),
        avgUsesWhenUsed: used.length ? Math.round((uses / used.length) * 10) / 10 : 0,
        winRateWhenUsed: pct(wins, wins + losses),
      };
    })
    .sort((a, b) => b.gamesUsed - a.gamesUsed || b.uses - a.uses || a.defId.localeCompare(b.defId));
}

const results: MatchResult[] = [];
for (const opponent of OPPONENTS) {
  for (const seed of SEEDS) {
    for (let game = 0; game < GAMES_PER_STRATUM; game += 1) {
      results.push(playMatch(opponent, seed, game));
    }
  }
}

const rows = OPPONENTS.map((opponent) => {
  const games = results.filter((row) => row.opponent === opponent);
  const wins = games.filter((row) => row.ecosWon).length;
  const losses = games.filter((row) => row.ecosLost).length;
  const draws = games.length - wins - losses;
  const decisive = wins + losses;
  const winRate = pct(wins, decisive);
  return {
    opponent,
    games: games.length,
    wins,
    losses,
    draws,
    winRate,
    winRate95: wilson95(wins, decisive),
    avgRounds: Math.round(games.reduce((sum, game) => sum + game.rounds, 0) / Math.max(games.length, 1) * 10) / 10,
    reactions: games.reduce((sum, game) => sum + game.reactionUses, 0),
    reanimationAttempts: games.reduce((sum, game) => sum + game.reanimationAttempts, 0),
    reanimationDisruptions: games.reduce((sum, game) => sum + game.reanimationDisruptions, 0),
    cardUsage: cardUsageForGames(games),
    health: evaluateMatchup(winRate),
  };
});

const totalGames = results.length;
const completedGames = results.filter((row) => row.completed).length;
const wins = results.filter((row) => row.ecosWon).length;
const losses = results.filter((row) => row.ecosLost).length;
const draws = totalGames - wins - losses;
const decisive = wins + losses;
const firstPlayerDecisive = results.filter((row) => row.firstPlayerWon != null);
const firstPlayerWins = firstPlayerDecisive.filter((row) => row.firstPlayerWon === true).length;
const reanimatedGames = results.filter((row) => row.firstReanimationRound != null);
const firstReanimationRoundTotal = reanimatedGames.reduce((sum, row) => sum + (row.firstReanimationRound ?? 0), 0);

const early = Object.fromEntries([3, 4, 5].map((round) => {
  const games = results.filter((row) => row.firstReanimationRound != null && row.firstReanimationRound <= round);
  const earlyWins = games.filter((row) => row.ecosWon).length;
  return [round, {
    games: games.length,
    gameRate: pct(games.length, totalGames),
    wins: earlyWins,
    winRate: pct(earlyWins, games.filter((row) => row.ecosWon || row.ecosLost).length),
  }];
}));

const critical = rows.filter((row) => row.health.status === "critical");
const watch = rows.filter((row) => row.health.status === "watch");
const qualityGate = completedGames === totalGames ? "pass" : "blocked";
const releaseGate = critical.length > 0 ? "blocked" : watch.length > 0 ? "review" : "pass";

const report = {
  audit: "Ecos do Abismo 1.0",
  generatedAt: new Date().toISOString(),
  engineVersion: ENGINE_VERSION,
  rulesetVersion: RULESET_VERSION,
  config: {
    opponents: [...OPPONENTS],
    seedStrata: [...SEEDS],
    gamesPerStratum: GAMES_PER_STRATUM,
    totalGames,
    maxSteps: MAX_STEPS,
    policy: "ai-core-vs-ai-core+authoritative-reaction-stack+card-utilization",
  },
  qualityGate,
  releaseGate,
  aggregate: {
    completedGames,
    wins,
    losses,
    draws,
    winRate: pct(wins, decisive),
    drawRate: pct(draws, totalGames),
    firstPlayerWinRate: pct(firstPlayerWins, firstPlayerDecisive.length),
    reactionUses: results.reduce((sum, row) => sum + row.reactionUses, 0),
    gamesWithReanimation: reanimatedGames.length,
    reanimationGameRate: pct(reanimatedGames.length, totalGames),
    averageFirstReanimationRound: reanimatedGames.length
      ? Math.round((firstReanimationRoundTotal / reanimatedGames.length) * 10) / 10
      : null,
    reanimationEvents: results.reduce((sum, row) => sum + row.reanimationEvents, 0),
    reanimationAttempts: results.reduce((sum, row) => sum + row.reanimationAttempts, 0),
    reanimationDisruptions: results.reduce((sum, row) => sum + row.reanimationDisruptions, 0),
    outletActivations: results.reduce((sum, row) => sum + row.outletActivations, 0),
    recoveries: results.reduce((sum, row) => sum + row.recoveries, 0),
    sealUses: results.reduce((sum, row) => sum + row.sealUses, 0),
    sealPlayableSamples: results.reduce((sum, row) => sum + row.sealPlayableSamples, 0),
    strandedFinishersAtGameEnd: results.reduce((sum, row) => sum + row.strandedFinishers, 0),
    earlyReanimation: early,
    cardUsage: cardUsageForGames(results),
  },
  matchups: rows,
  outliers: rows.filter((row) => row.health.status !== "healthy"),
};

const outputDir = path.join(process.cwd(), "artifacts", "ecos-do-abismo-balance");
fs.mkdirSync(outputDir, { recursive: true });
const outputPath = path.join(outputDir, "report.json");
fs.writeFileSync(outputPath, JSON.stringify(report, null, 2) + "\n", "utf8");

console.log(JSON.stringify(report, null, 2));
console.log(`ECOS BALANCE AUDIT: ${qualityGate.toUpperCase()} quality · ${releaseGate.toUpperCase()} release · ${totalGames} deterministic games`);
console.log(`Artifact: ${outputPath}`);

if (ENFORCE && qualityGate !== "pass") process.exit(2);
if (ENFORCE && releaseGate === "blocked") process.exit(3);
