import {
  adaptAuthoritativeBattlefieldEvent,
  getBattlefieldPresentationDurationMs,
  type BattlefieldAuthoritativeEvent,
  type BattlefieldFxQuality,
  type BattlefieldLabScenario,
  type BattlefieldPresentationEvent,
} from "../battlefield-lab-scenario";

export type BattlefieldDemoBeat = {
  id: "fireball" | "damage" | "death" | "priority";
  event: BattlefieldPresentationEvent;
  startMs: number;
  durationMs: number;
};

export type BattlefieldDemoSequence = {
  sourceId: string;
  targetId: string;
  nextPlayerId: string;
  totalDurationMs: number;
  beats: BattlefieldDemoBeat[];
};

export function buildDeterministicBattlefieldDemoSequence(
  scenario: BattlefieldLabScenario,
  quality: BattlefieldFxQuality = "high",
): BattlefieldDemoSequence {
  const source = scenario.entities[0];
  if (!source) throw new Error("Battlefield demo requires at least one entity");

  const target = scenario.entities.find((entity) => entity.controllerId !== source.controllerId);
  if (!target) throw new Error("Battlefield demo requires an opposing entity");

  const nextPlayer = scenario.players.find((player) => player.id !== target.controllerId) ?? scenario.players[0];
  if (!nextPlayer) throw new Error("Battlefield demo requires at least one player");

  const authoritative: Array<{ id: BattlefieldDemoBeat["id"]; event: BattlefieldAuthoritativeEvent }> = [
    {
      id: "fireball",
      event: { type: "spell-resolved", spellId: "demo-fireball", sourceId: source.id, targetIds: [target.id], fxKey: "spell.fireball" },
    },
    {
      id: "damage",
      event: { type: "damage-applied", sourceId: source.id, targetId: target.id, amount: 4 },
    },
    {
      id: "death",
      event: { type: "entity-died", entityId: target.id },
    },
    {
      id: "priority",
      event: { type: "priority-changed", playerId: nextPlayer.id },
    },
  ];

  let cursor = 0;
  const beats = authoritative.map(({ id, event }) => {
    const presentationEvent = adaptAuthoritativeBattlefieldEvent(event);
    const durationMs = getBattlefieldPresentationDurationMs(presentationEvent, quality);
    const beat: BattlefieldDemoBeat = { id, event: presentationEvent, startMs: cursor, durationMs };
    cursor += durationMs;
    return beat;
  });

  return {
    sourceId: source.id,
    targetId: target.id,
    nextPlayerId: nextPlayer.id,
    totalDurationMs: cursor,
    beats,
  };
}

export function getBattlefieldDemoBeatAt(sequence: BattlefieldDemoSequence, elapsedMs: number): BattlefieldDemoBeat | null {
  const time = Math.max(0, Math.min(elapsedMs, sequence.totalDurationMs));
  return sequence.beats.find((beat) => time >= beat.startMs && time < beat.startMs + beat.durationMs) ?? null;
}
