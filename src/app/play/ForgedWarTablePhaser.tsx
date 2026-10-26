"use client";

import { useEffect, useRef } from "react";

/** Decorative Phaser layer only. React remains authoritative for all game UI,
 * targeting and pointer input. No glass, blur panels or gameplay hit targets. */
export default function ForgedWarTablePhaser({ phase }: { phase: string }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let disposed = false;
    let game: import("phaser").Game | undefined;
    const element = host.current;
    if (!element) return;
    void import("phaser").then(({ default: Phaser }) => {
      if (disposed || !element.isConnected) return;
      class ForgedWarTableScene extends Phaser.Scene {
        constructor() { super("ForgedWarTable"); }
        create() {
        const g = this.add.graphics();
        const w = 1600, h = 900;
        // Solid carved basalt, aged bronze rails and a volcanic fissure.
        g.fillGradientStyle(0x171513, 0x171513, 0x080b0d, 0x080b0d);
        g.fillRect(0, 0, w, h);
        for (let i = 0; i < 28; i++) {
          const y = 26 + i * 32;
          g.lineStyle(1, i % 4 === 0 ? 0x705438 : 0x34302a, i % 4 === 0 ? 0.27 : 0.16);
          g.lineBetween(0, y, w, y + (i % 3 - 1) * 7);
        }
        for (let i = 0; i < 21; i++) {
          const x = i * 83;
          g.lineStyle(1, 0x7b6246, 0.12);
          g.lineBetween(x, 0, x + 30, h);
        }
        // Forged rails frame the battlefield, not individual card slots.
        for (const y of [165, 330, 565, 735]) {
          g.lineStyle(7, 0x0b0908, 0.9);
          g.lineBetween(42, y, 1558, y);
          g.lineStyle(2, 0xc39552, 0.48);
          g.lineBetween(42, y - 3, 1558, y - 3);
          g.lineStyle(1, 0xf0cb80, 0.24);
          g.lineBetween(75, y + 4, 1525, y + 4);
        }
        // The central forge seal is intentionally muted beneath card controls.
        g.lineStyle(3, 0x956a39, 0.38);
        g.strokeCircle(800, 450, 110);
        g.lineStyle(1, 0xe4ae61, 0.35);
        g.strokeCircle(800, 450, 94);
        g.lineStyle(3, 0xa97739, 0.32);
        g.strokeTriangle(800, 370, 730, 505, 870, 505);
        g.strokeTriangle(800, 530, 730, 395, 870, 395);
        const sparks: Array<{ sprite: Phaser.GameObjects.Arc; speed: number }> = [];
        for (let i = 0; i < 34; i++) {
          const x = (i * 463 + 97) % w;
          const y = (i * 251 + 43) % h;
          const dot = this.add.circle(x, y, i % 5 === 0 ? 2 : 1, i % 3 === 0 ? 0xffd18c : 0xb36d39, 0.15 + (i % 4) * 0.08);
          sparks.push({ sprite: dot, speed: 0.08 + (i % 5) * 0.07 });
        }
        this.events.on("update", (_time: number, delta: number) => {
          for (const spark of sparks) {
            spark.sprite.y -= Math.min(delta, 50) * spark.speed * 0.1;
            if (spark.sprite.y < 0) spark.sprite.y = h;
          }
        });
        }
      }
      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: element,
        width: 1600,
        height: 900,
        transparent: false,
        backgroundColor: "#10100e",
        scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.NO_CENTER },
        render: { antialias: true },
        scene: ForgedWarTableScene,
        audio: { noAudio: true },
      });
    }).catch(() => { /* CSS battlefield remains available if WebGL fails. */ });
    return () => { disposed = true; game?.destroy(true); };
  }, []);
  return <div ref={host} data-forged-phaser-war-table="true" data-phase={phase} aria-hidden="true" className="forged-phaser-war-table" />;
}
