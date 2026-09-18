import { FOUR_PLAYER_RULESET_V0, startingFourPlayerLife, type FourPlayerSeat } from "@/game/four-player-rules";
import { projectFourPlayerState, type FourPlayerRuntimeState } from "@/game/four-player-mode";

export const FOUR_PLAYER_ROOM_TTL_MS = 2 * 60 * 60 * 1000;

export function fourPlayerRulesSnapshot(oneVsOneNexusStart: number, startHand = 5) {
  return {
    rulesetId: FOUR_PLAYER_RULESET_V0.id,
    seats: FOUR_PLAYER_RULESET_V0.players,
    mainDeckCards: FOUR_PLAYER_RULESET_V0.mainDeckCards,
    generals: FOUR_PLAYER_RULESET_V0.generals,
    maxCopies: FOUR_PLAYER_RULESET_V0.maxCopies,
    nexusStart: startingFourPlayerLife(oneVsOneNexusStart),
    generalRecastTax: FOUR_PLAYER_RULESET_V0.generalRecastTax,
    firstPlayerSkipsFirstDraw: FOUR_PLAYER_RULESET_V0.firstPlayerSkipsFirstDraw,
    defaultPriority: FOUR_PLAYER_RULESET_V0.defaultPriority,
    startHand: Math.max(0, Math.trunc(startHand)),
  };
}

type RoomLike = {
  id: number;
  code: string;
  state: string;
  hostPlayerId: number;
  activeSeat: number;
  prioritySeat: number;
  turnNumber: number;
  version: number;
  winnerPlayerId: number | null;
  rulesSnapshot: unknown;
  publicState: unknown;
  runtimeState?: unknown;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
};

type SeatLike = {
  seat: number;
  playerId: number;
  playerName: string;
  deckId: number;
  deckSnapshot: unknown;
  generalDefId: string;
  ready: number;
  eliminated: number;
  nexusHealth: number;
  generalCastCount: number;
};

function deckCount(snapshot: unknown): number {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return 0;
  const cards = (snapshot as Record<string, unknown>).cards;
  return Array.isArray(cards) ? cards.length : 0;
}

export function projectFourPlayerRoom(room: RoomLike, seats: SeatLike[], viewerPlayerId?: number | null) {
  const viewerSeat = seats.find((seat) => seat.playerId === viewerPlayerId)?.seat ?? null;
  const runtime = room.runtimeState && typeof room.runtimeState === "object"
    ? projectFourPlayerState(room.runtimeState as FourPlayerRuntimeState, viewerSeat as FourPlayerSeat | null)
    : room.publicState;
  return {
    id: room.id,
    code: room.code,
    state: room.state,
    hostPlayerId: room.hostPlayerId,
    activeSeat: room.activeSeat as FourPlayerSeat,
    prioritySeat: room.prioritySeat as FourPlayerSeat,
    turnNumber: room.turnNumber,
    version: room.version,
    winnerPlayerId: room.winnerPlayerId,
    rules: room.rulesSnapshot,
    publicState: runtime,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    expiresAt: room.expiresAt,
    viewerSeat,
    seats: [...seats].sort((a, b) => a.seat - b.seat).map((seat) => ({
      seat: seat.seat as FourPlayerSeat,
      playerId: seat.playerId,
      playerName: seat.playerName,
      ready: seat.ready === 1,
      eliminated: seat.eliminated === 1,
      nexusHealth: seat.nexusHealth,
      generalDefId: seat.generalDefId,
      generalCastCount: seat.generalCastCount,
      deckId: seat.playerId === viewerPlayerId ? seat.deckId : null,
      deck: seat.playerId === viewerPlayerId ? seat.deckSnapshot : { cardCount: deckCount(seat.deckSnapshot) },
    })),
  };
}
