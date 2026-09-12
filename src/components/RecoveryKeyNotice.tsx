"use client";

import { useEffect, useState } from "react";
import {
  consumePendingRecoveryCode,
  PLAYER_RECOVERY_KEY_EVENT,
} from "@/lib/client-player-session";

function saveRecoveryFile(code: string) {
  const blob = new Blob([
    [
      "RuneForge — Chave de recuperação",
      "",
      code,
      "",
      "Guarde este arquivo em local seguro.",
      "Esta chave permite recuperar sua conta e é rotacionada após o uso.",
      "",
    ].join("\n"),
  ], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "runeforge-recovery-key.txt";
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function RecoveryKeyNotice() {
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    const onIssued = (event: Event) => {
      const issued = (event as CustomEvent<{ code?: string }>).detail?.code?.trim();
      if (!issued || !active) return;
      consumePendingRecoveryCode();
      setCopied(false);
      setCode(issued);
    };

    // Subscribe first, then reconcile any key issued just before this component
    // mounted. The microtask avoids a synchronous state write inside the effect
    // while keeping the handoff race-free.
    window.addEventListener(PLAYER_RECOVERY_KEY_EVENT, onIssued);
    queueMicrotask(() => {
      if (!active) return;
      const pending = consumePendingRecoveryCode();
      if (pending) setCode(pending);
    });

    return () => {
      active = false;
      window.removeEventListener(PLAYER_RECOVERY_KEY_EVENT, onIssued);
    };
  }, []);

  if (!code) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] grid place-items-center bg-black/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="recovery-key-title">
      <section className="w-full max-w-xl rounded-2xl border border-cyan-300/25 bg-slate-950 p-5 shadow-2xl sm:p-6">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300/70">SEGURANÇA DA CONTA</p>
        <h2 id="recovery-key-title" className="mt-2 text-2xl font-black text-slate-50">Salve sua chave de recuperação</h2>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Ela não fica armazenada automaticamente no navegador. Copie ou baixe agora e guarde fora do RuneForge.
          Ao recuperar a conta ou gerar uma nova chave, a anterior deixa de funcionar.
        </p>

        <code className="mt-5 block select-all break-all rounded-xl border border-cyan-300/15 bg-black/35 px-4 py-3 text-sm text-cyan-100">
          {code}
        </code>

        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" className="rf-button rf-button-primary" onClick={() => void copy()}>
            {copied ? "COPIADA" : "COPIAR CHAVE"}
          </button>
          <button type="button" className="rf-button rf-button-secondary" onClick={() => saveRecoveryFile(code)}>
            BAIXAR .TXT
          </button>
          <button type="button" className="rf-button rf-button-secondary" onClick={() => setCode(null)}>
            JÁ GUARDEI
          </button>
        </div>
      </section>
    </div>
  );
}
