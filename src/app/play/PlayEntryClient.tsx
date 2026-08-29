"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import SiteNav from "@/components/SiteNav";
import { ensurePlayerSession } from "@/lib/client-player-session";
import {
  ALPHA_FIRST_MATCH_DIFFICULTY,
  ALPHA_ONBOARDING_COMPLETE,
  ALPHA_ONBOARDING_STORAGE_KEY,
  shouldShowAlphaOnboarding,
} from "@/lib/alpha-onboarding";
import GameClient from "./GameClient";

type EntryState = "syncing" | "welcome" | "ready" | "error";

export default function PlayEntryClient() {
  const [state, setState] = useState<EntryState>("syncing");
  const [playerName, setPlayerName] = useState("");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const sync = async () => {
      setState("syncing");
      setError("");
      try {
        const savedName = localStorage.getItem("runeforge_playername") || "";
        const session = await ensurePlayerSession(savedName);
        if (cancelled) return;
        if (!session.ok || !session.player) throw new Error(session.error || "Não foi possível preparar sua sessão de jogador.");
        setPlayerName(String(session.player.name));
        const completed = localStorage.getItem(ALPHA_ONBOARDING_STORAGE_KEY) === ALPHA_ONBOARDING_COMPLETE;
        if (shouldShowAlphaOnboarding({ created: session.created, completed })) {
          localStorage.setItem("runeforge_ai_difficulty", ALPHA_FIRST_MATCH_DIFFICULTY);
          setState("welcome");
          return;
        }
        setState("ready");
      } catch (cause) {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : "Não foi possível preparar sua sessão de jogador.");
        setState("error");
      }
    };
    void sync();
    return () => { cancelled = true; };
  }, [attempt]);

  if (state === "ready") return <GameClient />;

  if (state === "syncing") {
    return <main className="rf-app-page"><SiteNav /><div className="rf-app-shell max-w-4xl"><section className="rounded-2xl border border-white/10 bg-white/[.03] px-6 py-16 text-center" aria-busy="true" aria-live="polite"><div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-2 border-white/10 border-t-amber-300" aria-hidden="true" /><p className="rf-eyebrow justify-center"><span /> PREPARANDO O NEXUS</p><h1 className="mt-3 text-3xl font-black text-white">Sincronizando seu forjador…</h1><p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-400">Estamos conectando sua identidade, coleção e progressão antes de liberar a preparação de batalha.</p></section></div></main>;
  }

  if (state === "error") {
    return <main className="rf-app-page"><SiteNav /><div className="rf-app-shell max-w-4xl"><section className="rounded-2xl border border-red-400/20 bg-red-400/[.05] px-6 py-12 text-center" role="alert"><p className="rf-eyebrow justify-center"><span /> SESSÃO INDISPONÍVEL</p><h1 className="mt-3 text-3xl font-black text-white">Não conseguimos abrir sua jornada.</h1><p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-red-100/80">{error}</p><div className="mt-6 flex flex-wrap justify-center gap-3"><button type="button" className="rf-button rf-button-primary" onClick={() => setAttempt((value) => value + 1)}>TENTAR NOVAMENTE</button><Link href="/" className="rf-button rf-button-secondary">VOLTAR AO INÍCIO</Link></div></section></div></main>;
  }

  const begin = () => {
    localStorage.setItem(ALPHA_ONBOARDING_STORAGE_KEY, ALPHA_ONBOARDING_COMPLETE);
    localStorage.setItem("runeforge_ai_difficulty", ALPHA_FIRST_MATCH_DIFFICULTY);
    setState("ready");
  };

  return <main className="rf-app-page"><SiteNav /><div className="rf-app-shell max-w-5xl"><section className="relative overflow-hidden rounded-3xl border border-amber-300/20 bg-[radial-gradient(circle_at_20%_0%,rgba(217,164,65,.15),transparent_35rem),linear-gradient(145deg,rgba(255,255,255,.045),rgba(255,255,255,.012))] p-6 sm:p-8 lg:p-10"><div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/60 to-transparent" aria-hidden="true" /><p className="rf-eyebrow"><span /> PRIMEIRO ACESSO · ALPHA JOGÁVEL</p><div className="mt-4 grid gap-8 lg:grid-cols-[1.2fr_.8fr] lg:items-start"><div><h1 className="text-4xl font-black leading-tight text-white sm:text-5xl">Bem-vindo ao Nexus,<br /><em className="text-amber-200 not-italic">{playerName}</em>.</h1><p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">Seu perfil persistente já foi criado. Para a primeira batalha, o RuneForge vai usar a IA <strong className="text-white">Aprendiz</strong> e abrir automaticamente o guia de combate e o checklist de treinamento.</p><div className="mt-7 grid gap-3 sm:grid-cols-3"><OnboardingStep number="01" title="Escolha um deck" copy="Use um dos decks oficiais. Você poderá forjar o seu depois." /><OnboardingStep number="02" title="Aprenda no campo" copy="Mulligan, mana, ataque, bloqueio e respostas serão guiados." /><OnboardingStep number="03" title="Receba progresso" copy="Partidas concluídas alimentam XP, ouro e sua jornada persistente." /></div><div className="mt-8 flex flex-wrap gap-3"><button type="button" className="rf-button rf-button-primary" onClick={begin}>COMEÇAR TREINAMENTO <b>→</b></button><Link href="/codex" className="rf-button rf-button-secondary">ABRIR CODEX</Link></div></div><aside className="rounded-2xl border border-cyan-300/15 bg-black/25 p-5"><p className="text-[10px] font-black uppercase tracking-[.18em] text-cyan-300/70">CONTA PERSISTENTE</p><h2 className="mt-2 text-xl font-black text-white">Seu progresso está protegido</h2><p className="mt-2 text-sm leading-6 text-slate-400">Uma chave de recuperação foi criada e armazenada neste navegador. Antes de trocar de dispositivo, abra o Perfil para copiar e guardar essa chave em local seguro.</p><div className="mt-4 rounded-xl border border-white/10 bg-white/[.025] p-3 text-xs leading-5 text-slate-400"><strong className="text-slate-200">Importante:</strong> não compartilhe sua chave de recuperação. Ela dá acesso ao seu progresso.</div><Link href="/profile" className="mt-4 inline-flex text-xs font-black uppercase tracking-[.12em] text-cyan-200 hover:text-cyan-100">VER SEGURANÇA DO PERFIL →</Link></aside></div></section></div></main>;
}

function OnboardingStep({ number, title, copy }: { number: string; title: string; copy: string }) {
  return <article className="rounded-2xl border border-white/10 bg-black/20 p-4"><span className="font-mono text-[10px] font-black text-amber-300/70">{number}</span><h2 className="mt-2 text-sm font-black text-white">{title}</h2><p className="mt-1 text-xs leading-5 text-slate-400">{copy}</p></article>;
}
