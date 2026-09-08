"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  clearPendingRecoveryKey,
  getPendingRecoveryKey,
  subscribePendingRecoveryKey,
} from "@/lib/recovery-key-memory";

export default function RecoveryKeyNotice() {
  const recoveryKey = useSyncExternalStore(
    subscribePendingRecoveryKey,
    getPendingRecoveryKey,
    () => null,
  );
  const [copied, setCopied] = useState(false);

  if (!recoveryKey) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(recoveryKey);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <aside
      data-recovery-key-notice="true"
      className="fixed inset-x-3 bottom-3 z-[90] mx-auto max-w-3xl rounded-2xl border border-cyan-300/30 bg-slate-950/95 p-4 shadow-2xl backdrop-blur sm:bottom-5"
      role="alertdialog"
      aria-labelledby="recovery-key-notice-heading"
      aria-describedby="recovery-key-notice-copy"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-cyan-300/70">SEGURANÇA DA CONTA</p>
          <h2 id="recovery-key-notice-heading" className="mt-1 text-lg font-black text-slate-50">
            Salve sua chave de recuperação agora
          </h2>
          <p id="recovery-key-notice-copy" className="mt-2 text-sm leading-6 text-slate-400">
            Esta chave não será salva neste navegador. Guarde-a fora do RuneForge para recuperar seu progresso em outro dispositivo.
          </p>
          <code
            data-recovery-key-value="true"
            className="mt-3 block select-all break-all rounded-lg border border-white/10 bg-black/35 px-3 py-2.5 text-xs text-cyan-100"
          >
            {recoveryKey}
          </code>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button type="button" className="rf-button rf-button-secondary min-h-9 !px-3" onClick={() => void copy()}>
            {copied ? "COPIADO" : "COPIAR"}
          </button>
          <button type="button" className="rf-button rf-button-primary min-h-9 !px-3" onClick={clearPendingRecoveryKey}>
            JÁ SALVEI
          </button>
          <Link href="/recover" className="rf-button rf-button-secondary min-h-9 !px-3">
            RECUPERAR CONTA
          </Link>
        </div>
      </div>
    </aside>
  );
}
