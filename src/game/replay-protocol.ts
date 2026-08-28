import type { GameAction } from "./reducer";
import type { GameState, PlayerId } from "./types";

export type ReplayStage = "mulligan" | "main" | "blocking" | "reaction" | "gameover";

export interface ReplayProtocolState { stage: ReplayStage; pendingReaction: boolean; }

export function deriveReplayStage(state: GameState, pendingReaction = false): ReplayProtocolState {
  if (state.phase === "gameover") return { stage: "gameover", pendingReaction: false };
  if (pendingReaction) return { stage: "reaction", pendingReaction: true };
  if (!state.mulliganDone.player) return { stage: "mulligan", pendingReaction: false };
  if (state.phase === "blocking") return { stage: "blocking", pendingReaction: false };
  return { stage: "main", pendingReaction: false };
}

/** Explicit replay FSM. Rejects structurally valid actions in impossible protocol stages. */
export function assertReplayActionAllowed(state: GameState, action: GameAction, actor: PlayerId, pendingReaction = false): void {
  const { stage } = deriveReplayStage(state, pendingReaction);
  if (stage === "gameover") throw new Error("actions after gameover are forbidden");
  if (stage === "reaction") {
    if (action.type !== "react" && action.type !== "resolve") throw new Error(`expected reaction/resolve, got ${action.type}`);
    return;
  }
  if (stage === "mulligan") {
    if (action.type !== "mulligan" && action.type !== "skipMulligan") throw new Error(`expected mulligan action, got ${action.type}`);
    return;
  }
  if (stage === "blocking") {
    if (action.type !== "block") throw new Error(`expected block action, got ${action.type}`);
    const attacker = state.combat?.attackerId;
    if (!attacker || attacker === actor) throw new Error("only defending actor can block");
    return;
  }
  if (["block", "mulligan", "skipMulligan", "resolve", "react", "aiStep"].includes(action.type)) throw new Error(`${action.type} is invalid in main stage`);
}
