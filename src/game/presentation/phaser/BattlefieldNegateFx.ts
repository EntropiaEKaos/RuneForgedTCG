import type Phaser from "phaser";
import type { BattlefieldLabPoint } from "../battlefield-lab-scenario";

export function playNegateSpellFx(scene: Phaser.Scene, source: BattlefieldLabPoint, target: BattlefieldLabPoint, quality: "low" | "medium" | "high" = "high") {
  const high = quality === "high";
  const duration = high ? 520 : quality === "medium" ? 430 : 340;
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const nx = -dy / distance;
  const ny = dx / distance;

  const lance = scene.add.graphics().setDepth(55);
  lance.lineStyle(high ? 9 : 6, 0x7c3aed, 0.16).lineBetween(source.x, source.y, target.x, target.y);
  lance.lineStyle(high ? 4 : 3, 0xa78bfa, 0.92).lineBetween(source.x, source.y, target.x, target.y);
  lance.lineStyle(1, 0xffffff, 1).lineBetween(source.x, source.y, target.x, target.y);

  const seal = scene.add.circle(target.x, target.y, 16, 0x2e1065, 0.24).setStrokeStyle(high ? 5 : 3, 0xc4b5fd, 0.95).setDepth(57).setScale(0.2);
  const core = scene.add.circle(target.x, target.y, 7, 0xf5f3ff, 0.96).setDepth(58);
  scene.tweens.add({ targets: seal, scale: high ? 3.8 : 2.8, angle: 180, duration, ease: "Back.easeOut" });
  scene.tweens.add({ targets: core, scale: 0.05, alpha: 0, duration: Math.round(duration * 0.72), ease: "Cubic.easeIn", onComplete: () => core.destroy() });
  scene.tweens.add({ targets: lance, alpha: 0, duration: Math.round(duration * 0.75), onComplete: () => lance.destroy() });

  const fragments = high ? 26 : quality === "medium" ? 18 : 10;
  for (let i = 0; i < fragments; i += 1) {
    const angle = (Math.PI * 2 * i) / fragments + (i % 2) * 0.13;
    const radius = high ? 72 : 50;
    const shard = scene.add.rectangle(target.x + nx * ((i % 3) - 1) * 3, target.y + ny * ((i % 3) - 1) * 3, i % 4 === 0 ? 5 : 3, i % 5 === 0 ? 10 : 6, i % 2 ? 0xc4b5fd : 0x67e8f9, 0.9).setDepth(59).setAngle((i * 47) % 180);
    scene.tweens.add({ targets: shard, x: target.x + Math.cos(angle) * radius, y: target.y + Math.sin(angle) * radius, angle: shard.angle + 180, scale: 0.2, alpha: 0, duration: duration + (i % 5) * 35, ease: "Cubic.easeOut", onComplete: () => shard.destroy() });
  }

  const label = scene.add.text(target.x, target.y - 34, "NEGATED", { fontFamily: "system-ui", fontSize: high ? "18px" : "14px", fontStyle: "bold", color: "#f5f3ff", stroke: "#4c1d95", strokeThickness: 6 }).setOrigin(0.5).setDepth(61).setAlpha(0).setScale(0.72);
  scene.tweens.add({ targets: label, alpha: 1, scale: 1.12, y: target.y - 50, duration: 170, yoyo: true, hold: 380, onComplete: () => label.destroy() });
  scene.tweens.add({ targets: seal, alpha: 0, scale: high ? 5.4 : 4, duration: duration + 220, ease: "Sine.easeOut", onComplete: () => seal.destroy() });
  scene.cameras.main.flash(85, 167, 139, 250, false);
  scene.cameras.main.shake(high ? 130 : 80, high ? 0.0045 : 0.0025);
}
