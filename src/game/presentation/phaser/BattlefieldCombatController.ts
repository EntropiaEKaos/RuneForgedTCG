import type Phaser from "phaser";
import type { BattlefieldLabPoint, BattlefieldLabScenario } from "../battlefield-lab-scenario";
import type { BattlefieldInteractionPresentation } from "./BattlefieldInteractionPresentation";
import { describeCombatFrame } from "./BattlefieldCombatHud";
import { playDeterministicCombatSequence } from "./BattlefieldCombatSequence";

export type BattlefieldCombatController = {
  run: () => boolean;
  dispose: () => void;
  isRunning: () => boolean;
};

export function createBattlefieldCombatController(
  scene: Phaser.Scene,
  scenario: BattlefieldLabScenario,
  layout: Record<string, BattlefieldLabPoint>,
  onPresentation: (presentation: BattlefieldInteractionPresentation) => void,
  onIdle: () => void,
): BattlefieldCombatController {
  let running = false;
  let cancelSequence: (() => void) | null = null;

  return {
    run() {
      if (running) return false;
      running = true;
      cancelSequence = playDeterministicCombatSequence(scene, scenario, layout, {
        onFrame: (frame) => onPresentation(describeCombatFrame(frame)),
        onComplete: () => {
          running = false;
          cancelSequence = null;
          onIdle();
        },
      });
      return true;
    },
    dispose() {
      cancelSequence?.();
      cancelSequence = null;
      running = false;
    },
    isRunning() {
      return running;
    },
  };
}
