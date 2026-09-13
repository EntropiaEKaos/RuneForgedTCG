"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { CARD_COSMETIC_ACQUISITIONS, CARD_COSMETIC_KINDS, type CardCosmeticAcquisition, type CardCosmeticKind } from "@/game/card-cosmetics";
import { hasStudioUiCapability } from "@/lib/admin-studio-access";
import { Panel } from "./CardAuthoringFields";

interface VariantRow {
  id: number;
  defId: string;
  variantId: string;
  name: string;
  kind: CardCosmeticKind;
  frameId: string;
  finish: string;
  artUrl: string | null;
  animationUrl: string | null;
  artCrop?: { x?: number; y?: number; scale?: number };
  edition: string | null;
  serialLimit: number | null;
  acquisition: CardCosmeticAcquisition;
  packEligible: boolean;
  dropWeight: number;
  status: "draft" | "published" | "archived";
  enabled: boolean;
}

interface ArtAsset {
  id: number;
  name: string;
  preferredUrl: string;
}

interface FormState {
  variantId: string;
  name: string;
  kind: CardCosmeticKind;
  frameId: string;
  finish: string;
  artUrl: string;
  animationUrl: string;
  edition: string;
  serialLimit: string;
  acquisition: CardCosmeticAcquisition;
  packEligible: boolean;
  dropWeight: string;
}

const EMPTY: FormState = {
  variantId: "",
  name: "",
  kind: "premium_frame",
  frameId: "premium",
  finish: "normal",
  artUrl: "",
  animationUrl: "",
  edition: "",
  serialLimit: "",
  acquisition: "pack",
  packEligible: false,
  dropWeight: "0",
};

const KIND_LABEL: Record<CardCosmeticKind, string> = {
  premium_frame: "Premium Frame",
  full_art: "Full Art",
  foil: "Foil / Holo",
  animated: "Animated",
  serialized: "Serialized",
};

const ACQUISITION_LABEL: Record<CardCosmeticAcquisition, string> = {
  pack: "Packs",
  event: "Evento",
  promotion: "Promoção",
  market: "Marketplace",
  grant: "Grant / recompensa",
};

function toForm(row: VariantRow): FormState {
  return {
    variantId: row.variantId,
    name: row.name,
    kind: row.kind,
    frameId: row.frameId,
    finish: row.finish,
    artUrl: row.artUrl || "",
    animationUrl: row.animationUrl || "",
    edition: row.edition || "",
    serialLimit: row.serialLimit ? String(row.serialLimit) : "",
    acquisition: row.acquisition,
    packEligible: row.packEligible,
    dropWeight: String(row.dropWeight || 0),
  };
}

export default function CardCosmeticsTab({ model, role }: { model: any; role: string }) {
  const defId = String(model.card?.defId || "").trim();
  const cardName = String(model.card?.name || defId || "Carta");
  const canPublish = hasStudioUiCapability(role, "production");
  const [rows, setRows] = useState<VariantRow[]>([]);
  const [assets, setAssets] = useState<ArtAsset[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const patch = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));

  const load = useCallback(async () => {
    if (!defId) return;
    try {
      const [variantResponse, artResponse] = await Promise.all([
        fetch(`/api/admin/studio/cosmetics?defId=${encodeURIComponent(defId)}`, { cache: "no-store" }),
        fetch("/api/admin/studio/art", { cache: "no-store" }),
      ]);
      const variants = await variantResponse.json();
      const art = await artResponse.json();
      if (variants.ok && Array.isArray(variants.rows)) setRows(variants.rows);
      if (art.ok && Array.isArray(art.assets)) setAssets(art.assets.map((asset: any) => ({ id: Number(asset.id), name: String(asset.name || asset.key || asset.id), preferredUrl: String(asset.preferredUrl || asset.url || "") })).filter((asset: ArtAsset) => asset.preferredUrl));
    } catch {
      setMessage("Não foi possível carregar as variantes cosméticas.");
    }
  }, [defId]);

  useDeferredEffect(() => { void load(); }, [load]);

  const previewStyle = useMemo(() => form.artUrl ? { backgroundImage: `linear-gradient(rgba(2,6,23,.08),rgba(2,6,23,.72)),url(${JSON.stringify(form.artUrl)})`, backgroundSize: "cover", backgroundPosition: "center" } : {}, [form.artUrl]);
  const probability = Math.max(0, Math.min(100, Number(form.dropWeight || 0) / 10_000));

  const startNew = () => {
    setEditingId(null);
    setForm({ ...EMPTY, variantId: `${defId.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}_alt` });
    setMessage("");
  };

  const edit = (row: VariantRow) => {
    setEditingId(row.id);
    setForm(toForm(row));
    setMessage("");
  };

  const save = async (publish = false) => {
    if (!defId || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const payload = {
        ...(editingId ? { id: editingId } : {}),
        defId,
        variantId: form.variantId.trim(),
        name: form.name.trim(),
        kind: form.kind,
        frameId: form.frameId.trim() || "default",
        finish: form.finish.trim() || "normal",
        artUrl: form.artUrl.trim() || null,
        animationUrl: form.animationUrl.trim() || null,
        artCrop: { x: .5, y: .5, scale: 1 },
        edition: form.edition.trim() || null,
        serialLimit: form.serialLimit ? Number(form.serialLimit) : null,
        acquisition: form.acquisition,
        packEligible: form.acquisition === "pack" && form.packEligible,
        dropWeight: Math.max(0, Math.trunc(Number(form.dropWeight) || 0)),
        ...(editingId && publish ? { status: "published", enabled: true } : {}),
      };
      const response = await fetch("/api/admin/studio/cosmetics", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!data.ok) {
        setMessage(`❌ ${data.error || "Não foi possível salvar."}`);
        return;
      }
      const row = data.row as VariantRow;
      setEditingId(row.id);
      setForm(toForm(row));
      setMessage(publish ? "✅ Variante publicada e habilitada." : "✅ Variante salva em Draft.");
      await load();
    } catch {
      setMessage("❌ Falha ao salvar variante cosmética.");
    } finally {
      setBusy(false);
    }
  };

  const toggleLive = async (row: VariantRow) => {
    if (!canPublish || busy) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/studio/cosmetics", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...row, id: row.id, status: "published", enabled: !row.enabled }),
      });
      const data = await response.json();
      setMessage(data.ok ? `✅ ${row.name} ${row.enabled ? "desabilitada" : "habilitada"}.` : `❌ ${data.error || "Falha ao alterar status."}`);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const archive = async (row: VariantRow) => {
    if (!canPublish || busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/studio/cosmetics?id=${row.id}`, { method: "DELETE" });
      const data = await response.json();
      setMessage(data.ok ? `✅ ${row.name} ${data.archived ? "arquivada" : "removida"}.` : `❌ ${data.error || "Falha ao arquivar."}`);
      if (editingId === row.id) startNew();
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (!defId) {
    return <Panel title="Cosmetics & Printings" eyebrow="COLLECTIBLE IDENTITY"><p className="text-sm text-slate-400">Salve a carta primeiro para criar variantes cosméticas. A variante referencia o <code>defId</code> da carta e nunca duplica regras.</p></Panel>;
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <Panel title="Cosmetics & Printings" eyebrow="ONE GAMEPLAY ID · MANY APPEARANCES">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-400/15 bg-emerald-400/[.05] p-3 text-xs text-slate-300">
            <span><b className="text-emerald-300">Engine-safe:</b> todas as variantes usam <code>{defId}</code>. Nenhum campo de gameplay é aceito pela API.</span>
            <button type="button" className="btn-secondary" onClick={startNew}>＋ Nova variante</button>
          </div>

          {message && <div className="mb-4 rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-slate-200">{message}</div>}

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Variant ID"><input className="input w-full" value={form.variantId} disabled={Boolean(editingId)} onChange={(e) => patch("variantId", e.target.value)} placeholder="andrea_full_art_01" /></Field>
            <Field label="Display name"><input className="input w-full" value={form.name} onChange={(e) => patch("name", e.target.value)} placeholder="Full Art — First Forge" /></Field>
            <Field label="Kind"><select className="input w-full" value={form.kind} onChange={(e) => patch("kind", e.target.value as CardCosmeticKind)}>{CARD_COSMETIC_KINDS.map((kind) => <option key={kind} value={kind}>{KIND_LABEL[kind]}</option>)}</select></Field>
            <Field label="Acquisition"><select className="input w-full" value={form.acquisition} onChange={(e) => patch("acquisition", e.target.value as CardCosmeticAcquisition)}>{CARD_COSMETIC_ACQUISITIONS.map((mode) => <option key={mode} value={mode}>{ACQUISITION_LABEL[mode]}</option>)}</select></Field>
            <Field label="Frame ID"><input className="input w-full" value={form.frameId} onChange={(e) => patch("frameId", e.target.value)} placeholder="premium_gold" /></Field>
            <Field label="Finish"><input className="input w-full" value={form.finish} onChange={(e) => patch("finish", e.target.value)} placeholder="foil / holo / normal" /></Field>
            <Field label="Edition"><input className="input w-full" value={form.edition} onChange={(e) => patch("edition", e.target.value)} placeholder="First Edition" /></Field>
            <Field label="Serial limit"><input type="number" min={1} className="input w-full" value={form.serialLimit} onChange={(e) => patch("serialLimit", e.target.value)} disabled={form.kind !== "serialized"} placeholder="500" /></Field>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Field label="Art URL"><input className="input w-full" value={form.artUrl} onChange={(e) => patch("artUrl", e.target.value)} placeholder="/uploads/... ou https://..." /></Field>
            <Field label="Use asset from Art Pipeline"><select className="input w-full" value="" onChange={(e) => { if (e.target.value) patch("artUrl", e.target.value); }}><option value="">Selecionar imagem…</option>{assets.map((asset) => <option key={asset.id} value={asset.preferredUrl}>{asset.name}</option>)}</select></Field>
            <Field label="Animation URL"><input className="input w-full" value={form.animationUrl} onChange={(e) => patch("animationUrl", e.target.value)} placeholder="HTTPS video/webm/mp4" disabled={form.kind !== "animated"} /></Field>
            <div className="flex items-end"><Link href="/admin/studio/art" className="btn-ghost w-full text-center">Abrir Art Pipeline ↗</Link></div>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-200"><input type="checkbox" checked={form.packEligible} disabled={form.acquisition !== "pack"} onChange={(e) => patch("packEligible", e.target.checked)} /> Elegível para drop em pack</label>
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_160px] sm:items-end">
              <div><div className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-500">Drop weight (PPM)</div><input type="number" min={0} max={1_000_000} className="input w-full" value={form.dropWeight} disabled={!form.packEligible || form.acquisition !== "pack"} onChange={(e) => patch("dropWeight", e.target.value)} /></div>
              <div className="rounded-xl border border-cyan-400/15 bg-cyan-400/[.05] p-3 text-center"><div className="text-[10px] uppercase tracking-wider text-slate-500">chance nominal</div><div className="mt-1 text-xl font-black text-cyan-200">{probability.toFixed(probability < 1 ? 3 : 2)}%</div></div>
            </div>
            <p className="mt-2 text-[10px] leading-4 text-slate-500">O restante até 1.000.000 PPM é Standard. Se várias variantes da mesma carta somarem mais de 100%, a ordem de publicação limita o pool sem alterar o defId sorteado.</p>
          </div>

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => void save(false)}>{editingId ? "Salvar alterações" : "Criar Draft"}</button>
            {editingId && canPublish && <button type="button" className="btn-primary" disabled={busy} onClick={() => void save(true)}>Publicar + habilitar</button>}
          </div>
        </Panel>

        <Panel title={`Variantes de ${cardName}`} eyebrow={`${rows.length} PRINTING(S)`}>
          {rows.length === 0 ? <p className="text-sm text-slate-500">Nenhuma variante criada. A aparência Standard continua implícita e não precisa de registro.</p> : <div className="grid gap-3 md:grid-cols-2">{rows.map((row) => (
            <article key={row.id} className={`rounded-2xl border p-4 ${editingId === row.id ? "border-amber-300/45 bg-amber-300/[.05]" : "border-white/10 bg-black/20"}`}>
              <div className="flex items-start justify-between gap-3"><div><div className="font-black text-white">{row.name}</div><div className="mt-1 font-mono text-[10px] text-slate-500">{row.variantId}</div></div><span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${row.enabled ? "bg-emerald-400/15 text-emerald-300" : row.status === "published" ? "bg-sky-400/15 text-sky-300" : row.status === "archived" ? "bg-slate-500/20 text-slate-400" : "bg-amber-400/15 text-amber-300"}`}>{row.enabled ? "LIVE" : row.status}</span></div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] text-slate-400"><span>{KIND_LABEL[row.kind]}</span><span>{row.frameId}</span><span>{row.finish}</span><span>{ACQUISITION_LABEL[row.acquisition]}</span>{row.serialLimit && <span>#{row.serialLimit} máx.</span>}{row.packEligible && <span>{(row.dropWeight / 10_000).toFixed(3)}% pack</span>}</div>
              <div className="mt-3 flex flex-wrap gap-2"><button type="button" className="btn-ghost text-[10px]" onClick={() => edit(row)}>Editar</button>{canPublish && row.status === "published" && <button type="button" className="btn-ghost text-[10px]" onClick={() => void toggleLive(row)}>{row.enabled ? "Desabilitar" : "Habilitar"}</button>}{canPublish && <button type="button" className="btn-ghost text-[10px] text-rose-300" onClick={() => void archive(row)}>Arquivar</button>}</div>
            </article>
          ))}</div>}
        </Panel>
      </div>

      <aside className="space-y-4">
        <Panel title="Cosmetic Preview" eyebrow="VISUAL ONLY">
          <div className={`relative mx-auto aspect-[2/3] w-full max-w-[280px] overflow-hidden rounded-[24px] border-2 bg-slate-900 shadow-2xl ${form.kind === "foil" ? "border-cyan-200/70" : form.kind === "serialized" ? "border-amber-200/80" : "border-white/25"}`} style={previewStyle}>
            {!form.artUrl && <div className="grid h-full place-items-center text-center text-slate-600"><div><div className="text-5xl">◇</div><div className="mt-2 text-xs">Selecione uma arte do pipeline</div></div></div>}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/85 to-transparent p-5 pt-16"><div className="text-[10px] font-black uppercase tracking-[.2em] text-amber-300">{form.name || "Cosmetic Draft"}</div><div className="mt-1 text-xl font-black text-white">{cardName}</div><div className="mt-2 flex flex-wrap gap-1 text-[9px] uppercase text-slate-300"><span className="rounded-full bg-white/10 px-2 py-1">{KIND_LABEL[form.kind]}</span><span className="rounded-full bg-white/10 px-2 py-1">{form.finish}</span>{form.edition && <span className="rounded-full bg-white/10 px-2 py-1">{form.edition}</span>}</div></div>
            {form.kind === "serialized" && form.serialLimit && <span className="absolute right-3 top-3 rounded-full border border-amber-200/40 bg-black/70 px-2 py-1 text-[10px] font-black text-amber-200">#—/{form.serialLimit}</span>}
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-500">Preview editorial. O renderer real usa o mesmo <code>defId</code> e aplica apenas art/frame/finish/animação/serial.</p>
        </Panel>
      </aside>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</span>{children}</label>;
}
