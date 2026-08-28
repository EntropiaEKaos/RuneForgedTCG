import crypto from "node:crypto";
import type { GameAction } from "@/game/reducer";
import type { GameState } from "@/game/types";

export function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.keys(value as Record<string, unknown>).sort().map((k) => `${JSON.stringify(k)}:${stableJson((value as Record<string, unknown>)[k])}`).join(",")}}`;
}

export function stateHash(state: GameState): string {
  return crypto.createHash("sha256").update(stableJson(state)).digest("hex");
}

export function actionHash(previousHash: string, action: GameAction, stateAfter: GameState): string {
  return crypto.createHash("sha256").update(`${previousHash}|${stableJson(action)}|${stateHash(stateAfter)}`).digest("hex");
}

export function replayIntegrity(actions: GameAction[], finalState: GameState, initialHash = "GENESIS"): string {
  let hash = initialHash;
  // The final state is part of the chain; individual transitions are chained by the authoritative runner.
  for (const action of actions) hash = crypto.createHash("sha256").update(`${hash}|${stableJson(action)}`).digest("hex");
  return crypto.createHash("sha256").update(`${hash}|${stateHash(finalState)}`).digest("hex");
}

export function actionLogHash(actions: GameAction[]): string {
  let hash = "GENESIS";
  for (const action of actions) hash = crypto.createHash("sha256").update(`${hash}|${stableJson(action)}`).digest("hex");
  return hash;
}
