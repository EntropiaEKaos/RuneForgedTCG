import type { FourPlayerSeat } from "./four-player-general";

export interface FourPlayerSeatSession {
  sessionId: string;
  seat: FourPlayerSeat;
  connected: boolean;
}

export interface FourPlayerSessionRegistry {
  sessions: readonly FourPlayerSeatSession[];
}

export function createFourPlayerSessionRegistry(): FourPlayerSessionRegistry {
  return { sessions: [] };
}

export function bindFourPlayerSession(
  registry: FourPlayerSessionRegistry,
  sessionId: string,
  seat: FourPlayerSeat,
): FourPlayerSessionRegistry {
  if (!sessionId) throw new Error("sessionId is required.");
  const existingSession = registry.sessions.find((session) => session.sessionId === sessionId);
  if (existingSession && existingSession.seat !== seat) throw new Error(`Session ${sessionId} is already bound to ${existingSession.seat}.`);
  const occupied = registry.sessions.find((session) => session.connected && session.seat === seat && session.sessionId !== sessionId);
  if (occupied) throw new Error(`Seat ${seat} is already occupied.`);
  if (existingSession) {
    return { sessions: registry.sessions.map((session) => session.sessionId === sessionId ? { ...session, connected: true } : session) };
  }
  return { sessions: [...registry.sessions, { sessionId, seat, connected: true }] };
}

export function assertSessionControlsSeat(
  registry: FourPlayerSessionRegistry,
  sessionId: string,
  seat: FourPlayerSeat,
): void {
  const session = registry.sessions.find((entry) => entry.sessionId === sessionId && entry.connected);
  if (!session || session.seat !== seat) throw new Error(`Session ${sessionId} does not control seat ${seat}.`);
}

export function disconnectFourPlayerSession(
  registry: FourPlayerSessionRegistry,
  sessionId: string,
): FourPlayerSessionRegistry {
  return {
    sessions: registry.sessions.map((session) => session.sessionId === sessionId ? { ...session, connected: false } : session),
  };
}
