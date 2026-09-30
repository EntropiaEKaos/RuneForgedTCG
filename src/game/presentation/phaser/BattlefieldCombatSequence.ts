import type Phaser from "phaser";
import type { BattlefieldLabPoint, BattlefieldLabScenario } from "../battlefield-lab-scenario";
import { buildDeterministicCombatTimeline, type BattlefieldCombatPresentationFrame } from "./BattlefieldCombatPresentation";
import { playCombatLaneFx } from "./BattlefieldCombatFx";

export type BattlefieldCombatSequenceOptions = {
  stepMs?: number;
  onFrame?: (frame: BattlefieldCombatPresentationFrame) => void;
  onComplete?: () => void;
};

export function playDeterministicCombatSequence(
  scene: Phaser.Scene,
  scenario: BattlefieldLabScenario,
  layout: Record<string, BattlefieldLabPoint>,
  options: BattlefieldCombatSequenceOptions = {},
) {
  const timeline = buildDeterministicCombatTimeline(scenario);
  const stepMs = options.stepMs ?? 760;
  const timers: Phaser.Time.TimerEvent[] = [];

  timeline.forEach((frame, index) => {
    timers.push(scene.time.delayedCall(index * stepMs, () => {
      options.onFrame?.(frame);

      if (frame.phase === "attackers") {
        const defender = scenario.players[1];
        const defenderEntity = defender ? scenario.entities.find((entity) => entity.controllerId === defender.id) : undefined;
        const defenderPoint = defenderEntity ? layout[defenderEntity.id] : undefined;
        if (!defenderPoint) return;
        frame.attackerIds.forEach((attackerId) => {
          const attackerPoint = layout[attackerId];
          if (attackerPoint) playCombatLaneFx(scene, attackerPoint, defenderPoint, "attackers");
        });
        return;
      }

      if (frame.phase === "blockers" || frame.phase === "damage") {
        frame.blockerPairs.forEach(({ attackerId, blockerId }) => {
          const attackerPoint = layout[attackerId];
          const blockerPoint = layout[blockerId];
          if (attackerPoint && blockerPoint) playCombatLaneFx(scene, attackerPoint, blockerPoint, frame.phase);
        });
      }
    }));
  });

  timers.push(scene.time.delayedCall(timeline.length * stepMs, () => options.onComplete?.()));
  return () => timers.forEach((timer) => timer.remove(false));
}
