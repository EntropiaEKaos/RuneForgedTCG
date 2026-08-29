import assert from "node:assert/strict";
import { aiChooseAction, aiChooseBlocks, aiChooseReaction, type AiAction } from "../src/game/ai";
import { replayAuthoritativeMatch } from "../src/game/authoritative";
import { registerCustomCards } from "../src/game/custom-registry";
import { applyStackedActionWithAi, canDeclareAttack, createCustomGame, isReadyToAttack, type CardAction } from "../src/game/engine";
import { applyGameAction, type GameAction } from "../src/game/reducer";
import type { AiDifficulty, AiRulesSnapshot, DeckInput, EngineRulesSnapshot, GameState } from "../src/game/types";

const baseUrl = process.env.E2E_BASE_URL?.replace(/\/$/, "");
if (!baseUrl) throw new Error("E2E_BASE_URL is required (example: http://127.0.0.1:3000)");

const MAX_ALPHA_ACTIONS = 2200;
const MAX_PLAYER_MAIN_ACTIONS_PER_ROUND = 8;

class BrowserClient {
  private cookie = "";

  async request(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    if (this.cookie) headers.set("cookie", this.cookie);
    const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
    const cookieHeaders = (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.()
      ?? (response.headers.get("set-cookie") ? [response.headers.get("set-cookie")!] : []);
    if (cookieHeaders.length) this.cookie = cookieHeaders.map((value) => value.split(";", 1)[0]).join("; ");
    const body = await response.json().catch(() => ({}));
    return { response, body };
  }
}

type CatalogDeck = DeckInput & { regions?: string[] };
type TokenPayload = {
  token: string;
  seed: number;
  playerFirst: boolean;
  opponentDeck: DeckInput;
  difficulty: AiDifficulty;
  engineRules: EngineRulesSnapshot;
  aiRules: AiRulesSnapshot;
};

function toPlayerAction(action: AiAction): GameAction {
  if (action.kind === "sentinela") {
    return {
      type: "sentinela",
      player: "player",
      sentinelaId: action.instanceId,
      abilityIndex: action.abilityIndex ?? 0,
      target: action.targetInstanceId,
    };
  }
  return {
    type: action.kind === "spell" ? "cast" : "play",
    player: "player",
    instanceId: action.instanceId,
    target: action.targetInstanceId,
  };
}

function buildCompleteActionLog(playerName: string, playerDeck: DeckInput, token: TokenPayload) {
  let state: GameState = createCustomGame(playerName, playerDeck, token.opponentDeck, {
    playerGoesFirst: token.playerFirst,
    seed: token.seed,
    aiDifficulty: token.difficulty,
    rules: token.engineRules,
    aiRules: token.aiRules,
  });
  let pendingAiAction: CardAction | null = null;
  const actions: GameAction[] = [];
  let budgetRound = state.round;
  let playerMainActionsThisRound = 0;
  let playerAttackedThisRound = false;

  const refreshPlayerActionBudget = () => {
    if (state.round !== budgetRound) {
      budgetRound = state.round;
      playerMainActionsThisRound = 0;
      playerAttackedThisRound = false;
    }
  };

  const driveServerAi = () => {
    for (let guard = 0; guard < 100 && !pendingAiAction && state.phase !== "gameover" && state.activePlayer === "ai"; guard += 1) {
      const result = applyGameAction(state, { type: "aiStep" });
      if (result.awaitingReaction) pendingAiAction = result.awaitingReaction.action;
      if (result.next === state && !pendingAiAction) break;
      state = result.next;
    }
  };

  const submit = (action: GameAction) => {
    actions.push(action);
    if (pendingAiAction) {
      assert.equal(action.type, "resolve", "the alpha autopilot only declines server-derived reaction windows");
      state = applyStackedActionWithAi(state, pendingAiAction, "skip", null, aiChooseReaction).next;
      pendingAiAction = null;
      driveServerAi();
      return;
    }
    const result = applyGameAction(state, action);
    assert.notEqual(result.next, state, `generated player action must advance state: ${action.type}`);
    state = result.next;
    pendingAiAction = result.awaitingReaction?.action ?? null;
    driveServerAi();
  };

  for (let guard = 0; guard < MAX_ALPHA_ACTIONS && state.phase !== "gameover"; guard += 1) {
    refreshPlayerActionBudget();
    if (pendingAiAction) {
      submit({ type: "resolve" });
      continue;
    }
    if (!state.mulliganDone.player) {
      submit({ type: "skipMulligan", player: "player" });
      continue;
    }
    if (state.phase === "blocking" && state.combat?.attackerId === "ai") {
      submit({ type: "block", blocks: aiChooseBlocks(state, "player") });
      continue;
    }
    if (state.phase === "main" && state.activePlayer === "player") {
      // Behave like a real Alpha player instead of recursively exhausting every
      // generated zero-cost line. A human takes at most one normal attack per
      // round in this certification, then a bounded number of main-phase plays,
      // then deliberately passes. This also prevents a still-live attack token
      // from turning the harness into an attack/re-resolve loop without round progress.
      if (!playerAttackedThisRound && canDeclareAttack(state, "player")) {
        const attackerIds = state.players.player.bench.filter(isReadyToAttack).map((unit) => unit.instanceId);
        if (attackerIds.length) {
          playerAttackedThisRound = true;
          submit({ type: "attack", player: "player", attackerIds });
          continue;
        }
      }

      if (playerMainActionsThisRound < MAX_PLAYER_MAIN_ACTIONS_PER_ROUND) {
        const chosen = aiChooseAction(state, "player");
        if (chosen) {
          playerMainActionsThisRound += 1;
          submit(toPlayerAction(chosen));
          continue;
        }
      }

      submit({ type: "pass", player: "player" });
      continue;
    }
    if (state.activePlayer === "ai") {
      const before = state;
      driveServerAi();
      assert.ok(state !== before || pendingAiAction || state.phase === "blocking", "server AI must make progress");
      continue;
    }
    throw new Error(`Alpha journey autopilot reached an unsupported state: phase=${state.phase}, active=${state.activePlayer}`);
  }

  const diagnostic = `round=${state.round}, playerDeck=${state.players.player.deck.length}, aiDeck=${state.players.ai.deck.length}, playerHand=${state.players.player.hand.length}, aiHand=${state.players.ai.hand.length}, playerBench=${state.players.player.bench.length}, aiBench=${state.players.ai.bench.length}`;
  assert.equal(state.phase, "gameover", `alpha PvE action log did not finish within ${actions.length} submitted actions (${diagnostic})`);
  assert.ok(state.winner, "alpha PvE action log finished without a winner");
  assert.ok(actions.length > 3 && actions.length < MAX_ALPHA_ACTIONS, `alpha action log length is suspicious: ${actions.length}`);

  const replay = replayAuthoritativeMatch({
    playerName,
    playerDeck,
    aiDeck: token.opponentDeck,
    playerGoesFirst: token.playerFirst,
    seed: token.seed,
    actions,
    customOptions: { aiDifficulty: token.difficulty, rules: token.engineRules, aiRules: token.aiRules },
  });
  assert.equal(replay.state.phase, "gameover");
  assert.equal(replay.state.winner, state.winner, "local authoritative replay must match the generated final winner");
  assert.equal(replay.applied, actions.length);
  return { actions, final: replay.state };
}

async function main() {
  const runId = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
  const client = new BrowserClient();

  const anonymous = await client.request("/api/player");
  assert.equal(anonymous.response.status, 401, "new alpha visitor must not get a phantom account from GET /api/player");

  const displayName = `Alpha ${runId}`.slice(0, 40);
  const created = await client.request("/api/player", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ displayName }),
  });
  assert.equal(created.response.status, 201, JSON.stringify(created.body));
  assert.equal(created.body.ok, true);
  assert.equal(created.body.player?.name, displayName);
  assert.match(String(created.body.recoveryCode || ""), /^[A-Za-z0-9_-]{24,}$/);
  const recoveryCode = String(created.body.recoveryCode);
  const playerId = Number(created.body.player.id);
  const walletBefore = {
    xp: Number(created.body.player.xp || 0),
    gold: Number(created.body.player.gold || 0),
    dust: Number(created.body.player.dust || 0),
  };

  const catalog = await client.request("/api/catalog");
  assert.equal(catalog.response.status, 200, JSON.stringify(catalog.body));
  assert.equal(catalog.body.ok, true);
  assert.equal(catalog.body.config?.rankedEnabled, false, "local/playable alpha must keep Ranked fail-closed");
  assert.ok(Array.isArray(catalog.body.decks) && catalog.body.decks.length > 0, "alpha must expose at least one playable preset deck");
  assert.ok(Number(catalog.body.baseCount || 0) > 0, "alpha catalog must expose base cards");
  registerCustomCards(Array.isArray(catalog.body.custom) ? catalog.body.custom : []);

  const preset = catalog.body.decks[0] as CatalogDeck;
  assert.ok(preset?.id && preset?.name && Array.isArray(preset.cards) && preset.cards.length > 0, "first preset deck must be playable");

  const forged = await client.request("/api/decks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: `Alpha Forge ${runId}`.slice(0, 40), emoji: "⚒️", formatId: "eternal", cards: preset.cards }),
  });
  assert.equal(forged.response.status, 200, `Forge persistence failed: ${JSON.stringify(forged.body)}`);
  assert.equal(forged.body.ok, true);
  assert.ok(Number(forged.body.deck?.id) > 0, "Forge must return a persisted custom deck id");
  const customDeck: DeckInput = {
    id: `custom_${forged.body.deck.id}`,
    name: forged.body.deck.name,
    cards: [...forged.body.deck.cards],
    formatId: forged.body.deck.formatId || "eternal",
  };

  const savedDecks = await client.request("/api/decks");
  assert.equal(savedDecks.response.status, 200, JSON.stringify(savedDecks.body));
  assert.ok(savedDecks.body.decks?.some((deck: { id: number }) => deck.id === forged.body.deck.id), "forged deck must be immediately selectable from the stable session");

  const tokenResponse = await client.request("/api/matches/token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ deckId: customDeck.id, difficulty: "apprentice" }),
  });
  assert.equal(tokenResponse.response.status, 200, `authoritative PvE preparation failed: ${JSON.stringify(tokenResponse.body)}`);
  assert.equal(tokenResponse.body.ok, true);
  assert.equal(tokenResponse.body.authoritative?.seed, true);
  assert.equal(tokenResponse.body.authoritative?.opponent, true);
  assert.equal(tokenResponse.body.authoritative?.initiative, true);
  assert.ok(tokenResponse.body.token && tokenResponse.body.opponentDeck?.id, "authoritative PvE token must include immutable match inputs");

  const token: TokenPayload = {
    token: String(tokenResponse.body.token),
    seed: Number(tokenResponse.body.seed),
    playerFirst: Boolean(tokenResponse.body.playerFirst),
    opponentDeck: tokenResponse.body.opponentDeck,
    difficulty: tokenResponse.body.difficulty,
    engineRules: tokenResponse.body.engineRules,
    aiRules: tokenResponse.body.aiRules,
  };
  const generated = buildCompleteActionLog(displayName, customDeck, token);

  const settlement = await client.request("/api/matches", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ matchToken: token.token, actions: generated.actions }),
  });
  assert.equal(settlement.response.status, 200, `authoritative PvE settlement failed: ${JSON.stringify(settlement.body)}`);
  assert.equal(settlement.body.ok, true);
  assert.equal(settlement.body.authoritative, true);
  assert.equal(settlement.body.winner, generated.final.winner);
  assert.equal(Number(settlement.body.appliedActions), generated.actions.length);
  const matchId = Number(settlement.body.match?.id);
  assert.ok(matchId > 0, "settled alpha match must persist a match id");
  assert.equal(settlement.body.match?.rewardsClaimed, false, "settlement and reward claim must remain separate authoritative steps");

  const reward = await client.request("/api/player/update", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ matchId }),
  });
  assert.equal(reward.response.status, 200, `match reward claim failed: ${JSON.stringify(reward.body)}`);
  assert.equal(reward.body.ok, true);
  assert.equal(reward.body.matchId, matchId);
  assert.ok(Number(reward.body.xpGain) > 0, "every completed alpha match must award XP");
  assert.ok(Number(reward.body.goldGain) > 0, "every completed alpha match must award gold");
  assert.ok(Number(reward.body.dustGain) >= 0, "dust reward must be a non-negative authoritative value");

  const duplicateReward = await client.request("/api/player/update", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ matchId }),
  });
  assert.equal(duplicateReward.response.status, 409, "the same match reward must be exactly-once");

  const profileAfter = await client.request("/api/player");
  assert.equal(profileAfter.response.status, 200, JSON.stringify(profileAfter.body));
  assert.equal(Number(profileAfter.body.player.xp), walletBefore.xp + Number(reward.body.xpGain));
  assert.equal(Number(profileAfter.body.player.gold), walletBefore.gold + Number(reward.body.goldGain));
  assert.equal(Number(profileAfter.body.player.dust), walletBefore.dust + Number(reward.body.dustGain));
  assert.equal(Number(profileAfter.body.stats.matches), 1, "completed PvE match must appear in player progression stats");
  assert.equal(Number(profileAfter.body.stats.wins), generated.final.winner === "player" ? 1 : 0);
  assert.equal(Number(profileAfter.body.stats.customDecks), 1, "forged deck must remain attached to the player profile");

  const recoveredClient = new BrowserClient();
  const recovered = await recoveredClient.request("/api/player", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ recoveryCode }),
  });
  assert.equal(recovered.response.status, 200, `alpha recovery failed after progression: ${JSON.stringify(recovered.body)}`);
  assert.equal(recovered.body.recovered, true);
  assert.equal(Number(recovered.body.player.id), playerId);
  assert.equal(Number(recovered.body.player.xp), Number(profileAfter.body.player.xp));
  assert.equal(Number(recovered.body.player.gold), Number(profileAfter.body.player.gold));
  assert.equal(Number(recovered.body.player.dust), Number(profileAfter.body.player.dust));
  assert.equal(Number(recovered.body.stats.matches), 1);
  assert.equal(Number(recovered.body.stats.customDecks), 1);

  const recoveredDecks = await recoveredClient.request("/api/decks");
  assert.equal(recoveredDecks.response.status, 200, JSON.stringify(recoveredDecks.body));
  assert.ok(recoveredDecks.body.decks?.some((deck: { id: number }) => deck.id === forged.body.deck.id), "recovered session must retain the forged playable deck");

  console.log(`ALPHA PLAYER JOURNEY: PASS — account → catalog → Forge → authoritative PvE (${generated.actions.length} actions, ${generated.final.winner}) → exactly-once rewards → progression → recovery persistence`);
}

void main().catch((error) => {
  console.error("ALPHA PLAYER JOURNEY: FAIL", error);
  process.exitCode = 1;
});