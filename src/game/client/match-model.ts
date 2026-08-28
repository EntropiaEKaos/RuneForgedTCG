import type { CardAction } from "../engine";
import type { GameAction } from "../reducer";
import type { GameState, PlayerId, TargetKind, UnitInstance } from "../types";

export interface PendingSpell {
  instanceId: string;
  defId: string;
  targetType: TargetKind;
}

export interface ReactionPending {
  action: CardAction;
  baseState: GameState;
  deadline: number;
  pendingHuman?: CardAction | null;
}

export type PvpConnectionState = "offline" | "connecting" | "synced" | "sending" | "retrying" | "conflict";

export function topOfReactionStack(reaction: ReactionPending | null): CardAction | null {
  return reaction?.pendingHuman ?? reaction?.action ?? null;
}

export function boardEntityName(state: GameState, id?: string): string | null {
  if (!id) return null;
  for (const playerId of ["player", "ai"] as PlayerId[]) {
    const unit = state.players[playerId].bench.find((entry) => entry.instanceId === id);
    if (unit) return unit.defId;
    const permanent = state.players[playerId].permanents.find((entry) => entry.instanceId === id);
    if (permanent) return permanent.defId;
    const sentinela = state.players[playerId].sentinelas.find((entry) => entry.instanceId === id);
    if (sentinela) return sentinela.defId;
  }
  return null;
}

export function canonicalizeGuestAction(action: GameAction, guest: boolean): GameAction {
  if (!guest || !("player" in action)) return action;
  return { ...action, player: action.player === "player" ? "ai" : "player" } as GameAction;
}

function combatDamage(power: number, target?: UnitInstance): number {
  if (!target) return Math.max(0, power);
  if (target.barrier) return 0;
  return Math.max(0, power - (target.keywords.includes("Tough") ? 1 : 0));
}

export interface CombatPreview {
  nexusDamage: number;
  attackerDeaths: number;
  blockerDeaths: number;
  unblocked: number;
}

export interface CombatLanePreview {
  attackerDamage: number;
  blockerDamage: number;
  nexusDamage: number;
  attackerFalls: boolean;
  blockerFalls: boolean;
  outcome: "unblocked" | "trade" | "favorable" | "danger" | "clash";
}

export function previewCombatLane(attacker: UnitInstance, blocker?: UnitInstance): CombatLanePreview {
  if (!blocker) return { attackerDamage: 0, blockerDamage: 0, nexusDamage: Math.max(0, attacker.power), attackerFalls: false, blockerFalls: false, outcome: "unblocked" };
  const attackerDamage = combatDamage(blocker.power, attacker);
  const blockerDamage = combatDamage(attacker.power, blocker);
  const attackerFalls = attackerDamage >= attacker.health || (blocker.keywords.includes("Deathtouch") && attackerDamage > 0);
  const blockerFalls = blockerDamage >= blocker.health || (attacker.keywords.includes("Deathtouch") && blockerDamage > 0);
  const nexusDamage = attacker.keywords.includes("Overwhelm") ? Math.max(0, blockerDamage - blocker.health) : 0;
  const outcome = attackerFalls && blockerFalls ? "trade" : blockerFalls ? "favorable" : attackerFalls ? "danger" : "clash";
  return { attackerDamage, blockerDamage, nexusDamage, attackerFalls, blockerFalls, outcome };
}

/** Read-only estimate for UI communication; the engine remains authoritative. */
export function previewCombat(state: GameState, blocks: Record<string, string>): CombatPreview {
  if (!state.combat) return { nexusDamage: 0, attackerDeaths: 0, blockerDeaths: 0, unblocked: 0 };
  const attackerId = state.combat.attackerId;
  const defenderId: PlayerId = attackerId === "player" ? "ai" : "player";
  const attackers = state.players[attackerId].bench.filter((unit) => unit.isAttacking);
  let nexusDamage = 0;
  let attackerDeaths = 0;
  let blockerDeaths = 0;
  let unblocked = 0;
  for (const attacker of attackers) {
    const blockerId = blocks[attacker.instanceId];
    const blocker = blockerId ? state.players[defenderId].bench.find((unit) => unit.instanceId === blockerId) : undefined;
    if (!blocker) {
      if (!state.combat.sentinelaTargets[attacker.instanceId]) nexusDamage += Math.max(0, attacker.power);
      unblocked += 1;
      continue;
    }
    const lane = previewCombatLane(attacker, blocker);
    if (lane.blockerFalls) blockerDeaths += 1;
    if (lane.attackerFalls) attackerDeaths += 1;
    nexusDamage += lane.nexusDamage;
  }
  return { nexusDamage, attackerDeaths, blockerDeaths, unblocked };
}
