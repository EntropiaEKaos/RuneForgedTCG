import type { FourPlayerSeat } from "./four-player-general";

export type FourPlayerCommandType =
  | "pass_priority"
  | "submit_action"
  | "declare_attacker"
  | "declare_blocker"
  | "cast_general"
  | "end_turn"
  | "concede";

export interface FourPlayerClientCommand<TPayload = unknown> {
  commandId: string;
  matchId: string;
  seat: FourPlayerSeat;
  expectedRevision: number;
  type: FourPlayerCommandType;
  payload: TPayload;
}

export interface FourPlayerServerEvent<TPayload = unknown> {
  eventId: string;
  commandId: string;
  matchId: string;
  revision: number;
  actor: FourPlayerSeat;
  type: FourPlayerCommandType;
  payload: TPayload;
}

export interface FourPlayerProtocolState {
  matchId: string;
  revision: number;
  processedCommandIds: readonly string[];
}

export type FourPlayerCommandValidation =
  | { ok: true }
  | { ok: false; code: "wrong_match" | "stale_revision" | "duplicate_command"; message: string };

export function createFourPlayerProtocolState(matchId: string): FourPlayerProtocolState {
  if (!matchId) throw new Error("matchId is required.");
  return { matchId, revision: 0, processedCommandIds: [] };
}

export function validateFourPlayerCommand(
  state: FourPlayerProtocolState,
  command: FourPlayerClientCommand,
): FourPlayerCommandValidation {
  if (command.matchId !== state.matchId) return { ok: false, code: "wrong_match", message: "Command belongs to another match." };
  if (state.processedCommandIds.includes(command.commandId)) return { ok: false, code: "duplicate_command", message: "Command was already processed." };
  if (command.expectedRevision !== state.revision) return { ok: false, code: "stale_revision", message: `Expected revision ${state.revision}.` };
  return { ok: true };
}

/**
 * Protocol acceptance is not game-rule legality. The authoritative match reducer must
 * separately validate priority, targets, resources and timing before calling this.
 */
export function acceptFourPlayerCommand<TPayload>(
  state: FourPlayerProtocolState,
  command: FourPlayerClientCommand<TPayload>,
): { state: FourPlayerProtocolState; event: FourPlayerServerEvent<TPayload> } {
  const validation = validateFourPlayerCommand(state, command);
  if (!validation.ok) throw new Error(`${validation.code}: ${validation.message}`);
  const revision = state.revision + 1;
  return {
    state: {
      ...state,
      revision,
      processedCommandIds: [...state.processedCommandIds, command.commandId],
    },
    event: {
      eventId: `${state.matchId}:${revision}`,
      commandId: command.commandId,
      matchId: state.matchId,
      revision,
      actor: command.seat,
      type: command.type,
      payload: command.payload,
    },
  };
}
