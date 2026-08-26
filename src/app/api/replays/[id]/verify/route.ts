import { NextRequest } from "next/server";
import { db } from "@/db";
import { players, replays } from "@/db/schema";
import { eq } from "drizzle-orm";
import { replayAuthoritativeMatch } from "@/game/authoritative";
import { replayPvpMatch } from "@/lib/pvp-replay";
import type { AiRulesSnapshot, CardDef, DeckInput, EngineRulesSnapshot } from "@/game/types";
import type { GameAction } from "@/game/reducer";
import type { CustomGameOptions } from "@/game/engine";
import { legacyAiRules, legacyEngineRules } from "@/game/runtime-config";
import { withRegisteredCardSnapshot } from "@/game/custom-registry";
import { actionLogHash, replayIntegrity, stateHash } from "@/lib/match-integrity";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const replayId = Number(id);
    if (!Number.isInteger(replayId)) return Response.json({ ok: false, error: "Invalid id" }, { status: 400 });
    const [row] = await db.select().from(replays).where(eq(replays.id, replayId)).limit(1);
    if (!row || !row.actionLog || !row.deckSnapshot) return Response.json({ ok: false, error: "Replay is not authoritative" }, { status: 409 });

    const perspectiveSnapshot = row.deckSnapshot as { player?: DeckInput; opponent?: DeckInput; cardDefs?: CardDef[]; contentHash?: string };
    const canonicalSnapshot = (row.canonicalDeckSnapshot ?? row.deckSnapshot) as typeof perspectiveSnapshot;
    if (!perspectiveSnapshot.player || !perspectiveSnapshot.opponent || !canonicalSnapshot.player || !canonicalSnapshot.opponent) {
      return Response.json({ ok: false, error: "Replay snapshot is incomplete" }, { status: 409 });
    }
    const actions = Array.isArray(row.actionLog) ? row.actionLog as GameAction[] : [];
    const rules = (row.engineRules as EngineRulesSnapshot | null) ?? legacyEngineRules();
    const aiRules = (row.aiRules as AiRulesSnapshot | null) ?? legacyAiRules();
    const hasImmutableRules = Boolean(row.engineRules && row.aiRules);
    const storedOptions = row.matchOptionsSnapshot && typeof row.matchOptionsSnapshot === "object"
      ? row.matchOptionsSnapshot as CustomGameOptions
      : {};

    const isPvp = row.matchMode === "ranked" || row.matchMode === "casual-pvp" || row.perspective === "host" || row.perspective === "guest";
    let opponentPlayerName = "Opponent";
    if (row.opponentPlayerId != null) {
      const [opponent] = await db.select({ name: players.name }).from(players).where(eq(players.id, row.opponentPlayerId)).limit(1);
      if (opponent?.name) opponentPlayerName = opponent.name;
    }

    const runReplay = () => {
      if (isPvp) {
        // New 2.90 rows carry an explicit canonical host/guest bundle. For legacy guest rows,
        // perspectiveSnapshot was guest/host, so reverse it to recover canonical order.
        const legacyGuest = !row.canonicalDeckSnapshot && row.perspective === "guest";
        const hostDeck = legacyGuest ? perspectiveSnapshot.opponent! : canonicalSnapshot.player!;
        const guestDeck = legacyGuest ? perspectiveSnapshot.player! : canonicalSnapshot.opponent!;
        const hostName = row.perspective === "guest" ? opponentPlayerName : row.playerName;
        const guestName = row.perspective === "guest" ? row.playerName : opponentPlayerName;
        return replayPvpMatch({ hostName, guestName, hostDeck, guestDeck, playerFirst: row.perspective === "guest" ? !row.playerFirst : row.playerFirst, seed: row.seed, actions, rules, aiRules });
      }
      return replayAuthoritativeMatch({
        playerName: row.playerName,
        playerDeck: perspectiveSnapshot.player!,
        aiDeck: perspectiveSnapshot.opponent!,
        playerGoesFirst: row.playerFirst,
        seed: row.seed,
        actions,
        customOptions: { ...storedOptions, aiDifficulty: row.aiDifficulty as CustomGameOptions["aiDifficulty"], rules, aiRules },
      });
    };
    const result = perspectiveSnapshot.cardDefs?.length ? withRegisteredCardSnapshot(perspectiveSnapshot.cardDefs, runReplay) : runReplay();

    const expectedWinner: "player" | "ai" = row.won ? "player" : "ai";
    const actualPerspectiveWinner = isPvp && row.perspective === "guest"
      ? (result.state.winner === "ai" ? "player" : result.state.winner === "player" ? "ai" : null)
      : result.state.winner;
    const finalStateHash = stateHash(result.state);
    const hashesMatch = row.actionHash === actionLogHash(actions) && row.stateHash === finalStateHash && row.integrityHash === replayIntegrity(actions, result.state);
    const consistent = result.state.phase === "gameover" && actualPerspectiveWinner === expectedWinner && result.state.round === row.rounds && hashesMatch;
    return Response.json({ ok: true, authoritative: true, consistent, hashesMatch, rulesSnapshot: hasImmutableRules, winner: actualPerspectiveWinner, rounds: result.state.round, appliedActions: result.applied, stateHash: finalStateHash, engineVersion: row.engineVersion, rulesetVersion: row.rulesetVersion, contentVersion: row.contentVersion, contentHash: row.contentHash || perspectiveSnapshot.contentHash || "", historicalSnapshot: Boolean(perspectiveSnapshot.cardDefs?.length), matchMode: row.matchMode });
  } catch (error) {
    console.error("[replays/verify] failed", error);
    return Response.json({ ok: false, error: "Replay verification failed" }, { status: 500 });
  }
}
