"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import SiteNav from "@/components/SiteNav";
import {
  cosmeticDropChancePercent,
  replacePlayerCardCosmeticPreferences,
  resolveCardCosmeticPrestige,
} from "@/game/card-cosmetics";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";

interface WardrobeAsset {
  assetId: number;
  defId: string;
  cardName: string;
  cardRarity: string;
  cardRegion: string | null;
  emoji: string;
  variantId: string;
  frameId: string;
  finish: string;
  serialNumber: number | null;
  source: string;
  acquiredAt: string;
  cosmetic: null | {
    name: string;
    kind: string;
    artUrl: string | null;
    animationUrl: string | null;
    edition: string | null;
    serialLimit: number | null;
    acquisition: "pack" | "event" | "promotion" | "market" | "grant";
    packEligible: boolean;
    dropWeight: number;
  };
}

interface Preference {
  defId: string;
  assetId: number;
  variantId: string;
  frameId: string;
  finish: string;
  serialNumber?: number | null;
}

function chanceLabel(asset: WardrobeAsset) {
  const cosmetic = asset.cosmetic;
  if (!cosmetic || cosmetic.acquisition !== "pack" || !cosmetic.packEligible || cosmetic.dropWeight <= 0) return "Fora do pool normal de packs";
  const chance = cosmeticDropChancePercent(cosmetic.dropWeight);
  const digits = chance < 0.1 ? 3 : chance < 1 ? 2 : 1;
  return `${chance.toFixed(digits)}% nominal por cópia elegível`;
}

export default function CosmeticWardrobeClient() {
  const [assets, setAssets] = useState<WardrobeAsset[]>([]);
  const [preferences, setPreferences] = useState<Preference[]>([]);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/player/cosmetics", { cache: "no-store" });
    const data = await response.json();
    if (!data.ok) throw new Error(data.error || "Wardrobe unavailable");
    if (data.authenticated === false) {
      setAuthenticated(false);
      setAssets([]);
      setPreferences([]);
      replacePlayerCardCosmeticPreferences([]);
      return;
    }
    const nextAssets = Array.isArray(data.wardrobe) ? data.wardrobe as WardrobeAsset[] : [];
    const nextPreferences = Array.isArray(data.preferences) ? data.preferences as Preference[] : [];
    setAuthenticated(true);
    setAssets(nextAssets);
    setPreferences(nextPreferences);
    replacePlayerCardCosmeticPreferences(nextPreferences);
  }, []);

  useDeferredEffect(() => {
    let cancelled = false;
    void load()
      .catch(() => { if (!cancelled) setMessage("❌ Não foi possível carregar seu Ateliê."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [load]);

  const special = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return assets.filter((asset) => asset.variantId !== "standard" && asset.cosmetic)
      .filter((asset) => !needle || `${asset.cardName} ${asset.cosmetic?.name || ""} ${asset.variantId} ${asset.finish} ${asset.cosmetic?.edition || ""}`.toLowerCase().includes(needle));
  }, [assets, query]);
  const prefByDef = useMemo(() => new Map(preferences.map((item) => [item.defId, item])), [preferences]);
  const uniqueCards = useMemo(() => new Set(special.map((asset) => asset.defId)).size, [special]);
  const relics = useMemo(() => special.filter((asset) => resolveCardCosmeticPrestige(asset.cosmetic).id === "relic").length, [special]);

  const equip = async (asset: WardrobeAsset) => {
    setBusyId(asset.assetId);
    setMessage("");
    try {
      const response = await fetch("/api/player/cosmetics", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assetId: asset.assetId }) });
      const data = await response.json();
      if (!data.ok) { setMessage(`❌ ${data.error || "Não foi possível equipar a variante."}`); return; }
      await load();
      setMessage(`✨ ${asset.cosmetic?.name || asset.variantId} equipada em ${asset.cardName}.`);
    } catch {
      setMessage("❌ Não foi possível sincronizar a aparência.");
    } finally {
      setBusyId(null);
    }
  };

  const reset = async (defId: string, cardName: string) => {
    setBusyId(-1);
    setMessage("");
    try {
      const response = await fetch(`/api/player/cosmetics?defId=${encodeURIComponent(defId)}`, { method: "DELETE" });
      const data = await response.json();
      if (!data.ok) { setMessage(`❌ ${data.error || "Não foi possível voltar ao Standard."}`); return; }
      await load();
      setMessage(`✓ ${cardName} voltou para a aparência Standard.`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="rf-app-page cosmetic-wardrobe-page" aria-label="Ateliê de variantes cosméticas">
      <SiteNav />
      <div className="rf-app-shell">
        <header className="rf-app-heading cosmetic-wardrobe-hero">
          <div>
            <p className="rf-eyebrow"><span /> COLECIONÁVEIS COSMÉTICOS</p>
            <h1>Ateliê de Variantes</h1>
            <p>Escolha qual cópia visual de cada carta será exibida. Poder, custo, regras e legalidade continuam idênticos ao <code>defId</code> original.</p>
          </div>
          <div className="flex flex-wrap gap-2"><Link href="/collection" className="rf-button rf-button-secondary">← COLEÇÃO</Link><Link href="/market" className="rf-button rf-button-secondary">MARKETPLACE</Link><Link href="/store" className="rf-button rf-button-primary">PACKS</Link></div>
        </header>

        <section className="cosmetic-prestige-summary mb-5 grid gap-3 sm:grid-cols-4" aria-label="Resumo de prestígio cosmético">
          <Stat label="Cópias especiais" value={special.length} detail="assets cosméticos possuídos" />
          <Stat label="Cartas com variante" value={uniqueCards} detail="gameplay IDs distintos" />
          <Stat label="Equipadas" value={preferences.length} detail="preferências visuais ativas" />
          <Stat label="Relíquias" value={relics} detail="drops abaixo de 0,5%" />
        </section>

        <div className="cosmetic-authority-note mb-5 rounded-2xl border border-emerald-400/15 bg-emerald-400/[.05] p-4 text-sm text-slate-300"><b className="text-emerald-300">100% cosmético.</b> O prestígio visual é derivado da chance real de drop da variante e nunca altera raridade de gameplay, stats, efeitos, limite de cópias, matchmaking ou regras competitivas.</div>
        {message && <div className="mb-5 rounded-xl border border-amber-300/20 bg-amber-300/[.07] p-3 text-sm text-amber-100" role="status">{message}</div>}

        <div className="cosmetic-wardrobe-search mb-5 rounded-2xl border border-white/10 bg-slate-950/45 p-4"><input className="input w-full" placeholder="Buscar carta, variante, finish ou edição…" value={query} onChange={(event) => setQuery(event.target.value)} /></div>

        {loading ? <Empty title="Sincronizando Ateliê" text="Carregando suas cópias colecionáveis individuais." /> : authenticated === false ? <SessionRequired /> : special.length === 0 ? <Empty title="Nenhuma variante especial encontrada" text="Quando uma cópia Full Art, Foil, Premium, Animated ou Serialized entrar no seu inventário ela aparecerá aqui. Suas cartas Standard continuam intactas." /> : (
          <section className="cosmetic-wardrobe-grid grid gap-5 md:grid-cols-2 xl:grid-cols-3" aria-label="Variantes cosméticas possuídas">
            {special.map((asset) => {
              const cosmetic = asset.cosmetic!;
              const equipped = prefByDef.get(asset.defId)?.assetId === asset.assetId;
              const prestige = resolveCardCosmeticPrestige(cosmetic);
              const artStyle = cosmetic.artUrl ? { backgroundImage: `linear-gradient(rgba(2,6,23,.08),rgba(2,6,23,.82)),url(${JSON.stringify(cosmetic.artUrl)})`, backgroundSize: "cover", backgroundPosition: "center" } : {};
              return (
                <article key={asset.assetId} className={`cosmetic-wardrobe-card overflow-hidden rounded-3xl border bg-slate-950/60 shadow-xl ${equipped ? "is-equipped border-amber-300/65 ring-2 ring-amber-300/20" : "border-white/10"}`} data-cosmetic-prestige={prestige.id}>
                  <div className="cosmetic-wardrobe-art relative aspect-[16/10] bg-slate-900" style={artStyle}>
                    {!cosmetic.artUrl && <div className="grid h-full place-items-center text-5xl">{asset.emoji}</div>}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent p-4 pt-12"><div className="text-xs font-black uppercase tracking-[.18em] text-amber-300">{cosmetic.name}</div><h2 className="mt-1 text-xl font-black text-white">{asset.cardName}</h2></div>
                    <span className="cosmetic-prestige-badge absolute right-3 top-3 rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-[.12em]">{prestige.shortLabel}</span>
                    {asset.serialNumber && <span className="absolute right-3 top-11 rounded-full border border-amber-200/50 bg-black/75 px-2 py-1 text-xs font-black text-amber-200">#{asset.serialNumber}{cosmetic.serialLimit ? `/${cosmetic.serialLimit}` : ""}</span>}
                    {equipped && <span className="absolute left-3 top-3 rounded-full bg-emerald-400 px-2 py-1 text-[9px] font-black uppercase text-emerald-950">Equipada</span>}
                  </div>
                  <div className="p-4">
                    <div className="flex flex-wrap gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-300"><Tag>{cosmetic.kind.replaceAll("_", " ")}</Tag><Tag>{asset.finish}</Tag><Tag>{asset.frameId}</Tag>{cosmetic.edition && <Tag>{cosmetic.edition}</Tag>}</div>
                    <div className="cosmetic-prestige-readout mt-4 rounded-xl border border-white/10 bg-black/20 p-3"><div className="text-[9px] font-black uppercase tracking-[.16em]">Prestígio cosmético · {prestige.label}</div><div className="mt-1 text-xs text-slate-400">{chanceLabel(asset)}</div></div>
                    <dl className="mt-4 grid grid-cols-2 gap-3 text-xs"><Meta label="Origem" value={asset.source} /><Meta label="Aquisição" value={cosmetic.acquisition} /><Meta label="Asset" value={`#${asset.assetId}`} /><Meta label="Variant" value={asset.variantId} /></dl>
                    <div className="mt-4 flex gap-2"><button type="button" className={equipped ? "rf-button rf-button-secondary flex-1" : "rf-button rf-button-primary flex-1"} disabled={busyId !== null || equipped} onClick={() => void equip(asset)}>{equipped ? "EM USO" : busyId === asset.assetId ? "APLICANDO…" : "USAR ESTA VERSÃO"}</button>{equipped && <button type="button" className="rf-button rf-button-secondary" disabled={busyId !== null} onClick={() => void reset(asset.defId, asset.cardName)}>STANDARD</button>}</div>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}

function SessionRequired() {
  return <div className="rounded-3xl border border-dashed border-amber-300/20 bg-slate-950/35 px-6 py-16 text-center"><div className="text-5xl">◇</div><h2 className="mt-4 text-xl font-black text-white">Entre na Forja</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-400">O Ateliê mostra cópias cosméticas e preferências privadas da sua conta. Entre ou continue como convidado para carregar seu inventário.</p><Link href="/play" className="rf-button rf-button-primary mt-6 inline-flex">ENTRAR NA FORJA</Link></div>;
}
function Tag({ children }: { children: React.ReactNode }) { return <span className="rounded-full border border-white/10 bg-white/[.06] px-2 py-1">{children}</span>; }
function Meta({ label, value }: { label: string; value: string }) { return <div><dt className="text-[9px] font-black uppercase tracking-wider text-slate-600">{label}</dt><dd className="mt-1 truncate font-mono text-[10px] text-slate-300" title={value}>{value}</dd></div>; }
function Stat({ label, value, detail }: { label: string; value: number; detail: string }) { return <div className="cosmetic-prestige-stat rounded-2xl border border-white/10 bg-slate-950/45 p-4"><div className="text-[10px] font-black uppercase tracking-[.18em] text-slate-500">{label}</div><div className="mt-1 text-3xl font-black text-white">{value}</div><div className="mt-1 text-xs text-slate-400">{detail}</div></div>; }
function Empty({ title, text }: { title: string; text: string }) { return <div className="rounded-3xl border border-dashed border-white/10 bg-slate-950/35 px-6 py-16 text-center"><div className="text-5xl">◇</div><h2 className="mt-4 text-xl font-black text-white">{title}</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-400">{text}</p></div>; }
