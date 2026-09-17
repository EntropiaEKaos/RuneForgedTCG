import type { FourPlayerSeat } from "./four-player-general";
import type { FourPlayerMatchState } from "./four-player-match";
import {
  acceptFourPlayerCommand,
  type FourPlayerClientCommand,
  type FourPlayerProtocolState,
  type FourPlayerServerEvent,
} from "./four-player-protocol";
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

/**
 * Server gate order is intentional: authenticate session/seat, validate game rules,
 * then advance the revision exactly once and emit the canonical event.
 */
export function acceptAuthoritativeFourPlayerCommand(
  state: FourPlayerAuthorityState,
  sessionId: string,
  command: FourPlayerClientCommand,
  validateRules: FourPlayerRuleValidator,
): FourPlayerAcceptedCommand {
  assertSessionControlsSeat(state.sessions, sessionId, command.seat);
  if (state.match.seats[command.seat].eliminated && command.type !== "concede") {
    throw new Error(`Eliminated seat ${command.seat} cannot issue game commands.`);
  }
  validateRules(state.match, command);
  const accepted = acceptFourPlayerCommand(state.protocol, command);
  return {
    state: { ...state, protocol: accepted.state },
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
