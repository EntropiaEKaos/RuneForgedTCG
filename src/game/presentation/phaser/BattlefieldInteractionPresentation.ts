import type { BattlefieldLabScenario, BattlefieldPresentationEvent } from "../battlefield-lab-scenario";

export type BattlefieldInteractionPhase = "idle" | "targeting" | "combat" | "reaction" | "resolving";

export type BattlefieldInteractionPresentation = {
  phase: BattlefieldInteractionPhase;
  headline: string;
  detail: string;
  accent: "slate" | "cyan" | "orange" | "violet" | "rose";
  sourceId?: string;
  targetIds?: string[];
  playerId?: string;
};

export function describeBattlefieldPresentationEvent(
  event: BattlefieldPresentationEvent,
  scenario: BattlefieldLabScenario,
): BattlefieldInteractionPresentation {
  if (event.type === "fx") {
    return {
      phase: "resolving",
      headline: event.cue === "spell.fireball" ? "SPELL RESOLVING" : "EFFECT RESOLVING",
      detail: event.cue,
      accent: event.cue === "spell.fireball" ? "orange" : "violet",
      sourceId: event.sourceId,
      targetIds: event.targetIds,
    };
  }
  if (event.type === "damage") {
    return { phase: "combat", headline: "DAMAGE", detail: `${event.amount} damage`, accent: "rose", sourceId: event.sourceId, targetIds: [event.targetId] };
  }
  if (event.type === "death") {
    return { phase: "resolving", headline: "ENTITY DEFEATED", detail: event.entityId, accent: "slate", targetIds: [event.entityId] };
  }
  if (event.type === "priority") {
    const player = scenario.players.find((candidate) => candidate.id === event.playerId);
    return { phase: "reaction", headline: "REACTION WINDOW", detail: `${player?.label ?? event.playerId} has priority`, accent: "cyan", playerId: event.playerId };
  }
  return { phase: "idle", headline: "BATTLEFIELD", detail: "Awaiting authoritative event", accent: "slate" };
}

export function describeTargetingPresentation(sourceId: string, targetId: string, relation: "friendly" | "opponent"): BattlefieldInteractionPresentation {
  return {
    phase: "targeting",
    headline: relation === "opponent" ? "HOSTILE TARGET" : "FRIENDLY TARGET",
    detail: `${sourceId} → ${targetId}`,
    accent: relation === "opponent" ? "rose" : "cyan",
    sourceId,
    targetIds: [targetId],
  };
}

export function describeCombatPresentation(attackerId: string, blockerId: string): BattlefieldInteractionPresentation {
  return { phase: "combat", headline: "COMBAT PREVIEW", detail: `${attackerId} → ${blockerId}`, accent: "orange", sourceId: attackerId, targetIds: [blockerId] };
}
