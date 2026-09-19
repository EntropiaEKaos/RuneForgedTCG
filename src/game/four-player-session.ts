import type { FourPlayerSeat } from "./four-player-general";

export interface FourPlayerSeatSession {
  sessionId: string;
  seat: FourPlayerSeat;
  connected: boolean;
  connectionEpoch: number;
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
  const reserved = registry.sessions.find((session) => session.seat === seat && session.sessionId !== sessionId);
  if (reserved) throw new Error(`Seat ${seat} is reserved by another session.`);
  if (existingSession) {
    return {
      sessions: registry.sessions.map((session) => session.sessionId === sessionId
        ? { ...session, connected: true, connectionEpoch: session.connected ? session.connectionEpoch : session.connectionEpoch + 1 }
        : session),
    };
  }
  return { sessions: [...registry.sessions, { sessionId, seat, connected: true, connectionEpoch: 1 }] };
}

export function assertSessionControlsSeat(
  registry: FourPlayerSessionRegistry,
  sessionId: string,
  seat: FourPlayerSeat,
  connectionEpoch?: number,
): void {
  const session = registry.sessions.find((entry) => entry.sessionId === sessionId && entry.connected);
  if (!session || session.seat !== seat) throw new Error(`Session ${sessionId} does not control seat ${seat}.`);
  if (connectionEpoch !== undefined && session.connectionEpoch !== connectionEpoch) {
    throw new Error(`Stale connection epoch ${connectionEpoch}; current epoch is ${session.connectionEpoch}.`);
  }
}

export function disconnectFourPlayerSession(
  registry: FourPlayerSessionRegistry,
  sessionId: string,
): FourPlayerSessionRegistry {
  return { sessions: registry.sessions.map((session) => session.sessionId === sessionId ? { ...session, connected: false } : session) };
}

export function sessionForSeat(registry: FourPlayerSessionRegistry, seat: FourPlayerSeat): FourPlayerSeatSession | undefined {
  return registry.sessions.find((session) => session.seat === seat);
}
