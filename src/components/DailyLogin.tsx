"use client";

import { useState } from "react";
import { LOGIN_REWARDS } from "@/lib/packs";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { ensurePlayerSession } from "@/lib/client-player-session";

export default function DailyLogin() {
  const [playerName, setPlayerName] = useState("");
  const [streak, setStreak] = useState(0);
  const [canClaim, setCanClaim] = useState(false);
  const [message, setMessage] = useState("");
  const [loaded, setLoaded] = useState(false);

  useDeferredEffect(() => {
    void (async () => {
      const profile = await ensurePlayerSession(localStorage.getItem("runeforge_playername") || "");
      if (profile.player?.name) setPlayerName(String(profile.player.name));
      const d = await fetch("/api/login-reward").then((r) => r.json()).catch(() => null);
      if (d?.ok) {
        setStreak(d.streak);
        setCanClaim(d.canClaim);
        setLoaded(true);
      }
    })();
  }, []);

  const claim = async () => {
    const res = await fetch("/api/login-reward", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: playerName }),
    });
    const d = await res.json();
    if (d.ok) {
      setStreak(d.streak);
      setCanClaim(false);
      setMessage(`🎉 +${d.reward.gold}🪙 +${d.reward.dust}💠${d.reward.pack ? " + Pacote!" : ""} (streak: ${d.streak})`);
    } else {
      setMessage(d.error || "Já coletado hoje");
    }
  };

  if (!loaded) return null;

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">📅</span>
          <div>
            <p className="font-bold text-emerald-300">
              Recompensa Diária — Streak: {streak} {streak > 0 ? "🔥" : ""}
            </p>
            <p className="text-xs text-slate-400">
              {canClaim
                ? "Reivindique sua recompensa diária!"
                : "Volte amanhã para a próxima recompensa"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {LOGIN_REWARDS.slice(0, 7).map((r) => {
              const isCurrent = r.day === ((streak % 7)) + 1 && canClaim;
              return (
                <span
                  key={r.day}
                  title={`Dia ${r.day}: ${r.gold}🪙${r.dust ? ` + ${r.dust}💠` : ""}${r.pack ? " + pack" : ""}`}
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-sm ${
                    r.day <= streak % 7 || (streak >= 7 && r.day <= 7)
                      ? "bg-emerald-500/40"
                      : isCurrent
                        ? "bg-amber-400 animate-pulse"
                        : "bg-white/10 opacity-50"
                  }`}
                >
                  {r.icon}
                </span>
              );
            })}
          </div>
          {canClaim && (
            <button
              onClick={claim}
              className="rounded-lg bg-emerald-500 px-4 py-1.5 font-black text-white hover:bg-emerald-400"
            >
              🎁 Coletar
            </button>
          )}
        </div>
      </div>
      {message && <p className="mt-2 text-xs text-amber-200">{message}</p>}
    </div>
  );
}
