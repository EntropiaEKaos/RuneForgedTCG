import { eq, inArray, sql } from "drizzle-orm";
import { matches, players, rankedMatches, rankedSeasons, replays, pvpRooms } from "@/db/schema";
import { calculateAppliedMmrResult, DEFAULT_RANKED_CALCULATION, type RankedCalculationConfig } from "@/lib/ranked";
import { actionLogHash, replayIntegrity, stateHash } from "@/lib/match-integrity";
import { ENGINE_VERSION, RULESET_VERSION } from "@/game/version";
import { CONTENT_VERSION } from "@/game/content-version";
import type { GameAction } from "@/game/reducer";
import type { GameState } from "@/game/types";
import type { DeckInput } from "@/game/types";
import { replayPvpMatch } from "@/lib/pvp-replay";
import { snapshotDeck, resolveDeck } from "@/game/deck-service";
import { orientReplayBundle, snapshotReplayBundle, verifyReplayBundle, type ReplayDeckSnapshot } from "@/game/replay-content-snapshot";
import { withRegisteredCardSnapshot } from "@/game/custom-registry";
import { verifyRankedRoomCertification, type RankedRoomCertificationSnapshot } from "@/game/ranked-decks";
import type { GameEvent } from "@/game/events";

export type SettlementTx = any;

interface SettleOptions {
  tx: SettlementTx;
  roomId: number;
  finalState: GameState | null;
  actionLog: GameAction[];
  winnerPlayerId: number;
  winnerName: string;
  isForfeit?: boolean;
}

/**
 * Atomically records both player perspectives of a PvP result and, for ranked
 * matches, applies both MMR changes in one transaction. The room row is the
 * idempotency anchor: once settled_at is set, subsequent calls are no-ops.
 */
export async function settlePvpRoom(options: SettleOptions) {
  const { tx, roomId, finalState, actionLog, winnerPlayerId, winnerName, isForfeit = false } = options;
  const [room] = await tx.select().from(pvpRooms).where(eq(pvpRooms.id, roomId)).limit(1).for("update");
  if (!room) throw new Error("PvP room not found during settlement");
  if (room.settledAt) {
    const rows = await tx.select({ id: matches.id, playerId: matches.playerId }).from(matches).where(eq(matches.matchToken, `pvp:${room.id}`));
    return { alreadySettled: true, matchIds: rows.map((r: { id: number }) => r.id) };
  }
  if (room.hostPlayerId == null || room.guestPlayerId == null) throw new Error("PvP room has no two stable player identities");

  const hostDeck = (room.hostDeckSnapshot as DeckInput | null) ?? await resolveDeck(tx, room.hostPlayerId, room.hostDeck);
  const guestDeck = (room.guestDeckSnapshot as DeckInput | null) ?? await resolveDeck(tx, room.guestPlayerId, room.guestDeck ?? "");
  const hostWon = room.hostPlayerId === winnerPlayerId;
  const matchMode = room.mode || "casual";
  const rankedSnapshot = room.rankedConfigSnapshot as (RankedCalculationConfig & RankedRoomCertificationSnapshot) | null;
  const rankedConfig: RankedCalculationConfig = rankedSnapshot ?? DEFAULT_RANKED_CALCULATION;
  const roomContentSnapshot = room.contentSnapshot as ReplayDeckSnapshot | null;
  const validRoomContentSnapshot = verifyReplayBundle(roomContentSnapshot) && roomContentSnapshot.contentHash === room.contentHash;
  if (!validRoomContentSnapshot && !isForfeit) throw new Error("PvP room is missing a valid immutable content snapshot");
  const canonicalBundle = validRoomContentSnapshot ? roomContentSnapshot : snapshotReplayBundle(hostDeck, guestDeck);
  const canonicalState = finalState ?? (room.gameState as GameState | null);
  const actionHash = actionLogHash(actionLog);
  const integrityHash = canonicalState ? replayIntegrity(actionLog, canonicalState) : null;
  const finalStateHash = canonicalState ? stateHash(canonicalState) : null;

  const playerIds = [room.hostPlayerId, room.guestPlayerId].sort((a: number, b: number) => a - b);
  for (const id of playerIds) await tx.execute(sql`SELECT id FROM players WHERE id = ${id} FOR UPDATE`);
  const lockedPlayers = await tx.select().from(players).where(inArray(players.id, playerIds));
  const playerMap = new Map<number, any>(lockedPlayers.map((p: any) => [p.id, p]));
  const host = playerMap.get(room.hostPlayerId);
  const guest = playerMap.get(room.guestPlayerId);
  if (!host || !guest) throw new Error("PvP participants no longer exist");

  let season: any = null;
  if (matchMode === "ranked") {
    if (room.rankedSeasonId == null) throw new Error("Ranked room is missing its season snapshot");
    [season] = await tx.select().from(rankedSeasons).where(eq(rankedSeasons.id, room.rankedSeasonId)).limit(1);
    if (!season) throw new Error("Ranked room references an unknown season");
    if (!rankedSnapshot || !verifyRankedRoomCertification(rankedSnapshot, hostDeck, guestDeck)) {
      throw new Error("Ranked settlement rejected a deck snapshot that does not match room certification");
    }
  }

  const perspectives = [
    { player: host, opponent: guest, ownDeck: hostDeck, opponentDeck: guestDeck, won: hostWon, first: Boolean(room.playerFirst), perspective: "host" as const },
    { player: guest, opponent: host, ownDeck: guestDeck, opponentDeck: hostDeck, won: !hostWon, first: !Boolean(room.playerFirst), perspective: "guest" as const },
  ];

  // Single authoritative re-derivation of the match outcome, matching the
  // room's ORIGINAL construction (host is always "player", guest is always
  // "ai" — see actorSide() in the PvP route). This used to be done twice,
  // once per perspective, with the second replay swapping which deck was
  // passed as "player" vs "ai" to reuse replayPvpMatch's fixed host/guest
  // signature. That swap is unsound: createGame always draws RNG for the
  // "player" deck's shuffle before the "ai" deck's shuffle, so swapping
  // which real deck occupies which slot changes the actual cards each side
  // draws, even with an identical seed — the swapped replay diverges from
  // the real game from the very first draw and (empirically verified, by
  // driving a full match through the production AI and replaying it both
  // ways) either throws "Rejected/Unauthorized action" or reports a wrong
  // winner. Since settlement runs inside the same transaction as the
  // pvpRooms update, that exception rolled back the ENTIRE settlement —
  // including the winning move itself — for every non-forfeit PvP match.
  // One canonical replay (matching the real construction) is sufficient:
  // its `winner` directly tells us who actually won, no swap needed, and
  // both perspectives reuse the same result.
  let canonicalReplay: { state: GameState; events: GameEvent[] } | null = null;
  if (!isForfeit && canonicalState) {
    const replay = withRegisteredCardSnapshot(canonicalBundle.cardDefs, () => replayPvpMatch({
      hostName: room.hostName,
      guestName: room.guestName!,
      hostDeck,
      guestDeck,
      playerFirst: Boolean(room.playerFirst),
      seed: room.seed ?? canonicalState.seed,
      actions: actionLog,
      rules: canonicalState.rules,
      aiRules: canonicalState.aiRules,
    }));
    const replayHostWon = replay.state.winner === "player";
    if (
      replay.state.phase !== "gameover" ||
      replay.state.round !== canonicalState.round ||
      replayHostWon !== hostWon
    ) {
      throw new Error("PvP settlement replay verification failed");
    }
    canonicalReplay = replay;
  }

  const insertedMatchIds: number[] = [];
  for (const perspective of perspectives) {
    const token = `pvp:${room.id}`;
    let perspectiveActionHash = actionHash;
    let perspectiveStateHash = finalStateHash;
    let perspectiveIntegrityHash = integrityHash;
    let perspectiveRounds = canonicalState?.round ?? 0;
    let perspectiveNexus = canonicalState?.players?.[perspective.perspective === "host" ? "player" : "ai"]?.nexusHealth ?? 0;
    const replayActions: GameAction[] = actionLog;
    let replayEvents = room.eventLog ?? [];

    if (!isForfeit && canonicalState && canonicalReplay) {
      const replayActionHash = actionLogHash(actionLog);
      const replayStateHash = stateHash(canonicalReplay.state);
      const replayIntegrityHash = replayIntegrity(actionLog, canonicalReplay.state);
      perspectiveActionHash = replayActionHash;
      perspectiveStateHash = replayStateHash;
      perspectiveIntegrityHash = replayIntegrityHash;
      perspectiveRounds = canonicalReplay.state.round;
      // Each perspective's own nexus reading — host is always "player",
      // guest is always "ai" in the canonical (unswapped) replay.
      perspectiveNexus = canonicalReplay.state.players[perspective.perspective === "host" ? "player" : "ai"].nexusHealth;
      replayEvents = canonicalReplay.events;
      await tx.insert(replays).values({
        playerName: perspective.player.name, playerId: perspective.player.id,
        deckName: perspective.ownDeck.name, deckId: perspective.ownDeck.id,
        aiDeckName: perspective.opponentDeck.name, aiDeckId: perspective.opponentDeck.id,
        won: perspective.won, rounds: canonicalReplay.state.round, playerFirst: perspective.first,
        seed: room.seed ?? canonicalReplay.state.seed, log: JSON.stringify(canonicalReplay.state.log),
        actionLog, eventLog: canonicalReplay.events, actionHash: replayActionHash,
        stateHash: replayStateHash, integrityHash: replayIntegrityHash,
        deckSnapshot: orientReplayBundle(canonicalBundle, perspective.ownDeck, perspective.opponentDeck),
        canonicalDeckSnapshot: canonicalBundle,
        contentHash: canonicalBundle.contentHash,
        engineVersion: ENGINE_VERSION, rulesetVersion: RULESET_VERSION, contentVersion: CONTENT_VERSION, matchMode,
        opponentPlayerId: perspective.opponent.id, perspective: perspective.perspective,
        engineRules: canonicalReplay.state.rules, aiRules: canonicalReplay.state.aiRules,
        matchOptionsSnapshot: { playerGoesFirst: Boolean(room.playerFirst), rankedSeasonId: room.rankedSeasonId ?? null, rankedRulesVersion: matchMode === "ranked" ? rankedSnapshot?.rulesVersion ?? null : null, rankedDeckPoolVersion: matchMode === "ranked" ? rankedSnapshot?.deckPoolVersion ?? null : null },
      });
    }

    const [match] = await tx.insert(matches).values({
      playerName: perspective.player.name,
      playerId: perspective.player.id,
      opponentPlayerId: perspective.opponent.id,
      deckId: perspective.ownDeck.id,
      deckName: perspective.ownDeck.name,
      won: perspective.won,
      rounds: perspectiveRounds,
      nexusRemaining: perspectiveNexus,
      matchToken: token,
      matchMode,
      seed: room.seed,
      playerFirst: perspective.first,
      aiDeckId: perspective.opponentDeck.id,
      aiDeckName: perspective.opponentDeck.name,
      actionLog: replayActions,
      eventLog: replayEvents,
      actionHash: perspectiveActionHash,
      stateHash: perspectiveStateHash,
      integrityHash: perspectiveIntegrityHash,
      deckSnapshot: orientReplayBundle(canonicalBundle, perspective.ownDeck, perspective.opponentDeck),
      contentHash: canonicalBundle.contentHash,
      engineRules: canonicalState?.rules ?? null,
      aiRules: canonicalState?.aiRules ?? null,
    }).returning({ id: matches.id });
    insertedMatchIds.push(match.id);
  }

  if (matchMode === "ranked") {
    for (const perspective of perspectives) {
      const opponentMmr = perspective.opponent.mmr;
      const inPlacement = perspective.player.rankedGamesInPlacement > 0;
      const { mmrChange, mmrAfter: newMmr } = calculateAppliedMmrResult(
        perspective.player.mmr, opponentMmr, perspective.won, inPlacement, rankedConfig,
      );
      await tx.update(players).set({
        mmr: newMmr,
        peakMmr: Math.max(perspective.player.peakMmr, newMmr),
        rankedWins: sql`${players.rankedWins} + ${perspective.won ? 1 : 0}`,
        rankedLosses: sql`${players.rankedLosses} + ${perspective.won ? 0 : 1}`,
        rankedGamesInPlacement: sql`GREATEST(0, ${players.rankedGamesInPlacement} - 1)`,
      }).where(eq(players.id, perspective.player.id));
      await tx.insert(rankedMatches).values({
        playerId: perspective.player.id,
        matchId: insertedMatchIds[perspective.perspective === "host" ? 0 : 1],
        opponentName: perspective.opponent.name,
        won: perspective.won,
        mmrChange,
        mmrBefore: perspective.player.mmr,
        mmrAfter: newMmr,
        seasonId: season?.id ?? null,
        rulesVersion: rankedSnapshot?.rulesVersion ?? null,
        deckPoolVersion: rankedSnapshot?.deckPoolVersion ?? null,
      });
    }
  }

  await tx.update(pvpRooms).set({ settledAt: new Date(), expiresAt: new Date(Date.now() + 24 * 60 * 60_000) }).where(eq(pvpRooms.id, room.id));
  return { alreadySettled: false, matchIds: insertedMatchIds };
}
