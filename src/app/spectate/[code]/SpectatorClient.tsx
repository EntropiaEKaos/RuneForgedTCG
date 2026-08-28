"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import CardView from "@/components/CardView";
import type { SpectatorGameState } from "@/lib/spectator-state";

type Props = { code: string };
interface SpectatorPayload {
  ok: boolean;
  delayed?: boolean;
  delayMs?: number;
  retryAfterMs?: number;
  status?: string;
  winner?: string | null;
  version?: number;
  updatedAt?: string;
  state?: SpectatorGameState | null;
  error?: string;
}

export default function SpectatorClient({ code }: Props) {
  const [data, setData] = useState<SpectatorPayload | null>(null);
  const [error, setError] = useState("");
  const [connection, setConnection] = useState<"connecting" | "live" | "offline" | "paused">("connecting");
  const [latency, setLatency] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let active = true;
    let timer = 0;
    if (paused) return () => { active = false; };
    const poll = async () => {
      try {
        const started = performance.now();
        const res = await fetch(`/api/pvp/${encodeURIComponent(code)}/spectate`, { cache: "no-store" });
        const json = await res.json() as SpectatorPayload;
        if (!active) return;
        setLatency(Math.round(performance.now() - started));
        setData(json);
        setError(json.ok ? "" : json.error || "Transmissão indisponível");
        setConnection(json.ok ? "live" : "offline");
        timer = window.setTimeout(poll, document.hidden ? 5000 : Math.max(1000, Math.min(4000, json.retryAfterMs ?? 2000)));
      } catch {
        if (!active) return;
        setError("Transmissão temporariamente indisponível");
        setConnection("offline");
        timer = window.setTimeout(poll, 3000);
      }
    };
    void poll();
    return () => { active = false; window.clearTimeout(timer); };
  }, [code, paused]);

  const state = data?.state;
  const effectiveConnection = paused ? "paused" : connection;
  return (
    <main className="spectator-shell min-h-screen px-4 py-6 text-slate-100">
      <div className="mx-auto max-w-7xl">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/30 p-4 backdrop-blur-xl">
          <div>
            <div className="text-[10px] font-black tracking-[.35em] text-cyan-300">RUNEFORGE // SPECTATOR</div>
            <h1 className="mt-1 text-2xl font-black">Sala {code}</h1>
            <p className="text-xs text-slate-400">Transmissão protegida por atraso real de {Math.round((data?.delayMs ?? 10_000) / 1000)}s</p>
          </div>
          <div className="flex items-center gap-3">
            <span aria-live="polite" className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold">
              <span className={effectiveConnection === "live" ? "text-emerald-300" : effectiveConnection === "offline" ? "text-red-300" : "text-amber-300"}>●</span>{" "}
              {effectiveConnection === "paused" ? "Transmissão pausada" : data?.delayed ? "Sincronizando atraso" : effectiveConnection === "live" ? `Snapshot v${data?.version ?? 0}` : "Reconectando"}
            </span>
            {latency != null && <span className="spectator-metric">{latency} ms</span>}
            {data?.updatedAt && <span className="spectator-metric">{new Date(data.updatedAt).toLocaleTimeString("pt-BR")}</span>}
            <button onClick={() => setPaused((value) => !value)} className="btn-ghost !px-3 !py-1 text-xs">{paused ? "▶ Retomar" : "Ⅱ Pausar"}</button>
            <Link href="/pvp" className="btn-ghost !px-3 !py-1 text-xs">Voltar ao PvP</Link>
          </div>
        </header>

        {error && <div role="alert" className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-red-100">{error}</div>}
        {data?.delayed && !state && <div className="grid min-h-[56vh] place-items-center rounded-3xl border border-cyan-300/15 bg-cyan-400/[.03] text-center"><div><div className="text-5xl">◌</div><p className="mt-3 font-black text-cyan-100">Construindo o buffer anti-stream-snipe…</p><p className="mt-1 text-sm text-slate-400">O primeiro snapshot ficará disponível em instantes.</p></div></div>}

        {state && (
          <section className="spectator-arena rounded-[2rem] border border-white/10 p-4 shadow-2xl md:p-7">
            <div className="mb-4 grid gap-3 md:grid-cols-2">
              {(["ai", "player"] as const).map((pid) => {
                const p = state.players[pid];
                return <article key={pid} className="rounded-2xl border border-white/10 bg-slate-950/65 p-4 backdrop-blur">
                  <div className="flex items-start justify-between gap-3">
                    <div><div className="text-[10px] font-black tracking-[.25em] text-slate-500">{pid === "player" ? "HOST" : "GUEST"}</div><h2 className="text-xl font-black">{p.name}</h2><p className="text-xs text-slate-500">{p.deckName}</p></div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <Stat label="NEXUS" value={p.nexusHealth} tone="text-red-300" />
                      <Stat label="MANA" value={`${p.mana}/${p.maxMana}`} tone="text-cyan-300" />
                      <Stat label="VENENO" value={`${p.poisonCounters}/10`} tone="text-lime-300" />
                    </div>
                  </div>
                  <div className="mt-4 flex min-h-32 flex-wrap items-center justify-center gap-2 rounded-xl border border-white/5 bg-black/20 p-3">
                    {p.bench.length ? p.bench.map((unit) => <CardView key={unit.instanceId} defId={unit.defId} unit={unit} size="sm" />) : <span className="text-xs text-slate-600">Campo vazio</span>}
                  </div>
                  <div className="mt-3 flex justify-between text-xs text-slate-400"><span>🂠 {p.handCount} na mão</span><span>▤ {p.deckCount} no deck</span><span>✦ {p.spellMana} mana de magia</span></div>
                </article>;
              })}
            </div>
            <div className="rounded-2xl border border-amber-300/15 bg-black/35 p-4 text-center">
              <div className="text-[10px] font-black tracking-[.3em] text-amber-300">COMBAT TELEMETRY</div>
              <p className="mt-1 text-lg font-black">Rodada {state.round} · {state.phase.toUpperCase()}</p>
              <p className="text-xs text-slate-400">Prioridade: {state.players[state.activePlayer].name} · Token: {state.players[state.attackToken].name}</p>
              {(data?.winner || state.winner) && <h3 className="mt-3 text-2xl font-black text-amber-200">Vitória: {data?.winner || state.players[state.winner!].name}</h3>}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return <div className="min-w-14 rounded-lg border border-white/10 bg-black/30 px-2 py-1"><b className={`block text-base ${tone}`}>{value}</b><span className="text-[8px] tracking-wider text-slate-500">{label}</span></div>;
}
