import type { FourPlayerSeat } from "./four-player-general";
import type { FourPlayerMatchState } from "./four-player-match";
import {
  acceptFourPlayerCommand,
  type FourPlayerClientCommand,
  type FourPlayerProtocolState,
  type FourPlayerServerEvent,
} from "./four-player-protocol";
import { reduceFourPlayerServerEvent } from "./four-player-reducer";
import { assertSessionControlsSeat, type FourPlayerSessionRegistry } from "./four-player-session";

export interface FourPlayerAuthorityState {
  match: FourPlayerMatchState;
  protocol: FourPlayerProtocolState;
  sessions: FourPlayerSessionRegistry;
}

export type FourPlayerRuleValidator = (
  match: FourPlayerMatchState,
  command: FourPlayerClientCommand,
) => void;

export interface FourPlayerAcceptedCommand {
  state: FourPlayerAuthorityState;
  event: FourPlayerServerEvent;
}

function assertMatchAcceptsCommand(match: FourPlayerMatchState, command: FourPlayerClientCommand): void {
  if (match.status === "completed") {
    throw new Error(`Completed match cannot accept command ${command.type}.`);
  }
  if (match.seats[command.seat].eliminated) {
    throw new Error(`Eliminated seat ${command.seat} cannot issue game commands.`);
  }
}

/**
 * Compatibility gate used by existing callers. New transports should use
 * processAuthoritativeFourPlayerCommand so session epoch, protocol revision and
 * match reduction are committed as one authoritative transaction.
 */
export function acceptAuthoritativeFourPlayerCommand(
  state: FourPlayerAuthorityState,
  sessionId: string,
  command: FourPlayerClientCommand,
  validateRules: FourPlayerRuleValidator,
): FourPlayerAcceptedCommand {
  assertSessionControlsSeat(state.sessions, sessionId, command.seat);
  assertMatchAcceptsCommand(state.match, command);
  validateRules(state.match, command);
  const accepted = acceptFourPlayerCommand(state.protocol, command);
  return {
    state: { ...state, protocol: accepted.state },
    event: accepted.event,
  };
}

/**
 * Preferred server entry point. A transport must supply the connection epoch it
 * authenticated. Stale sockets are rejected before rules or protocol state can move.
 * The canonical event is reduced before the new protocol revision is returned.
 */
export function processAuthoritativeFourPlayerCommand(
  state: FourPlayerAuthorityState,
  sessionId: string,
  connectionEpoch: number,
  command: FourPlayerClientCommand,
  validateRules: FourPlayerRuleValidator,
): FourPlayerAcceptedCommand {
  assertSessionControlsSeat(state.sessions, sessionId, command.seat, connectionEpoch);
  assertMatchAcceptsCommand(state.match, command);
  validateRules(state.match, command);
  const accepted = acceptFourPlayerCommand(state.protocol, command);
  const match = reduceFourPlayerServerEvent(state.match, accepted.event);
  return {
    state: { ...state, protocol: accepted.state, match },
    event: accepted.event,
  };
}

export function assertPriorityHolder(
  match: FourPlayerMatchState,
  seat: FourPlayerSeat,
): void {
  if (match.resolution.priority.holder !== seat) {
    throw new Error(`Seat ${seat} does not hold priority; ${match.resolution.priority.holder} does.`);
  }
}
