"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import type { Rarity } from "@/game/types";
import type { LoginReward, PackDef } from "@/lib/packs";
import { ensurePlayerSession } from "@/lib/client-player-session";
import { pendingEconomyOperationId, settleEconomyOperation } from "@/lib/client-economy-operation";

interface PacksData {
  player: { gold: number; dust: number };
  packs: (PackDef & { owned: number })[];
}

interface LoginData {
  canClaim: boolean;
  streak: number;
  nextReward: LoginReward;
  allRewards: LoginReward[];
}

interface RevealedCard {
  defId: string;
  rarity: Rarity;
  name: string;
  region: string;
  emoji: string;
  cost: number;
}

const RARITY_COLOR: Record<Rarity, string> = {
  Common: "border-slate-500 bg-slate-500/10",
  Rare: "border-blue-400 bg-blue-500/20",
  Epic: "border-purple-400 bg-purple-500/20 shadow-lg shadow-purple-500/30",
  Legend: "border-amber-400 bg-amber-500/20 shadow-lg shadow-amber-500/40 animate-pulse",
};

const RARITY_TEXT: Record<Rarity, string> = {
  Common: "text-slate-300",
  Rare: "text-blue-300",
  Epic: "text-purple-300",
  Legend: "text-amber-300",
};

export default function StoreClient() {
  const [playerName, setPlayerName] = useState("");
  const [packs, setPacks] = useState<PacksData | null>(null);
  const [loginData, setLoginData] = useState<LoginData | null>(null);
  const [message, setMessage] = useState("");
  const [reveal, setReveal] = useState<RevealedCard[] | null>(null);
  const [dustBonus, setDustBonus] = useState(0);
  const [busy, setBusy] = useState(false);
  const [paid, setPaid] = useState<any>({ gateway: { enabled: false }, products: [] });

  useDeferredEffect(() => {
    const saved = localStorage.getItem("runeforge_playername");
    if (saved) setPlayerName(saved);
  }, []);

  const load = useCallback(async (name: string) => {
    try {
      const profile = await ensurePlayerSession(name);
      if (profile.player?.name) setPlayerName(String(profile.player.name));
      const [pRes, lRes, payRes] = await Promise.all([
        fetch(`/api/packs?name=${encodeURIComponent(name)}`),
        fetch(`/api/login-reward?name=${encodeURIComponent(name)}`),
        fetch(`/api/payments/products`),
      ]);
      const p = await pRes.json();
      const l = await lRes.json();
      const pay = await payRes.json();
      if (pay.ok) setPaid(pay);
      if (p.ok) setPacks(p);
      if (l.ok) setLoginData(l);
    } catch {}
  }, []);

  useDeferredEffect(() => {
    load(playerName);
  }, [playerName, load]);

  useDeferredEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const order = params.get("order");
    const payment = params.get("payment");
    if (!order) return;
    let cancelled = false;
    let attempts = 0;
    const poll = async () => {
      attempts += 1;
      try {
        if (attempts === 1 || attempts % 5 === 0) {
          await fetch("/api/payments/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order }) }).catch(() => null);
        }
        const r = await fetch(`/api/payments/orders?order=${encodeURIComponent(order)}`, { cache: "no-store" });
        const d = await r.json();
        const row = d.ok ? d.orders?.[0] : null;
        if (cancelled) return;
        if (row?.status === "approved" && row?.fulfilledAt) { setMessage(`✅ Pagamento confirmado · ${row.productName} entregue.`); await load(playerName); return; }
        if (["rejected","cancelled","refunded","charged_back"].includes(String(row?.status))) { setMessage(`❌ Pagamento ${row.status}. Nenhum item foi entregue.`); return; }
        if (attempts < 30) { window.setTimeout(poll, 2000); }
        else setMessage(payment === "success" ? "⏳ Pagamento recebido; aguardando confirmação segura do Mercado Pago." : `⏳ Pagamento ${payment || "pendente"}.`);
      } catch { if (!cancelled && attempts < 30) window.setTimeout(poll, 2000); }
    };
    void poll();
    return () => { cancelled = true; };
  }, [load, playerName]);

  const buyPack = async (packId: string) => {
    setBusy(true);
    const fingerprint = `buy:${packId}`;
    const operationId = pendingEconomyOperationId(fingerprint);
    try {
      const res = await fetch("/api/packs", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Operation-Id": operationId },
        body: JSON.stringify({ name: playerName, action: "buy", packId, operationId }),
      });
      settleEconomyOperation(fingerprint, res.status);
      const data = await res.json();
      if (data.ok) {
        setMessage(data.duplicate ? "✅ Compra já confirmada; estado sincronizado." : "✅ Pacote comprado!");
        await load(playerName);
      } else setMessage(`❌ ${data.error}`);
    } catch {
      setMessage("⏳ Não foi possível confirmar a compra. Tente novamente; a mesma operação será reutilizada com segurança.");
    } finally { setBusy(false); }
  };

  const openPack = async (packId: string) => {
    setBusy(true);
    const fingerprint = `open:${packId}`;
    const operationId = pendingEconomyOperationId(fingerprint);
    try {
      const res = await fetch("/api/packs", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Operation-Id": operationId },
        body: JSON.stringify({ name: playerName, action: "open", packId, operationId }),
      });
      settleEconomyOperation(fingerprint, res.status);
      const data = await res.json();
      if (data.ok) {
        setReveal(data.cards);
        setDustBonus(data.dustBonus);
        if (data.duplicate) setMessage("✅ Abertura já confirmada; resultado recuperado sem consumir outro pacote.");
        await load(playerName);
      } else setMessage(`❌ ${data.error}`);
    } catch {
      setMessage("⏳ Não foi possível confirmar a abertura. Tente novamente; o mesmo resultado será recuperado com segurança.");
    } finally { setBusy(false); }
  };

  const checkout = async (productKey: string) => {
    setBusy(true); setMessage("");
    const requestKey = crypto.randomUUID();
    try {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const res = await fetch("/api/payments/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Idempotency-Key": requestKey },
            body: JSON.stringify({ productKey }),
          });
          const data = await res.json();
          if (data.ok && data.checkoutUrl) { window.location.assign(data.checkoutUrl); return; }
          if (data.code === "CHECKOUT_IN_PROGRESS" && attempt < 2) { await new Promise((resolve) => window.setTimeout(resolve, 650)); continue; }
          setMessage(`❌ ${data.error || "Falha ao iniciar Mercado Pago"}`);
          return;
        } catch {
          if (attempt >= 2) throw new Error("Falha de rede ao iniciar checkout");
          await new Promise((resolve) => window.setTimeout(resolve, 650));
        }
      }
    } catch (error) { setMessage(`❌ ${error instanceof Error ? error.message : "Falha ao iniciar Mercado Pago"}`); }
    finally { setBusy(false); }
  };

  const claimLogin = async () => {
    setBusy(true);
    const res = await fetch("/api/login-reward", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: playerName }),
    });
    const data = await res.json();
    if (data.ok) {
      setMessage(`🎉 Recompensa Dia ${data.streak}: +${data.reward.gold}🪙 +${data.reward.dust}💠${data.reward.pack ? " + Pacote" : ""}`);
      await load(playerName);
    } else if (data.currentStreak !== undefined) {
      setMessage(`⏳ Volte em ${data.nextClaimIn}h. Streak atual: ${data.currentStreak}`);
    } else {
      setMessage(`❌ ${data.error}`);
    }
    setBusy(false);
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,#1e293b,#0f172a_55%,#020617)] px-4 py-6 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-4">
            <Link href="/" className="text-sm text-slate-400 hover:text-white">← Home</Link>
            <Link href="/collection" className="text-sm text-slate-400 hover:text-white">Coleção</Link>
            <Link href="/album" className="text-sm text-slate-400 hover:text-white">Álbum</Link>
            <Link href="/profile" className="text-sm text-slate-400 hover:text-white">Perfil</Link>
            <Link href="/ranked" className="text-sm text-slate-400 hover:text-white">Ranked</Link>
          </div>
          <div className="flex items-center gap-3">
            {packs && (
              <>
                <span className="rounded bg-amber-500/20 px-3 py-1 text-sm font-bold text-amber-300">
                  🪙 {packs.player.gold}
                </span>
                <span className="rounded bg-cyan-500/20 px-3 py-1 text-sm font-bold text-cyan-300">
                  💠 {packs.player.dust}
                </span>
              </>
            )}
            <input
              className="input max-w-[180px]"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onBlur={() => { void ensurePlayerSession(playerName).then((profile) => { if (profile.player?.name) setPlayerName(String(profile.player.name)); }); }}
            />
          </div>
        </div>

        <h1 className="mb-4 text-3xl font-black text-amber-300">🎁 Loja</h1>

        {message && (
          <div className="mb-4 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
            {message}
            <button className="ml-3 text-xs underline" onClick={() => setMessage("")}>dismiss</button>
          </div>
        )}


        {paid?.gateway?.enabled && paid.products?.length > 0 && (
          <section className="mb-6 rounded-2xl border border-cyan-400/30 bg-cyan-400/[.05] p-4">
            <div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-black text-cyan-200">💳 Conteúdo premium · Mercado Pago</h2><p className="text-xs text-slate-400">A entrega ocorre somente após confirmação assinada do pagamento.</p></div><span className="rounded bg-white/5 px-2 py-1 text-[10px] uppercase text-slate-400">{paid.gateway.environment}</span></div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">{paid.products.map((p:any)=><div key={p.key} className="rounded-xl border border-white/10 bg-slate-950/40 p-4"><h3 className="font-black">{p.name}</h3><p className="mt-1 text-xs text-slate-400">{p.grants?.gold?`+${p.grants.gold} gold · `:""}{p.grants?.dust?`+${p.grants.dust} dust · `:""}{Array.isArray(p.grants?.packs)?`${p.grants.packs.reduce((a:number,x:any)=>a+Number(x.count||0),0)} packs`:""}</p><div className="mt-3 flex items-center justify-between"><b className="text-xl text-cyan-200">{new Intl.NumberFormat("pt-BR",{style:"currency",currency:p.currency||"BRL"}).format(Number(p.priceCents)/100)}</b><button className="btn-primary" disabled={busy} onClick={()=>checkout(p.key)}>Comprar</button></div></div>)}</div>
          </section>
        )}

        {/* Login Rewards */}
        {loginData && (
          <section className="mb-6 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-transparent p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-emerald-300">📅 Recompensa Diária</h2>
                <p className="text-xs text-slate-400">
                  Streak atual: {loginData.streak} dia(s)
                </p>
              </div>
              <button
                onClick={claimLogin}
                disabled={!loginData.canClaim || busy}
                className={`rounded-xl px-6 py-2 font-black transition ${
                  loginData.canClaim
                    ? "bg-emerald-500 text-white hover:bg-emerald-400 animate-pulse"
                    : "bg-slate-700 text-slate-500 cursor-not-allowed"
                }`}
              >
                {loginData.canClaim ? "🎁 Coletar Recompensa" : "⏳ Já coletado hoje"}
              </button>
            </div>
            <div className="mt-4 grid grid-cols-7 gap-1">
              {loginData.allRewards.map((r) => {
                const done = r.day <= ((loginData.streak - 1) % 7) + (loginData.canClaim ? 0 : 1);
                const isNext = r.day === (loginData.streak % 7) + 1 && loginData.canClaim;
                return (
                  <div
                    key={r.day}
                    className={`rounded-lg border p-2 text-center text-xs ${
                      done ? "border-emerald-400 bg-emerald-500/20"
                        : isNext ? "border-amber-400 bg-amber-500/20 animate-pulse"
                        : "border-white/10 bg-white/5 opacity-60"
                    }`}
                  >
                    <p className="text-[10px] font-bold text-slate-400">Dia {r.day}</p>
                    <p className="text-lg">{r.icon}</p>
                    <p className="text-[10px] font-bold">{r.gold}🪙</p>
                    {r.dust > 0 && <p className="text-[10px]">{r.dust}💠</p>}
                    {r.pack && <p className="text-[10px] font-bold text-purple-300">Pack</p>}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Packs */}
        {packs && (
          <section>
            <h2 className="mb-3 text-xl font-black text-amber-200">📦 Pacotes de Cartas</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {packs.packs.map((p) => (
                <div key={p.id} className={`rounded-2xl border-2 border-white/10 bg-gradient-to-br ${p.color} p-4`}>
                  <div className="text-center">
                    <div className="text-5xl">{p.icon}</div>
                    <h3 className="mt-2 text-lg font-black text-white">{p.name}</h3>
                    <p className="mt-1 text-xs text-white/80">{p.description}</p>
                    <p className="mt-2 text-xs text-white/70">
                      {p.cardsCount} cartas
                    </p>
                    <div className="mt-3 space-y-0.5 text-[10px] text-white/70">
                      {(["Common", "Rare", "Epic", "Legend"] as Rarity[]).map((r) => (
                        <p key={r}>{r}: {(p.dropRates[r] * 100).toFixed(0)}%</p>
                      ))}
                    </div>
                    {p.guaranteedRarity && (
                      <p className="mt-1 text-xs font-bold text-amber-200">
                        ⭐ Garantido: {p.guaranteedRarity}+
                      </p>
                    )}
                  </div>
                  <div className="mt-4 space-y-2">
                    {p.owned > 0 && (
                      <div className="rounded bg-white/20 py-1 text-center text-xs font-bold text-white">
                        Você possui: {p.owned}
                      </div>
                    )}
                    <button
                      onClick={() => buyPack(p.id)}
                      disabled={packs.player.gold < p.price || busy}
                      className="w-full rounded-lg bg-black/40 py-2 text-sm font-black text-white hover:bg-black/60 disabled:opacity-30"
                    >
                      💰 Comprar ({p.price} 🪙)
                    </button>
                    {p.owned > 0 && (
                      <button
                        onClick={() => openPack(p.id)}
                        disabled={busy}
                        className="w-full rounded-lg bg-amber-500 py-2 text-sm font-black text-slate-950 hover:bg-amber-400 disabled:opacity-30"
                      >
                        🎉 Abrir Pacote
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Pack Reveal Modal */}
        {reveal && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" onClick={() => setReveal(null)}>
            <div className="max-w-3xl rounded-2xl bg-slate-900 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <h2 className="mb-4 text-center text-2xl font-black text-amber-300">✨ Cartas Reveladas!</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                {reveal.map((c, i) => (
                  <div
                    key={i}
                    className={`animate-pop rounded-xl border-2 p-3 text-center ${RARITY_COLOR[c.rarity]}`}
                    style={{ animationDelay: `${i * 150}ms` }}
                  >
                    <div className="text-3xl">{c.emoji}</div>
                    <p className="mt-2 truncate text-sm font-bold">{c.name}</p>
                    <p className={`text-xs font-bold ${RARITY_TEXT[c.rarity]}`}>{c.rarity}</p>
                    <p className="text-[10px] text-slate-400">{c.region} • {c.cost}⚡</p>
                  </div>
                ))}
              </div>
              {dustBonus > 0 && (
                <p className="mt-4 text-center text-sm text-cyan-300">
                  💠 +{dustBonus} dust bônus (duplicatas convertidas)
                </p>
              )}
              <button
                onClick={() => setReveal(null)}
                className="btn-primary mx-auto mt-4 block"
              >
                Continuar
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
