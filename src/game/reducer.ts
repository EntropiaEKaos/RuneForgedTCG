/**
 * Public reducer facade. The authoritative implementation lives in
 * reducer-core.ts so every action — including the backwards-compatible
 * `sentinela` opcode with optional modal `modeId` — passes through the same
 * gameover, runtime override and action-allowlist gates.
 */
export { applyGameAction, simulateMatch } from "./reducer-core";
export type { ActionResult, GameAction } from "./reducer-core";
