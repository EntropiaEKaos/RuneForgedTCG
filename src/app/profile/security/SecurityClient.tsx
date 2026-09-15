"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import SiteNav from "@/components/SiteNav";
import { PRODUCT_BRAND } from "@/lib/product-brand";

type ProviderName = "google" | "discord" | "email";
type IdentitySummary = {
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: string;
  lastLoginAt: string;
};
type ProviderState = {
  provider: ProviderName;
  available: boolean;
  linked: boolean;
  identity: IdentitySummary | null;
};

type Payload = {
  ok: boolean;
  error?: string;
  player?: { id: number; name: string };
  providers?: ProviderState[];
};

const LABELS: Record<ProviderName, { title: string; copy: string; glyph: string }> = {
  google: { title: "Google", copy: "Use sua Conta Google para entrar sem criar outra senha.", glyph: "G" },
  discord: { title: "Discord", copy: "Vincule sua identidade do Discord ao mesmo forjador.", glyph: "D" },
  email: { title: "E-mail", copy: "Receba um magic link de uso único, com expiração em 15 minutos.", glyph: "@" },
};

export default function SecurityClient() {
  const router = useRouter();
  const [providers, setProviders] = useState<ProviderState[]>([]);
  const [player, setPlayer] = useState<{ id: number; name: string } | null>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [unauthorized, setUnauthorized] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/auth/identities", { cache: "no-store", credentials: "include" });
      if (response.status === 401) {
        setUnauthorized(true);
        setProviders([]);
        setPlayer(null);
        return;
      }
      const payload = await response.json() as Payload;
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Não foi possível carregar a segurança da conta.");
      setUnauthorized(false);
      setPlayer(payload.player ?? null);
      setProviders(payload.providers ?? []);
      const params = new URLSearchParams(window.location.search);
      const linked = params.get("auth");
      if (linked) setMessage(`${linked === "email" ? "E-mail" : linked[0]?.toUpperCase() + linked.slice(1)} vinculado à sua conta.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível carregar a segurança da conta.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const oauth = (provider: "google" | "discord") => {
    router.push(`/api/auth/oauth/${provider}/start?returnTo=${encodeURIComponent("/profile/security")}`);
  };

  const sendMagicLink = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/email/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, returnTo: "/profile/security" }),
      });
      const payload = await response.json().catch(() => ({})) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Não foi possível enviar o magic link.");
      setMessage("Magic link enviado. Abra o e-mail neste navegador para concluir a vinculação.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível enviar o magic link.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="rf-app-page">
      <SiteNav />
      <div className="rf-app-shell max-w-5xl">
        <header className="rf-app-heading">
          <div>
            <p className="rf-eyebrow"><span /> ACESSO & SEGURANÇA</p>
            <h1>Identidades vinculadas</h1>
            <p>Proteja o mesmo forjador com métodos de entrada diferentes sem mover cartas, decks, progressão, ouro ou MMR.</p>
          </div>
          <Link href="/profile" className="rf-button rf-button-secondary">← VOLTAR AO PERFIL</Link>
        </header>

        {message && <div className="mb-5 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] px-4 py-3 text-sm text-amber-100" role="status" aria-live="polite">{message}</div>}

        {loading && (
          <section className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-14 text-center" aria-busy="true">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-amber-300" aria-hidden="true" />
            <p className="font-bold text-slate-200">Verificando suas identidades…</p>
          </section>
        )}

        {!loading && unauthorized && (
          <section className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.04] p-7 text-center">
            <p className="rf-eyebrow justify-center"><span /> IDENTIDADE NECESSÁRIA</p>
            <h2 className="mt-3 text-2xl font-black text-white">Entre na Forja primeiro.</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-400">A vinculação só pode acontecer depois que uma sessão de jogador estiver ativa.</p>
            <Link href="/play" className="rf-button rf-button-primary mt-6">ENTRAR NA FORJA</Link>
          </section>
        )}

        {!loading && !unauthorized && player && (
          <>
            <section className="mb-5 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.035] p-5">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-cyan-300/65">FORJADOR PROTEGIDO</p>
              <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-black text-white">{player.name}</h2>
                  <p className="mt-1 text-xs text-slate-500">Player ID {player.id} · todas as identidades abaixo apontam para este mesmo registro.</p>
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-200">{PRODUCT_BRAND.displayName} IDENTITY 1.0</span>
              </div>
            </section>

            <div className="grid gap-4 lg:grid-cols-3">
              {providers.map((entry) => {
                const meta = LABELS[entry.provider];
                return (
                  <article key={entry.provider} className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex gap-3">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-black/25 font-black text-amber-200" aria-hidden="true">{meta.glyph}</span>
                        <div>
                          <h2 className="font-black text-white">{meta.title}</h2>
                          <p className="mt-1 text-xs leading-5 text-slate-500">{meta.copy}</p>
                        </div>
                      </div>
                      <span className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${entry.linked ? "border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-200" : entry.available ? "border-amber-300/20 bg-amber-300/[0.05] text-amber-200" : "border-white/10 text-slate-600"}`}>
                        {entry.linked ? "Vinculado" : entry.available ? "Disponível" : "Indisponível"}
                      </span>
                    </div>

                    {entry.identity && (
                      <div className="mt-4 rounded-xl border border-white/[0.07] bg-black/20 p-3 text-xs text-slate-400">
                        <p className="font-bold text-slate-200">{entry.identity.displayName || entry.identity.email || meta.title}</p>
                        {entry.identity.email && <p className="mt-1 break-all">{entry.identity.email}{entry.identity.emailVerified ? " · verificado" : ""}</p>}
                        <p className="mt-1 text-slate-600">Último acesso: {new Date(entry.identity.lastLoginAt).toLocaleString("pt-BR")}</p>
                      </div>
                    )}

                    {entry.provider !== "email" && (
                      <button
                        type="button"
                        className="rf-button rf-button-secondary mt-5 w-full justify-center"
                        disabled={!entry.available || entry.linked || busy}
                        onClick={() => oauth(entry.provider)}
                      >
                        {entry.linked ? `${meta.title.toUpperCase()} VINCULADO` : `VINCULAR ${meta.title.toUpperCase()}`}
                      </button>
                    )}

                    {entry.provider === "email" && !entry.linked && (
                      <form className="mt-5" onSubmit={sendMagicLink}>
                        <label htmlFor="security-email" className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">Seu e-mail</label>
                        <input id="security-email" className="input mt-2 w-full" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@email.com" autoComplete="email" />
                        <button type="submit" className="rf-button rf-button-secondary mt-2 w-full justify-center" disabled={!entry.available || busy || !email.trim()}>
                          {busy ? "ENVIANDO…" : "VINCULAR POR E-MAIL"}
                        </button>
                      </form>
                    )}
                  </article>
                );
              })}
            </div>

            <section className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5">
              <h2 className="font-black text-slate-100">Contrato de segurança</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">Vincular uma identidade não cria um segundo inventário e não transfere recursos. O provedor serve apenas para provar acesso ao mesmo <code className="text-cyan-200">playerId</code>. Segredos dos provedores ficam no Vault administrativo e nunca são enviados para esta tela.</p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
