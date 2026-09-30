import type Phaser from "phaser";
import { buildBattlefieldFxExecutionPlan, type BattlefieldFxQuality, type BattlefieldLabPoint, type BattlefieldPresentationEvent } from "../battlefield-lab-scenario";

export type BattlefieldFxLayout = Record<string, BattlefieldLabPoint>;

function flashCamera(scene: Phaser.Scene, color: { r: number; g: number; b: number }, duration = 90, alpha = 0.18) {
  scene.cameras.main.flash(duration, color.r, color.g, color.b, false, undefined, undefined, alpha);
}

function spawnRadialSparks(scene: Phaser.Scene, x: number, y: number, color: number, count: number, radius: number, duration: number, depth = 38) {
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / Math.max(1, count) + (i % 3) * 0.09;
    const distance = radius * (0.55 + ((i * 17) % 45) / 100);
    const spark = scene.add.circle(x, y, i % 4 === 0 ? 2.2 : 1.35, color, 0.95).setDepth(depth);
    scene.tweens.add({
      targets: spark,
      x: x + Math.cos(angle) * distance,
      y: y + Math.sin(angle) * distance,
      scale: 0.2,
      alpha: 0,
      duration: duration + (i % 5) * 24,
      ease: "Cubic.easeOut",
      onComplete: () => spark.destroy(),
    });
  }
}

function playFireball(scene: Phaser.Scene, source: BattlefieldLabPoint, target: BattlefieldLabPoint, durationMs: number, quality: BattlefieldFxQuality) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const nx = -dy / distance;
  const ny = dx / distance;
  const high = quality === "high";

  const trailCount = high ? 12 : quality === "medium" ? 8 : 5;
  for (let i = 0; i < trailCount; i += 1) {
    const t = i / trailCount;
    const trail = scene.add.circle(source.x, source.y, Math.max(2, 8 - i * 0.42), i % 3 === 0 ? 0xfbbf24 : 0xf97316, 0.5 - t * 0.25).setDepth(30 - i * 0.01);
    scene.tweens.add({
      targets: trail,
      x: target.x - dx * t * 0.13 + nx * Math.sin(i * 1.7) * 5,
      y: target.y - dy * t * 0.13 + ny * Math.sin(i * 1.7) * 5,
      alpha: 0,
      scale: 0.35,
      duration: durationMs + i * 18,
      ease: "Sine.easeIn",
      onComplete: () => trail.destroy(),
    });
  }

  const halo = scene.add.circle(source.x, source.y, 16, 0xff3d00, 0.18).setDepth(31);
  const shell = scene.add.circle(source.x, source.y, 10, 0xff6d00, 0.92).setStrokeStyle(3, 0xffd54f, 0.9).setDepth(33);
  const core = scene.add.circle(source.x, source.y, 5, 0xfff7d6, 1).setDepth(34);
  scene.tweens.add({ targets: halo, x: target.x, y: target.y, scale: 1.45, duration: durationMs, ease: "Cubic.easeIn", onComplete: () => halo.destroy() });
  scene.tweens.add({ targets: shell, x: target.x, y: target.y, angle: 180, duration: durationMs, ease: "Cubic.easeIn", onComplete: () => shell.destroy() });
  scene.tweens.add({
    targets: core,
    x: target.x,
    y: target.y,
    duration: durationMs,
    ease: "Cubic.easeIn",
    onComplete: () => {
      core.destroy();
      flashCamera(scene, { r: 255, g: 117, b: 26 }, 110, 0.22);
      scene.cameras.main.shake(high ? 150 : 95, high ? 0.006 : 0.0035);
      const shock = scene.add.circle(target.x, target.y, 8, 0xff8a00, 0.2).setStrokeStyle(high ? 5 : 3, 0xffc107, 0.95).setDepth(42);
      const coreBurst = scene.add.circle(target.x, target.y, 6, 0xfff4d6, 0.95).setDepth(43);
      scene.tweens.add({ targets: shock, scale: high ? 8 : 5, alpha: 0, duration: 420, ease: "Cubic.easeOut", onComplete: () => shock.destroy() });
      scene.tweens.add({ targets: coreBurst, scale: high ? 4 : 3, alpha: 0, duration: 220, ease: "Quad.easeOut", onComplete: () => coreBurst.destroy() });
      spawnRadialSparks(scene, target.x, target.y, 0xfbbf24, high ? 30 : 16, high ? 74 : 48, 330, 44);
      spawnRadialSparks(scene, target.x, target.y, 0xf97316, high ? 18 : 10, high ? 58 : 38, 430, 41);
    },
  });
}

function playLightning(scene: Phaser.Scene, source: BattlefieldLabPoint, target: BattlefieldLabPoint, durationMs: number, branches: number) {
  const segments = Math.max(5, Math.min(12, branches * 2 + 4));
  const points: Phaser.Math.Vector2[] = [];
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const jitter = i === 0 || i === segments ? 0 : ((i * 37) % 17 - 8) * 1.6;
    points.push(new Phaser.Math.Vector2(source.x + (target.x - source.x) * t + jitter, source.y + (target.y - source.y) * t - jitter * 0.55));
  }
  const graphics = scene.add.graphics().setDepth(39);
  graphics.lineStyle(7, 0x38bdf8, 0.16).beginPath().moveTo(points[0]!.x, points[0]!.y);
  points.slice(1).forEach((point) => graphics.lineTo(point.x, point.y)); graphics.strokePath();
  graphics.lineStyle(3, 0x7dd3fc, 0.9).beginPath().moveTo(points[0]!.x, points[0]!.y);
  points.slice(1).forEach((point) => graphics.lineTo(point.x, point.y)); graphics.strokePath();
  graphics.lineStyle(1, 0xffffff, 1).beginPath().moveTo(points[0]!.x, points[0]!.y);
  points.slice(1).forEach((point) => graphics.lineTo(point.x, point.y)); graphics.strokePath();
  flashCamera(scene, { r: 125, g: 211, b: 252 }, 70, 0.12);
  spawnRadialSparks(scene, target.x, target.y, 0xbae6fd, Math.min(24, branches * 4 + 8), 46, 250, 42);
  scene.tweens.add({ targets: graphics, alpha: 0, duration: durationMs, ease: "Quad.easeOut", onComplete: () => graphics.destroy() });
}

export function playBattlefieldFx(scene: Phaser.Scene, layout: BattlefieldFxLayout, cue: string, sourceId: string, targetId: string, quality: BattlefieldFxQuality = "high"): boolean {
  const source = layout[sourceId];
  const target = layout[targetId];
  if (!source || !target) return false;

  const plan = buildBattlefieldFxExecutionPlan(cue, quality);
  let projectileHandled = false;
  plan.primitives.forEach((primitive, index) => {
    if (primitive.type === "projectile") {
      if (cue === "spell.fireball") playFireball(scene, source, target, primitive.durationMs, quality);
      else {
        const orb = scene.add.circle(source.x, source.y, 6, 0x67e8f9, 1).setDepth(30);
        scene.tweens.add({ targets: orb, x: target.x, y: target.y, duration: primitive.durationMs, ease: "Sine.easeIn", onComplete: () => orb.destroy() });
      }
      projectileHandled = true;
      return;
    }
    if (primitive.type === "beam") {
      playLightning(scene, source, target, primitive.durationMs, primitive.branches);
      return;
    }
    if (primitive.type === "impact") {
      if (cue === "spell.fireball" && projectileHandled) return;
      const impact = scene.add.circle(target.x, target.y, 4, cue === "spell.fireball" ? 0xf97316 : 0xa5f3fc, 0.85).setDepth(31);
      scene.tweens.add({ targets: impact, scale: Math.max(2, primitive.radius / 4), alpha: 0, duration: primitive.durationMs, onComplete: () => impact.destroy() });
      return;
    }
    spawnRadialSparks(scene, target.x, target.y, cue === "spell.fireball" ? 0xfbbf24 : 0xe0f2fe, Math.min(primitive.count, 40), 32, primitive.durationMs + index * 20, 32);
  });
  return true;
}

export function playBattlefieldPresentationEvent(scene: Phaser.Scene, layout: BattlefieldFxLayout, event: BattlefieldPresentationEvent, quality: BattlefieldFxQuality = "high"): boolean {
  if (event.type === "fx") {
    if (!event.sourceId || event.targetIds.length === 0) return false;
    let played = false;
    event.targetIds.forEach((targetId) => { played = playBattlefieldFx(scene, layout, event.cue, event.sourceId!, targetId, quality) || played; });
    return played;
  }

  if (event.type === "damage") {
    const target = layout[event.targetId];
    if (!target) return false;
    flashCamera(scene, { r: 239, g: 68, b: 68 }, 65, 0.07);
    const label = scene.add.text(target.x, target.y - 12, `-${event.amount}`, { fontFamily: "system-ui", fontSize: "24px", fontStyle: "bold", color: "#fff1f2", stroke: "#7f1d1d", strokeThickness: 5 }).setOrigin(0.5).setDepth(45);
    const hit = scene.add.circle(target.x, target.y, 9, 0xef4444, 0.15).setStrokeStyle(3, 0xfca5a5, 0.9).setDepth(43);
    scene.tweens.add({ targets: hit, scale: 3.2, alpha: 0, duration: 320, onComplete: () => hit.destroy() });
    scene.tweens.add({ targets: label, y: target.y - 58, alpha: 0, scale: 1.35, duration: 560, ease: "Cubic.easeOut", onComplete: () => label.destroy() });
    return true;
  }

  if (event.type === "death") {
    const target = layout[event.entityId];
    if (!target) return false;
    const ring = scene.add.circle(target.x, target.y, 8, 0x0f172a, 0.2).setStrokeStyle(4, 0xe2e8f0, 0.9).setDepth(44);
    const voidCore = scene.add.circle(target.x, target.y, 12, 0x020617, 0.75).setDepth(43);
    spawnRadialSparks(scene, target.x, target.y, 0xcbd5e1, quality === "high" ? 22 : 12, 55, 500, 45);
    scene.tweens.add({ targets: voidCore, scale: 0.15, alpha: 0, duration: 520, ease: "Back.easeIn", onComplete: () => voidCore.destroy() });
    scene.tweens.add({ targets: ring, scale: 5.2, alpha: 0, duration: 680, ease: "Sine.easeOut", onComplete: () => ring.destroy() });
    return true;
  }

  if (event.type === "priority") {
    const banner = scene.add.text(scene.scale.width / 2, 42, `PRIORITY · ${event.playerId.toUpperCase()}`, { fontFamily: "system-ui", fontSize: "14px", fontStyle: "bold", color: "#e0f2fe", backgroundColor: "#082f49ee", padding: { x: 16, y: 9 } }).setOrigin(0.5).setDepth(50).setAlpha(0).setScale(0.92);
    const line = scene.add.rectangle(scene.scale.width / 2, 76, 180, 2, 0x38bdf8, 0).setDepth(49);
    scene.tweens.add({ targets: line, alpha: 0.75, scaleX: 2.2, duration: 180, yoyo: true, hold: 420, onComplete: () => line.destroy() });
    scene.tweens.add({ targets: banner, alpha: 1, y: 54, scale: 1, duration: 170, yoyo: true, hold: 520, onComplete: () => banner.destroy() });
    return true;
  }

  return false;
}
