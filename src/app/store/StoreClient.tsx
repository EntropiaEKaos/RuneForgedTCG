"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import SiteNav from "@/components/SiteNav";
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

interface PaidProduct {
  key: string;
  name: string;
  priceCents: number | string;
  currency?: string;
  grants?: {
    gold?: number;
    dust?: number;
    packs?: Array<{ count?: number | string }>;
  };
}

interface PaidData {
  gateway: { enabled: boolean; environment?: string };
  products: PaidProduct[];
}

const RARITY_COLOR: Record<Rarity, string> = {
  Common: "border-slate-500/50 bg-slate-500/10",
  Rare: "border-blue-400/60 bg-blue-500/15",
  Epic: "border-purple-400/60 bg-purple-500/15 shadow-lg shadow-purple-500/15",
  Legend: "border-amber-400/70 bg-amber-500/15 shadow-lg shadow-amber-500/20",
};

const RARITY_TEXT: Record<Rarity, string> = {
  Common: "text-slate-300",
  Rare: "text-blue-300",
  Epic: "text-purple-300",
  Legend: "text-amber-300",
};

const RARITY_LABEL: Record<Rarity, string> = {
  Common: "Comum",
  Rare: "Rara",
  Epic: "Épica",
  Legend: "Lendária",
};

export default function StoreClient() {
  const [playerName, setPlayerName] = useState("");
  const [packs, setPacks] = useState<PacksData | null>(null);
  const [loginData, setLoginData] = useState<LoginData | null>(null);
  const [message, setMessage] = useState("");
  const [reveal, setReveal] = useState<RevealedCard[] | null>(null);
  const [dustBonus, setDustBonus] = useState(0);
  const [busy, setBusy] = useState(false);
  const [paid, setPaid] = useState<PaidData>({ gateway: { enabled: false }, products: [] });

  const load = useCallback(async (name: string) => {
    try {
      const profile = await ensurePlayerSession(name);
      const resolvedName = profile.player?.name ? String(profile.player.name) : name;
      if (resolvedName) setPlayerName(resolvedName);
      const [pRes, lRes, payRes] = await Promise.all([
        fetch(`/api/packs?name=${encodeURIComponent(resolvedName)}`),
        fetch(`/api/login-reward?name=${encodeURIComponent(resolvedName)}`),
        fetch("/api/payments/products"),
      ]);
      const p = await pRes.json();
      const l = await lRes.json();
      const pay = await payRes.json();
      if (pay.ok) setPaid(pay as PaidData);
      if (p.ok) setPacks(p as PacksData);
      if (l.ok) setLoginData(l as LoginData);
    } catch {
      // Individual actions surface their own messages; keep passive refresh quiet.
    }
  }, []);

  useDeferredEffect(() => {
    void load(localStorage.getItem("runeforge_playername") || "");
  }, [load]);

  useDeferredEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const order = params.get("order");
    const payment = params.get("payment");
    if (!order || !playerName) return;
    let cancelled = false;
    let attempts = 0;
    const poll = async () => {
      attempts += 1;
      try {
        if (attempts === 1 || attempts % 5 === 0) {
          await fetch("/api/payments/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ order }),
          }).catch(() => null);
        }
        const response = await fetch(`/api/payments/orders?order=${encodeURIComponent(order)}`, { cache: "no-store" });
        const data = await response.json();
        const row = data.ok ? data.orders?.[0] : null;
        if (cancelled) return;
        if (row?.status === "approved" && row?.fulfilledAt) {
          setMessage(`✅ Pagamento confirmado · ${row.productName} entregue.`);
          await load(playerName);
          return;
        }
        if (["rejected", "cancelled", "refunded", "charged_back"].includes(String(row?.status))) {
          setMessage(`❌ Pagamento ${row.status}. Nenhum item foi entregue.`);
          return;
        }
        if (attempts < 30) {
          window.setTimeout(poll, 2000);
        } else {
          setMessage(payment === "success" ? "⏳ Pagamento recebido; aguardando confirmação segura do Mercado Pago." : `⏳ Pagamento ${payment || "pendente"}.`);
        }
      } catch {
        if (!cancelled && attempts < 30) window.setTimeout(poll, 2000);
      }
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
      } else {
        setMessage(`❌ ${data.error}`);
      }
    } catch {
      setMessage("⏳ Não foi possível confirmar a compra. Tente novamente; a mesma operação será reutilizada com segurança.");
    } finally {
      setBusy(false);
    }
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
      } else {
        setMessage(`❌ ${data.error}`);
      }
    } catch {
      setMessage("⏳ Não foi possível confirmar a abertura. Tente novamente; o mesmo resultado será recuperado com segurança.");
    } finally {
      setBusy(false);
    }
  };

  const checkout = async (productKey: string) => {
    setBusy(true);
    setMessage("");
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
          if (data.ok && data.checkoutUrl) {
            window.location.assign(data.checkoutUrl);
            return;
          }
          if (data.code === "CHECKOUT_IN_PROGRESS" && attempt < 2) {
            await new Promise((resolve) => window.setTimeout(resolve, 650));
            continue;
          }
          setMessage(`❌ ${data.error || "Falha ao iniciar Mercado Pago"}`);
          return;
        } catch {
          if (attempt >= 2) throw new Error("Falha de rede ao iniciar checkout");
          await new Promise((resolve) => window.setTimeout(resolve, 650));
        }
      }
    } catch (error) {
      setMessage(`❌ ${error instanceof Error ? error.message : "Falha ao iniciar Mercado Pago"}`);
    } finally {
      setBusy(false);
    }
  };

  const claimLogin = async () => {
    setBusy(true);
    try {
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
        setMessage(`⏳ Volte em ${data.nextClaimIn}h. Sequência atual: ${data.currentStreak}`);
      } else {
        setMessage(`❌ ${data.error}`);
      }
    } catch {
      setMessage("❌ Não foi possível sincronizar a recompensa diária.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="rf-app-page">
      <SiteNav />
      <div className="rf-app-shell max-w-6xl">
        <header className="rf-app-heading">
          <div>
            <p className="rf-eyebrow"><span /> CÂMARA DE SUPRIMENTOS</p>
            <h1>Loja da Forja</h1>
            <p>Converta progresso em pacotes, resgate recompensas e acesse conteúdo premium com confirmação financeira autoritativa.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/collection" className="rf-button rf-button-secondary">▦ COLEÇÃO</Link>
            <Link href="/album" className="rf-button rf-button-primary">◇ ÁLBUM</Link>
          </div>
        </header>

        {message && (
          <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] px-4 py-3 text-sm text-amber-100" role="status" aria-live="polite">
            <span>{message}</span>
            <button className="text-xs font-bold text-amber-200 underline underline-offset-4" onClick={() => setMessage("")}>Fechar</button>
          </div>
        )}

        <section className="mb-8 grid gap-3 sm:grid-cols-3" aria-label="Carteira e identidade">
          <WalletCard label="Ouro" value={packs?.player.gold ?? "—"} icon="🪙" tone="text-amber-200" />
          <WalletCard label="Pó arcano" value={packs?.player.dust ?? "—"} icon="💠" tone="text-cyan-200" />
          <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-600">Identidade de compra</p>
            <p className="mt-2 truncate text-lg font-black text-slate-100">{playerName || "Sincronizando…"}</p>
            <Link href="/profile" className="mt-1 inline-block text-[10px] font-black uppercase tracking-[0.1em] text-amber-200 hover:text-amber-100">GERENCIAR PERFIL →</Link>
          </div>
        </section>

        {paid.gateway.enabled && paid.products.length > 0 && (
          <section className="mb-8 rounded-2xl border border-cyan-300/20 bg-[linear-gradient(135deg,rgba(34,211,238,.07),rgba(3,5,8,.62))] p-5 sm:p-6" aria-labelledby="premium-heading">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-2xl">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-cyan-300/65">CHECKOUT SEGURO</p>
                <h2 id="premium-heading" className="mt-1 text-xl font-black text-slate-100">Conteúdo premium · Mercado Pago</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">A entrega acontece somente após confirmação assinada do pagamento. Retentativas de checkout reutilizam a mesma chave de idempotência da tentativa.</p>
              </div>
              <span className="self-start rounded-full border border-cyan-300/15 bg-cyan-300/[0.06] px-3 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-cyan-200">{paid.gateway.environment || "gateway ativo"}</span>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {paid.products.map((product) => (
                <article key={product.key} className="rounded-xl border border-white/10 bg-black/25 p-4">
                  <h3 className="font-black text-slate-100">{product.name}</h3>
                  <p className="mt-1 min-h-5 text-xs leading-5 text-slate-500">{grantSummary(product)}</p>
                  <div className="mt-4 flex items-end justify-between gap-3 border-t border-white/[0.07] pt-3">
                    <strong className="text-xl text-cyan-200">{formatMoney(product.priceCents, product.currency || "BRL")}</strong>
                    <button className="rf-button rf-button-primary min-h-9 !px-4" disabled={busy || !playerName} onClick={() => void checkout(product.key)}>
                      {busy ? "PROCESSANDO…" : "COMPRAR"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {loginData && (
          <section className="mb-8 overflow-hidden rounded-2xl border border-emerald-300/20 bg-[linear-gradient(135deg,rgba(16,185,129,.075),rgba(3,5,8,.58))] p-5 sm:p-6" aria-labelledby="daily-reward-heading">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-300/65">RITUAL DE RETORNO</p>
                <h2 id="daily-reward-heading" className="mt-1 text-xl font-black text-slate-100">Recompensa diária</h2>
                <p className="mt-2 text-sm text-slate-400">Sequência atual: <span className="font-bold text-emerald-200">{loginData.streak} dia(s)</span></p>
              </div>
              <button onClick={() => void claimLogin()} disabled={!loginData.canClaim || busy} className="rf-button rf-button-secondary min-h-10 disabled:cursor-not-allowed disabled:opacity-45">
                {loginData.canClaim ? "🎁 COLETAR RECOMPENSA" : "✓ COLETADO HOJE"}
              </button>
            </div>

            <div className="mt-5 overflow-x-auto pb-1">
              <div className="grid min-w-[620px] grid-cols-7 gap-2">
                {loginData.allRewards.map((reward) => {
                  const done = reward.day <= ((loginData.streak - 1) % 7) + (loginData.canClaim ? 0 : 1);
                  const isNext = reward.day === (loginData.streak % 7) + 1 && loginData.canClaim;
                  return (
                    <div key={reward.day} className={`rounded-xl border p-3 text-center ${done ? "border-emerald-300/20 bg-emerald-500/[0.08]" : isNext ? "border-amber-300/30 bg-amber-300/[0.08] shadow-[0_0_24px_rgba(251,191,36,.08)]" : "border-white/[0.07] bg-white/[0.025] opacity-60"}`}>
                      <p className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-500">Dia {reward.day}</p>
                      <p className="mt-2 text-2xl" aria-hidden="true">{reward.icon}</p>
                      <p className="mt-2 text-[10px] font-bold text-slate-300">{reward.gold}🪙</p>
                      {reward.dust > 0 && <p className="text-[10px] text-cyan-300">{reward.dust}💠</p>}
                      {reward.pack && <p className="mt-1 text-[9px] font-black uppercase text-purple-300">Pacote</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        <section aria-labelledby="packs-heading">
          <div className="mb-4 flex flex-col gap-2 border-b border-white/10 pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-300/65">ARSENAL COLECIONÁVEL</p>
              <h2 id="packs-heading" className="mt-1 text-2xl font-black text-slate-100">Pacotes de cartas</h2>
            </div>
            <p className="max-w-lg text-xs leading-5 text-slate-500">Compras com ouro e aberturas usam IDs de operação reaproveitáveis para impedir consumo duplicado em retentativas.</p>
          </div>

          {!packs ? (
            <EmptyState busy title="Sincronizando a loja…" copy="Carregando carteira, inventário de pacotes e probabilidades." />
          ) : packs.packs.length === 0 ? (
            <EmptyState title="Nenhum pacote disponível" copy="O catálogo de pacotes ainda não possui ofertas ativas." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {packs.packs.map((pack) => (
                <article key={pack.id} className={`relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${pack.color} p-5 shadow-[0_22px_55px_rgba(0,0,0,.2)]`}>
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" aria-hidden="true" />
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-4xl" aria-hidden="true">{pack.icon}</div>
                      <h3 className="mt-2 text-lg font-black text-white">{pack.name}</h3>
                      <p className="mt-1 text-xs leading-5 text-white/65">{pack.description}</p>
                    </div>
                    {pack.owned > 0 && <span className="rounded-full border border-white/15 bg-black/25 px-2.5 py-1 text-[10px] font-black text-white">×{pack.owned}</span>}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl border border-white/[0.08] bg-black/20 p-3 text-xs">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.1em] text-white/45">Conteúdo</p>
                      <p className="mt-1 font-black text-white">{pack.cardsCount} cartas</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.1em] text-white/45">Preço</p>
                      <p className="mt-1 font-black text-amber-100">{pack.price} 🪙</p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-1.5">
                    {(["Common", "Rare", "Epic", "Legend"] as Rarity[]).map((rarity) => (
                      <div key={rarity} className="flex items-center justify-between text-[10px]">
                        <span className={RARITY_TEXT[rarity]}>{RARITY_LABEL[rarity]}</span>
                        <span className="font-bold text-white/70">{(pack.dropRates[rarity] * 100).toFixed(0)}%</span>
                      </div>
                    ))}
                    {pack.guaranteedRarity && <p className="pt-1 text-[10px] font-black uppercase tracking-[0.08em] text-amber-100">Garantia: {RARITY_LABEL[pack.guaranteedRarity]}+</p>}
                  </div>

                  <div className="mt-5 grid gap-2">
                    <button onClick={() => void buyPack(pack.id)} disabled={packs.player.gold < pack.price || busy || !playerName} className="rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-xs font-black text-white transition hover:bg-black/45 disabled:cursor-not-allowed disabled:opacity-35">
                      COMPRAR · {pack.price} 🪙
                    </button>
                    {pack.owned > 0 && (
                      <button onClick={() => void openPack(pack.id)} disabled={busy || !playerName} className="rf-button rf-button-primary min-h-10 w-full">
                        ✦ ABRIR PACOTE
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {reveal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-4 backdrop-blur-sm" onClick={() => setReveal(null)}>
          <section
            className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-amber-300/20 bg-[#090d14] p-5 shadow-[0_40px_120px_rgba(0,0,0,.65)] sm:p-7"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pack-reveal-heading"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-300/65">ABERTURA CONFIRMADA</p>
                <h2 id="pack-reveal-heading" className="mt-1 text-2xl font-black text-amber-100">Cartas reveladas</h2>
              </div>
              <button className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black text-slate-300 hover:bg-white/[0.08]" onClick={() => setReveal(null)} aria-label="Fechar cartas reveladas">✕</button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
              {reveal.map((card, index) => (
                <article key={`${card.defId}-${index}`} className={`motion-safe:animate-pop rounded-xl border p-3 text-center ${RARITY_COLOR[card.rarity]}`} style={{ animationDelay: `${index * 120}ms` }}>
                  <div className="text-3xl" aria-hidden="true">{card.emoji}</div>
                  <p className="mt-2 truncate text-sm font-bold text-slate-100" title={card.name}>{card.name}</p>
                  <p className={`mt-1 text-[10px] font-black uppercase tracking-[0.08em] ${RARITY_TEXT[card.rarity]}`}>{RARITY_LABEL[card.rarity]}</p>
                  <p className="mt-1 text-[10px] text-slate-500">{card.region} · {card.cost}⚡</p>
                </article>
              ))}
            </div>

            {dustBonus > 0 && <p className="mt-5 rounded-xl border border-cyan-300/15 bg-cyan-500/[0.06] px-4 py-3 text-center text-sm font-bold text-cyan-200">💠 +{dustBonus} pó arcano de duplicatas convertidas</p>}
            <button onClick={() => setReveal(null)} className="rf-button rf-button-primary mx-auto mt-5">CONTINUAR</button>
          </section>
        </div>
      )}
    </main>
  );
}

function WalletCard({ label, value, icon, tone }: { label: string; value: string | number; icon: string; tone: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-600">{label}</p>
        <span aria-hidden="true">{icon}</span>
      </div>
      <p className={`mt-2 text-2xl font-black ${tone}`}>{value}</p>
    </div>
  );
}

function EmptyState({ title, copy, busy = false }: { title: string; copy: string; busy?: boolean }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-12 text-center" aria-busy={busy || undefined}>
      {busy ? <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-amber-300" aria-hidden="true" /> : <div className="text-3xl text-amber-200/65" aria-hidden="true">◇</div>}
      <p className="mt-3 font-bold text-slate-300">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-500">{copy}</p>
    </div>
  );
}

function formatMoney(priceCents: number | string, currency: string) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(Number(priceCents) / 100);
}

function grantSummary(product: PaidProduct) {
  const parts: string[] = [];
  if (product.grants?.gold) parts.push(`+${product.grants.gold} ouro`);
  if (product.grants?.dust) parts.push(`+${product.grants.dust} pó arcano`);
  if (Array.isArray(product.grants?.packs)) {
    const count = product.grants.packs.reduce((sum, pack) => sum + Number(pack.count || 0), 0);
    if (count > 0) parts.push(`${count} pacote${count === 1 ? "" : "s"}`);
  }
  return parts.join(" · ") || "Conteúdo premium da Forja";
}
