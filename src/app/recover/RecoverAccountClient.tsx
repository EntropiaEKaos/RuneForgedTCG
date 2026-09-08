"use client";

import { useState } from "react";
import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import { recoverPlayerSession } from "@/lib/client-player-session";
import { clearPendingRecoveryKey } from "@/lib/recovery-key-memory";

export default function RecoverAccountClient() {
  const [input, setInput] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const recover = async () => {
    const key = input.trim();
    if (!key) return;
    setLoading(true);
    setMessage("");
    try {
      const result = await recoverPlayerSession(key);
      if (!result.ok || !result.recovered || !result.player) {
        setMessage(result.error || "Não foi possível recuperar esta conta.");
        return;
      }
      const rotated = typeof result.recoveryCode === "string" ? result.recoveryCode : "";
      setPlayerName(String(result.player.name));
      setNewKey(rotated || null);
      setInput("");
      setMessage("Conta recuperada. A chave usada foi invalidada e uma nova chave foi emitida.");
      // This page already renders the one-time replacement key, so avoid a
      // duplicate global notice while keeping the credential memory-only.
      clearPendingRecoveryKey();
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!newKey) return;
    try {
      await navigator.clipboard.writeText(newKey);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <main className="rf-app-page">
      <SiteNav />
      <div className="rf-app-shell max-w-3xl">
        <header className="rf-app-heading">
          <div>
            <p className="rf-eyebrow"><span /> RECUPERAÇÃO SEGURA</p>
            <h1>Recuperar conta</h1>
            <p>Use a chave que você salvou anteriormente. Se ela estiver correta, o RuneForge troca sua sessão e emite uma nova chave imediatamente.</p>
          </div>
        </header>

        <section className="rounded-2xl border border-cyan-300/20 bg-white/[0.025] p-5 sm:p-6">
          {!newKey ? (
            <>
              <label htmlFor="recovery-key-input" className="text-xs font-black uppercase tracking-[0.14em] text-cyan-200">
                Chave de recuperação
              </label>
              <textarea
                id="recovery-key-input"
                data-recovery-key-input="true"
                className="input mt-3 min-h-24 w-full resize-y"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Cole aqui sua chave de recuperação"
                autoComplete="off"
                spellCheck={false}
              />
              <p className="mt-2 text-xs leading-5 text-slate-500">
                A sessão atual só é substituída depois que a chave é validada. Uma tentativa inválida não apaga seu acesso atual.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  data-recover-account-submit="true"
                  className="rf-button rf-button-primary"
                  disabled={loading || !input.trim()}
                  onClick={() => void recover()}
                >
                  {loading ? "VALIDANDO…" : "RECUPERAR CONTA"}
                </button>
                <Link href="/profile" className="rf-button rf-button-secondary">VOLTAR AO PERFIL</Link>
              </div>
            </>
          ) : (
            <>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-300/70">CONTA RECUPERADA</p>
              <h2 className="mt-1 text-xl font-black text-slate-50">{playerName}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Salve a nova chave abaixo. A chave anterior não funciona mais e esta nova chave também não será persistida no navegador.
              </p>
              <code
                data-recovered-replacement-key="true"
                className="mt-4 block select-all break-all rounded-lg border border-emerald-300/20 bg-black/35 px-3 py-3 text-xs text-emerald-100"
              >
                {newKey}
              </code>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" className="rf-button rf-button-secondary" onClick={() => void copy()}>
                  {copied ? "COPIADO" : "COPIAR NOVA CHAVE"}
                </button>
                <Link href="/profile" className="rf-button rf-button-primary">IR PARA O PERFIL</Link>
              </div>
            </>
          )}
          {message && <p className="mt-4 text-sm text-amber-200" role="status">{message}</p>}
        </section>
      </div>
    </main>
  );
}
