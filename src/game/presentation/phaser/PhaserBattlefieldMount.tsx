"use client";

import { useEffect, useRef, useState } from "react";
import type { BattlefieldLabScenario } from "../battlefield-lab-scenario";

type Props = { scenario: BattlefieldLabScenario };

export default function PhaserBattlefieldMount({ scenario }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<{ destroy: (removeCanvas: boolean, noReturn?: boolean) => void } | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">("loading");
  const [metrics, setMetrics] = useState({ fps: 0, objects: 0, renderer: "pending" });

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");

    async function mount() {
      const host = hostRef.current;
      if (!host) return;
      gameRef.current?.destroy(true);
      gameRef.current = null;
      host.replaceChildren();

      try {
        const Phaser = await import("phaser");
        if (cancelled || !hostRef.current) return;

        class BattlefieldLabScene extends Phaser.Scene {
          constructor() { super("battlefield-lab"); }
          create() {
            const width = this.scale.width;
            const height = this.scale.height;
            this.cameras.main.setBackgroundColor("#070b16");
            const cols = scenario.players.length === 4 ? 2 : 1;
            const rows = Math.ceil(scenario.players.length / cols);
            const zoneW = width / cols;
            const zoneH = height / rows;

            scenario.players.forEach((player, playerIndex) => {
              const col = playerIndex % cols;
              const row = Math.floor(playerIndex / cols);
              const x0 = col * zoneW;
              const y0 = row * zoneH;
              this.add.rectangle(x0 + zoneW / 2, y0 + zoneH / 2, zoneW - 10, zoneH - 10, 0x111827, 0.78)
                .setStrokeStyle(1, 0x64748b, 0.45);
              this.add.text(x0 + 16, y0 + 14, `${player.label} · ${player.life}`, { fontFamily: "system-ui", fontSize: "13px", color: "#e2e8f0" });

              const entities = scenario.entities.filter((entity) => entity.controllerId === player.id);
              const unitCols = Math.max(4, Math.min(10, Math.ceil(Math.sqrt(entities.length * 1.6))));
              const availableW = zoneW - 30;
              const availableH = zoneH - 55;
              const gapX = availableW / unitCols;
              const unitRows = Math.max(1, Math.ceil(entities.length / unitCols));
              const gapY = availableH / unitRows;
              const cardW = Math.max(12, Math.min(34, gapX * 0.72));
              const cardH = cardW * 1.32;

              entities.forEach((entity, index) => {
                const ux = x0 + 16 + (index % unitCols) * gapX + gapX / 2;
                const uy = y0 + 48 + Math.floor(index / unitCols) * gapY + gapY / 2;
                const fill = entity.kind === "token" ? 0x7c3aed : 0x0891b2;
                const unit = this.add.rectangle(ux, uy, cardW, cardH, fill, 0.68)
                  .setStrokeStyle(1, entity.tapped ? 0xf59e0b : 0xcbd5e1, 0.65)
                  .setInteractive({ useHandCursor: true });
                if (entity.tapped) unit.setAngle(18);
                unit.on("pointerover", () => unit.setAlpha(1));
                unit.on("pointerout", () => unit.setAlpha(0.68));
              });
            });

            this.add.text(width / 2, height / 2, "STACK", { fontFamily: "system-ui", fontSize: "10px", color: "#94a3b8", backgroundColor: "#020617aa", padding: { x: 8, y: 5 } }).setOrigin(0.5).setDepth(20);
            setMetrics((current) => ({ ...current, objects: this.children.length }));
          }
        }

        const game = new Phaser.Game({
          type: Phaser.AUTO,
          parent: hostRef.current,
          width: Math.max(640, hostRef.current.clientWidth || 960),
          height: 560,
          backgroundColor: "#070b16",
          scene: BattlefieldLabScene,
          render: { antialias: true, pixelArt: false },
          input: { activePointers: 2 },
        });
        gameRef.current = game;
        const renderer = game.renderer?.type === Phaser.WEBGL ? "WebGL" : game.renderer?.type === Phaser.CANVAS ? "Canvas" : "Unknown";
        setMetrics({ fps: 0, objects: scenario.entities.length, renderer });
        const metricsTimer = window.setInterval(() => {
          if (!cancelled && game.loop) setMetrics((current) => ({ ...current, fps: Math.round(game.loop.actualFps || 0) }));
        }, 1000);
        (game as Phaser.Game & { __labMetricsTimer?: number }).__labMetricsTimer = metricsTimer;
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("fallback");
      }
    }

    void mount();
    return () => {
      cancelled = true;
      const game = gameRef.current as (typeof gameRef.current & { __labMetricsTimer?: number });
      if (game?.__labMetricsTimer) window.clearInterval(game.__labMetricsTimer);
      game?.destroy(true);
      gameRef.current = null;
    };
  }, [scenario]);

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-black/30">
      <div className="absolute left-4 top-4 z-20 flex gap-2 text-[10px] font-mono text-slate-300">
        <span className="rounded bg-black/70 px-2 py-1">{metrics.renderer}</span>
        <span className="rounded bg-black/70 px-2 py-1">{metrics.fps} FPS</span>
        <span className="rounded bg-black/70 px-2 py-1">{metrics.objects} objects</span>
      </div>
      <div ref={hostRef} className="min-h-[560px] w-full" aria-label="Phaser Battlefield Lab canvas" />
      {status !== "ready" && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center p-6 text-center text-sm text-slate-400">
          {status === "loading" ? "Inicializando renderer experimental…" : "Phaser indisponível neste build. O Alpha e o renderer atual permanecem intactos."}
        </div>
      )}
    </div>
  );
}
