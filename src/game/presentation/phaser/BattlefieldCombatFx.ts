export type BattlefieldCombatFxPoint = { x: number; y: number };

type CombatFxDisplayObject = {
  setOrigin(x: number, y: number): CombatFxDisplayObject;
  setLineWidth(width: number): CombatFxDisplayObject;
  setDepth(depth: number): CombatFxDisplayObject;
  setAlpha(alpha: number): CombatFxDisplayObject;
  setStrokeStyle(width: number, color: number, alpha?: number): CombatFxDisplayObject;
  destroy(): void;
};

type CombatFxScene = {
  add: {
    line(x: number, y: number, x1: number, y1: number, x2: number, y2: number, color: number, alpha?: number): CombatFxDisplayObject;
    circle(x: number, y: number, radius: number, color: number, alpha?: number): CombatFxDisplayObject;
  };
  tweens: {
    add(config: {
      targets: CombatFxDisplayObject | CombatFxDisplayObject[];
      alpha?: number;
      scale?: number;
      duration: number;
      yoyo?: boolean;
      hold?: number;
      ease?: string;
      onComplete?: () => void;
    }): unknown;
  };
  cameras: {
    main: {
      shake(duration: number, intensity: number): unknown;
    };
  };
};

export function playCombatLaneFx(
  scene: CombatFxScene,
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
