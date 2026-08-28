import { runtimeGate } from "@/lib/runtime-gates";
import { db } from "@/db";
import { requireStablePlayerIdentity } from "@/lib/player-session";
import { randomInt } from "node:crypto";
import { replays } from "@/db/schema";
import { getRuntimeDecks } from "@/lib/control-plane";
import {
  canDeclareAttack,
  canPlayCard,
  castSpell,
  createGame,
  declareAttack,
  endTurn,
  playUnit,
  resolveCombat,
  spellNeedsTarget,
} from "@/game/engine";
import { aiChooseAction, aiChooseBlocks, applyAiAction, aiResolveTurnEnd } from "@/game/ai";
import { getCard } from "@/game/cards";
import type { GameState, DeckInput, PlayerId } from "@/game/types";
import { CONTENT_VERSION } from "@/game/content-version";
import { ENGINE_VERSION, RULESET_VERSION } from "@/game/version";
import { ensureConfigLoaded } from "@/game/settings";
import { snapshotReplayBundle } from "@/game/deck-service";
import { consumeRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";


/** Runs an authoritative AI-vs-AI match entirely on the server. */
export async function POST(req: Request) {
  const runtimeBlocked = await runtimeGate("ai");
  if (runtimeBlocked) return runtimeBlocked;
  try {
    await ensureConfigLoaded();
    const DECKS = await getRuntimeDecks();
    if (DECKS.length < 2) return Response.json({ ok: false, error: "At least two official decks are required" }, { status: 503 });
    const identity = await requireStablePlayerIdentity(req);
    if (!identity || identity.playerId == null) return Response.json({ ok: false, error: "Player session required" }, { status: 401 });
    const rate = await consumeRateLimit(`simulate:${identity.playerId}`, 3, 60_000);
    if (!rate.allowed) return Response.json({ ok: false, error: "Simulation rate limit exceeded. Try again later." }, { status: 429, headers: { "retry-after": String(rate.retryAfterSeconds) } });
    const body = await req.json();
    const playerName = identity.playerName;
    const deckId = DECKS.find((d) => d.id === body.deckId || d.name === body.deckId)?.id ?? DECKS[0].id;
    const aiDeckId = DECKS.find((d) => d.id !== deckId && (d.id === body.aiDeckId || d.name === body.aiDeckId))
      ?.id ?? DECKS.find((d) => d.id !== deckId)?.id ?? DECKS[0].id;
    const seed = randomInt(1, 0x7fffffff);
    const playerFirst = randomInt(0, 2) === 0;

    const playerDeck = DECKS.find((d) => d.id === deckId)!;
    const aiDeck = DECKS.find((d) => d.id === aiDeckId)!;
    const pDeck: DeckInput = { id: playerDeck.id, name: playerDeck.name, cards: playerDeck.cards };
    const aDeck: DeckInput = { id: aiDeck.id, name: aiDeck.name, cards: aiDeck.cards };

    let state: GameState = createGame(playerName, pDeck, aDeck, playerFirst, seed);
    const log: string[] = [];
    let prevLen = 0;
    const drain = () => {
      for (let i = prevLen; i < state.log.length; i++) log.push(state.log[i]);
      prevLen = state.log.length;
    };
    drain();
    let guard = 0;

    const playOneFor = (pid: PlayerId): boolean => {
      const p = state.players[pid];
      const playable = p.hand.filter((c) => canPlayCard(state, pid, c.instanceId));
      if (playable.length === 0) return false;
      // Prefer higher-cost cards, but do not get stuck on invalid targeted spells.
      const ordered = [...playable].sort((a, b) => getCard(b.defId).cost - getCard(a.defId).cost);
      for (const c of ordered) {
        const def = getCard(c.defId);
        const needs = spellNeedsTarget(c.defId);
        let next = state;
        if (def.type === "Unit" || def.type === "Enchantment" || def.type === "Artifact" || def.type === "Sentinela") {
          next = playUnit(state, pid, c.instanceId);
        } else if (def.type === "Equipment") {
          const target = [...p.bench].filter((u) => u.equipment.length < 2).sort((a, b) => b.power - a.power)[0];
          if (!target) continue;
          next = playUnit(state, pid, c.instanceId, target.instanceId);
        } else if (def.type === "Spell") {
          if (!needs || needs === "none" || needs === "self" || needs === "spellOnStack") {
            next = castSpell(state, pid, c.instanceId);
          } else if (needs === "enemyUnit" || needs === "anyUnit") {
            const target = state.players[pid === "player" ? "ai" : "player"].bench.sort((a, b) => b.power - a.power)[0];
            if (!target) continue;
            next = castSpell(state, pid, c.instanceId, target.instanceId);
          } else if (needs === "allyUnit") {
            const target = p.bench.sort((a, b) => b.power - a.power)[0];
            if (!target) continue;
            next = castSpell(state, pid, c.instanceId, target.instanceId);
          } else if (needs === "enemyPermanent") {
            const target = state.players[pid === "player" ? "ai" : "player"].permanents[0];
            if (!target) continue;
            next = castSpell(state, pid, c.instanceId, target.instanceId);
          } else if (needs === "allyPermanent") {
            const target = p.permanents[0];
            if (!target) continue;
            next = castSpell(state, pid, c.instanceId, target.instanceId);
          } else if (needs === "enemySentinela" || needs === "anySentinela") {
            const target = state.players[pid === "player" ? "ai" : "player"].sentinelas.sort((a, b) => a.loyalty - b.loyalty)[0];
            if (!target) continue;
            next = castSpell(state, pid, c.instanceId, target.instanceId);
          } else if (needs === "allySentinela") {
            const target = p.sentinelas.sort((a, b) => a.loyalty - b.loyalty)[0];
            if (!target) continue;
            next = castSpell(state, pid, c.instanceId, target.instanceId);
          } else if (needs === "anyBoard") {
            const enemy = state.players[pid === "player" ? "ai" : "player"];
            const target = enemy.bench[0] ?? enemy.permanents[0] ?? enemy.sentinelas[0] ?? p.bench[0] ?? p.permanents[0] ?? p.sentinelas[0];
            if (!target) continue;
            next = castSpell(state, pid, c.instanceId, target.instanceId);
          }
        }
        if (next !== state && next.log.length > state.log.length) {
          state = next;
          return true;
        }
      }
      return false;
    };

    const step = (): "gameover" | "continue" => {
      if (state.phase === "gameover") return "gameover";
      if (state.phase === "blocking") {
        state = resolveCombat(state, aiChooseBlocks(state));
        drain();
        return "continue";
      }
      if (state.phase === "main" && state.activePlayer === "ai") {
        const action = aiChooseAction(state);
        if (action) {
          const before = state.log.length;
          const next = applyAiAction(state, action);
          if (next === state || next.log.length === before) {
            state = aiResolveTurnEnd(state);
          } else {
            state = next;
          }
        } else {
          state = aiResolveTurnEnd(state);
        }
        drain();
      } else if (state.phase === "main" && state.activePlayer === "player") {
        // Player side now plays from its own hand/board, not via applyAiAction.
        const played = playOneFor("player");
        if (played) {
          drain();
          return "continue";
        }
        if (canDeclareAttack(state, "player")) {
          const ids = state.players.player.bench.filter((u) => !u.stunned && !u.summonedThisTurn).map((u) => u.instanceId);
          if (ids.length > 0) state = declareAttack(state, "player", ids, {});
          else state = endTurn(state, "player");
        } else {
          state = endTurn(state, "player");
        }
        drain();
      }
      return "continue";
    };

    while (state.phase !== "gameover" && guard < 600) {
      guard += 1;
      if (step() === "gameover") break;
    }

    const won = state.winner === "player";
    const [row] = await db
      .insert(replays)
      .values({
        playerName,
        playerId: identity.playerId,
        deckName: playerDeck.name,
        deckId: playerDeck.id,
        aiDeckName: aiDeck.name,
        aiDeckId: aiDeck.id,
        aiDifficulty: state.aiDifficulty,
        won,
        rounds: state.round,
        playerFirst,
        seed: state.seed,
        log: JSON.stringify(log),
        deckSnapshot: snapshotReplayBundle(pDeck, aDeck),
        contentHash: snapshotReplayBundle(pDeck, aDeck).contentHash,
        engineRules: state.rules,
        aiRules: state.aiRules,
        matchOptionsSnapshot: { aiDifficulty: state.aiDifficulty },
        engineVersion: ENGINE_VERSION,
        rulesetVersion: RULESET_VERSION,
        contentVersion: CONTENT_VERSION,
      })
      .returning();

    // Collapse consecutive duplicate lines (harmless but noisy in the viewer).
    const deduped: string[] = [];
    for (const line of log) {
      if (deduped[deduped.length - 1] !== line) deduped.push(line);
    }

    return Response.json({
      ok: true,
      final: {
        winner: state.winner,
        rounds: state.round,
        playerNexus: state.players.player.nexusHealth,
        aiNexus: state.players.ai.nexusHealth,
      },
      replay: row,
      log: deduped.slice(-40),
    });
  } catch {
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
