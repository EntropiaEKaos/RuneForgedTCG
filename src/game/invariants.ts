import type { GameState, PlayerId } from "./types";

export function assertGameStateInvariant(state: GameState): void {
  for (const pid of ["player", "ai"] as PlayerId[]) {
    const p = state.players[pid];
    if (!Number.isFinite(p.nexusHealth) || p.nexusHealth < 0) throw new Error(`Invariant: ${pid} nexus health invalid`);
    if (!Number.isFinite(p.mana) || p.mana < 0) throw new Error(`Invariant: ${pid} mana invalid`);
    if (!Number.isFinite(p.maxMana) || p.maxMana < 0) throw new Error(`Invariant: ${pid} max mana invalid`);
    const ids = [
      ...p.hand.map((x) => x.instanceId),
      ...p.bench.map((x) => x.instanceId),
      ...p.permanents.map((x) => x.instanceId),
      ...p.sentinelas.map((x) => x.instanceId),
      ...p.bench.flatMap((x) => x.equipment.map((e) => e.instanceId)),
    ];
    if (new Set(ids).size !== ids.length) throw new Error(`Invariant: duplicate instanceId for ${pid}`);
    for (const u of p.bench) {
      if (u.owner !== pid) throw new Error(`Invariant: unit owner mismatch for ${u.instanceId}`);
      if (!Number.isFinite(u.health) || !Number.isFinite(u.maxHealth) || u.maxHealth < 0 || u.health > u.maxHealth) {
        throw new Error(`Invariant: invalid unit health for ${u.instanceId}`);
      }
      if (u.equipment.length > 2) throw new Error(`Invariant: equipment cap exceeded for ${u.instanceId}`);
    }
    for (const s of p.sentinelas) {
      if (s.owner !== pid) throw new Error(`Invariant: sentinela owner mismatch for ${s.instanceId}`);
      if (!Number.isFinite(s.loyalty)) throw new Error(`Invariant: invalid sentinela loyalty for ${s.instanceId}`);
    }
  }
  if (!Number.isInteger(state.round) || state.round < 1) throw new Error("Invariant: invalid round");
  if (!Number.isInteger(state.idCounter) || state.idCounter < 0) throw new Error("Invariant: invalid id counter");
  if (!Number.isInteger(state.rngState) || state.rngState === 0) throw new Error("Invariant: invalid rng state");
  if (state.phase === "gameover" && !state.winner) throw new Error("Invariant: gameover without winner");
  if (state.phase !== "gameover" && state.winner) throw new Error("Invariant: winner before gameover");
}
