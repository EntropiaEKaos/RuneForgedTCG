import type Phaser from "phaser";
import { buildBattlefieldFxExecutionPlan, type BattlefieldFxQuality, type BattlefieldLabPoint, type BattlefieldPresentationEvent } from "../battlefield-lab-scenario";

export type BattlefieldFxLayout = Record<string, BattlefieldLabPoint>;

export function playBattlefieldFx(
  scene: Phaser.Scene,
  layout: BattlefieldFxLayout,
  cue: string,
  sourceId: string,
  targetId: string,
  quality: BattlefieldFxQuality = "high",
): boolean {
  const source = layout[sourceId];
  const target = layout[targetId];
  if (!source || !target) return false;

  const plan = buildBattlefieldFxExecutionPlan(cue, quality);
  plan.primitives.forEach((primitive, index) => {
    if (primitive.type === "projectile") {
      const orb = scene.add.circle(source.x, source.y, cue === "spell.fireball" ? 9 : 6, cue === "spell.fireball" ? 0xff7a18 : 0x67e8f9, 1).setDepth(30);
      scene.tweens.add({ targets: orb, x: target.x, y: target.y, duration: primitive.durationMs, ease: "Sine.easeIn", onComplete: () => orb.destroy() });
      return;
    }
    if (primitive.type === "beam") {
      const beam = scene.add.line(0, 0, source.x, source.y, target.x, target.y, 0x7dd3fc, 1).setOrigin(0, 0).setLineWidth(2 + Math.min(primitive.branches, 4)).setDepth(29);
      scene.time.delayedCall(primitive.durationMs, () => beam.destroy());
      return;
    }
    if (primitive.type === "impact") {
      const impact = scene.add.circle(target.x, target.y, 4, cue === "spell.fireball" ? 0xf97316 : 0xa5f3fc, 0.85).setDepth(31);
      scene.tweens.add({ targets: impact, scale: Math.max(2, primitive.radius / 4), alpha: 0, duration: primitive.durationMs, onComplete: () => impact.destroy() });
      return;
    }
    for (let i = 0; i < Math.min(primitive.count, 40); i += 1) {
      const spark = scene.add.circle(target.x, target.y, 1.5, cue === "spell.fireball" ? 0xfbbf24 : 0xe0f2fe, 0.9).setDepth(32);
      const angle = (Math.PI * 2 * i) / Math.max(1, primitive.count);
      scene.tweens.add({
        targets: spark,
        x: target.x + Math.cos(angle) * 32,
        y: target.y + Math.sin(angle) * 32,
        alpha: 0,
        duration: primitive.durationMs + index * 20,
        onComplete: () => spark.destroy(),
      });
    }
  });
  return true;
}


export function playBattlefieldPresentationEvent(
  scene: Phaser.Scene,
  layout: BattlefieldFxLayout,
  event: BattlefieldPresentationEvent,
  quality: BattlefieldFxQuality = "high",
): boolean {
  if (event.type !== "fx" || !event.sourceId || event.targetIds.length === 0) return false;
  let played = false;
  event.targetIds.forEach((targetId) => {
    played = playBattlefieldFx(scene, layout, event.cue, event.sourceId!, targetId, quality) || played;
  });
  return played;
}
