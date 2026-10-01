import type Phaser from "phaser";

export type BattlefieldCombatFxPoint = { x: number; y: number };

export function playCombatLaneFx(
  scene: Phaser.Scene,
  source: BattlefieldCombatFxPoint,
  target: BattlefieldCombatFxPoint,
  phase: "attackers" | "blockers" | "damage",
) {
  const color = phase === "attackers" ? 0xf97316 : phase === "blockers" ? 0xfacc15 : 0xef4444;
  const line = scene.add.line(0, 0, source.x, source.y, target.x, target.y, color, phase === "damage" ? 0.95 : 0.72)
    .setOrigin(0, 0)
    .setLineWidth(phase === "damage" ? 6 : 3)
    .setDepth(47)
    .setAlpha(0);

  scene.tweens.add({
    targets: line,
    alpha: 1,
    duration: 130,
    yoyo: phase === "damage",
    hold: phase === "damage" ? 120 : 430,
    onComplete: () => line.destroy(),
  });

  const sourceRing = scene.add.circle(source.x, source.y, 9, color, 0.12).setStrokeStyle(3, color, 0.9).setDepth(48);
  const targetRing = scene.add.circle(target.x, target.y, 9, color, 0.12).setStrokeStyle(3, color, 0.9).setDepth(48);
  scene.tweens.add({
    targets: [sourceRing, targetRing],
    scale: phase === "damage" ? 2.8 : 1.8,
    alpha: 0,
    duration: phase === "damage" ? 420 : 600,
    ease: "Cubic.easeOut",
    onComplete: () => {
      sourceRing.destroy();
      targetRing.destroy();
    },
  });

  if (phase === "damage") {
    const impact = scene.add.circle(target.x, target.y, 5, 0xfff7ed, 0.95).setDepth(50);
    scene.tweens.add({ targets: impact, scale: 5, alpha: 0, duration: 260, ease: "Quad.easeOut", onComplete: () => impact.destroy() });
    scene.cameras.main.shake(90, 0.0035);
  }
}


export function playDamageImpactFx(
  scene: Phaser.Scene,
  target: BattlefieldCombatFxPoint,
  amount: number,
  kind: "nexus" | "object",
) {
  const color = kind === "nexus" ? 0xfb7185 : 0xef4444;
  const ring = scene.add.circle(target.x, target.y, kind === "nexus" ? 18 : 12, color, 0.12)
    .setStrokeStyle(kind === "nexus" ? 4 : 3, color, 0.95)
    .setDepth(56);
  const flash = scene.add.circle(target.x, target.y, 5, 0xfff7ed, 0.96).setDepth(58);
  const label = scene.add.text(target.x, target.y - (kind === "nexus" ? 28 : 20), `-${amount}`, {
    fontFamily: "system-ui, sans-serif",
    fontSize: kind === "nexus" ? "22px" : "17px",
    fontStyle: "bold",
    color: "#fff1f2",
    stroke: "#4c0519",
    strokeThickness: 5,
  }).setOrigin(0.5).setDepth(59);

  scene.tweens.add({
    targets: ring,
    scale: kind === "nexus" ? 3.1 : 2.35,
    alpha: 0,
    duration: 520,
    ease: "Cubic.easeOut",
    onComplete: () => ring.destroy(),
  });
  scene.tweens.add({
    targets: flash,
    scale: kind === "nexus" ? 6 : 4,
    alpha: 0,
    duration: 280,
    ease: "Quad.easeOut",
    onComplete: () => flash.destroy(),
  });
  scene.tweens.add({
    targets: label,
    y: label.y - 24,
    alpha: 0,
    duration: 760,
    ease: "Sine.easeOut",
    onComplete: () => label.destroy(),
  });
  scene.cameras.main.shake(kind === "nexus" ? 110 : 70, kind === "nexus" ? 0.004 : 0.0025);
}

export function playBarrierBreakFx(
  scene: Phaser.Scene,
  target: BattlefieldCombatFxPoint,
) {
  const color = 0x67e8f9;
  const outer = scene.add.circle(target.x, target.y, 16, color, 0.08).setStrokeStyle(3, color, 0.95).setDepth(57);
  const inner = scene.add.circle(target.x, target.y, 8, 0xecfeff, 0.18).setStrokeStyle(2, 0xcffafe, 0.9).setDepth(58);
  const label = scene.add.text(target.x, target.y - 24, "BARRIER", {
    fontFamily: "system-ui, sans-serif",
    fontSize: "12px",
    fontStyle: "bold",
    color: "#cffafe",
    stroke: "#083344",
    strokeThickness: 4,
  }).setOrigin(0.5).setDepth(59);

  scene.tweens.add({
    targets: [outer, inner],
    scale: 3.4,
    alpha: 0,
    duration: 620,
    ease: "Cubic.easeOut",
    onComplete: () => {
      outer.destroy();
      inner.destroy();
    },
  });
  scene.tweens.add({
    targets: label,
    y: label.y - 18,
    alpha: 0,
    duration: 680,
    ease: "Sine.easeOut",
    onComplete: () => label.destroy(),
  });
}

export function playDepartureFx(
  scene: Phaser.Scene,
  target: BattlefieldCombatFxPoint,
  destination: "graveyard" | "general_zone",
) {
  const general = destination === "general_zone";
  const color = general ? 0xa78bfa : 0x94a3b8;
  const ring = scene.add.circle(target.x, target.y, 14, color, 0.1).setStrokeStyle(3, color, 0.9).setDepth(55);
  const label = scene.add.text(target.x, target.y, general ? "GENERAL ZONE" : "GRAVEYARD", {
    fontFamily: "system-ui, sans-serif",
    fontSize: "11px",
    fontStyle: "bold",
    color: general ? "#ddd6fe" : "#e2e8f0",
    stroke: "#020617",
    strokeThickness: 4,
  }).setOrigin(0.5).setDepth(57);

  scene.tweens.add({
    targets: ring,
    scale: 0.2,
    alpha: 0,
    duration: 520,
    ease: "Cubic.easeIn",
    onComplete: () => ring.destroy(),
  });
  scene.tweens.add({
    targets: label,
    y: label.y + (general ? -34 : 34),
    alpha: 0,
    duration: 720,
    ease: "Sine.easeIn",
    onComplete: () => label.destroy(),
  });
}
