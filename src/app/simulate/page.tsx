"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PRESET_DECK_OPTIONS } from "@/game/preset-deck-options";
import { ensurePlayerSession } from "@/lib/client-player-session";

type SimResult = {
  final: {
    winner: string;
    rounds: number;
    playerNexus: number;
    aiNexus: number;
  };
  replay: {
    id: number;
    seed: number;
    playerName: string;
    deckName: string;
    aiDeckName: string;
    playerFirst: boolean;
    won: boolean;
  };
  log: string[];
};

const REGION_GRADIENTS: Record<string, string> = {
  Emberhold: "from-orange-500 to-red-900",
  Tidecall: "from-cyan-400 to-blue-900",
  Ironwood: "from-emerald-400 to-green-900",
  Voidborn: "from-fuchsia-500 to-purple-950",
};

const DECKS = PRESET_DECK_OPTIONS;

function regionColor(deckId: string): string {
  const deck = DECKS.find((d) => d.id === deckId);
  if (!deck) return "from-slate-500 to-slate-900";
  return REGION_GRADIENTS[deck.regions[0]] ?? "from-slate-500 to-slate-900";
}

export default function SimulatePage() {
  const [deckId, setDeckId] = useState(DECKS[0].id);
  const [playerName, setPlayerName] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SimResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openSteps, setOpenSteps] = useState<number[]>([]);

  useEffect(() => {
    void ensurePlayerSession(localStorage.getItem("runeforge_playername") || "").then((profile) => {
      if (profile.player?.name) setPlayerName(String(profile.player.name));
    });
  }, []);

  const run = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerName, deckId }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Simulation failed");
      setResult(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const toggleStep = (i: number) =>
    setOpenSteps((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]));

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,#1e293b,#0f172a_55%,#020617)] px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" className="text-sm text-slate-400 hover:text-white">
            ← Home
          </Link>
          <Link href="/leaderboard" className="text-sm text-slate-400 hover:text-white">
            🏆 Leaderboard
          </Link>
        </div>

        <h1 className="text-center text-3xl font-black text-amber-300 drop-shadow">
          🧪 Authoritative Match Simulator
        </h1>
        <p className="mt-2 text-center text-sm text-slate-400">
          Runs a fully deterministic match <em>on the server</em>, persists the replay log to the
          database, and proves the engine is safe to use as the authority for PvP.
        </p>

        <div className="mx-auto mt-6 grid max-w-xl gap-3 sm:grid-cols-[1fr_auto]">
          <label className="text-xs font-semibold text-slate-400">
            Player Name
            <input
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/15 bg-slate-800 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-slate-400">
            Deck
            <select
              value={deckId}
              onChange={(e) => setDeckId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/15 bg-slate-800 px-3 py-2 text-sm"
            >
              {DECKS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.emoji} {d.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-5 flex justify-center">
          <button onClick={run} className="btn-primary" disabled={busy}>
            {busy ? "⏳ Simulating…" : "▶ Run Server Simulation"}
          </button>
        </div>

        {error && <p className="mt-4 text-center text-sm text-red-300">{error}</p>}

        {result && (
          <div className="mt-8 space-y-4">
            <div
              className={`grid grid-cols-2 gap-3 rounded-2xl border border-white/10 bg-gradient-to-br p-5 ${regionColor(deckId)}`}
            >
              <div className="rounded-xl bg-black/30 p-3">
                <p className="text-[10px] uppercase tracking-wider text-white/70">Winner</p>
                <p className="text-xl font-black">
                  {result.final.winner === "player" ? "🏆 Player" : "🤖 Adversary"}
                </p>
              </div>
              <div className="rounded-xl bg-black/30 p-3">
                <p className="text-[10px] uppercase tracking-wider text-white/70">Rounds</p>
                <p className="text-xl font-black">{result.final.rounds}</p>
              </div>
              <div className="rounded-xl bg-black/30 p-3">
                <p className="text-[10px] uppercase tracking-wider text-white/70">Player Nexus</p>
                <p className="text-xl font-black">{result.final.playerNexus}</p>
              </div>
              <div className="rounded-xl bg-black/30 p-3">
                <p className="text-[10px] uppercase tracking-wider text-white/70">AI Nexus</p>
                <p className="text-xl font-black">{result.final.aiNexus}</p>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-xs text-slate-400">
              Replay <span className="font-mono text-amber-300">#{result.replay.id}</span> · seed{" "}
              <span className="font-mono">{result.replay.seed}</span> · {result.replay.deckName} vs{" "}
              {result.replay.aiDeckName} · {result.replay.playerFirst ? "player first" : "AI first"}
            </div>

            <div className="rounded-xl border border-white/10 bg-black/40 p-4">
              <h2 className="mb-2 font-bold text-amber-200">📜 Deterministic Battle Log</h2>
              <ul className="space-y-1">
                {result.log.map((line, i) => (
                  <li
                    key={i}
                    className="cursor-pointer rounded px-2 py-1 hover:bg-white/5"
                    onClick={() => toggleStep(i)}
                  >
                    <span className="mr-2 font-mono text-slate-600">{String(i).padStart(2, "0")}</span>
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
