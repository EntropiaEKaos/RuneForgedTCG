"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import {
  CARD_COSMETIC_ACQUISITIONS,
  CARD_COSMETIC_KINDS,
  cosmeticDropChancePercent,
  resolveCardCosmeticPrestige,
  type CardCosmeticAcquisition,
  type CardCosmeticKind,
} from "@/game/card-cosmetics";
import { framePresetSlug } from "@/game/card-frame-presets";
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

interface FramePreset {
  id: number;
  key: string;
  name: string;
  status: string;
  enabled: boolean;
}

interface FormState {
  variantId: string;
  name: string;
  kind: CardCosmeticKind;
  frameId: string;
  finish: string;
  artUrl: string;
  animationUrl: string;
  artCrop: { x: number; y: number; scale: number };
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
  frameId: "default",
  finish: "normal",
  artUrl: "",
  animationUrl: "",
  artCrop: { x: .5, y: .5, scale: 1 },
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

function safeCrop(value: VariantRow["artCrop"]) {
  return {
    x: Math.max(0, Math.min(1, Number(value?.x ?? .5))),
    y: Math.max(0, Math.min(1, Number(value?.y ?? .5))),
    scale: Math.max(1, Math.min(2.5, Number(value?.scale ?? 1))),
  };
}

function toForm(row: VariantRow): FormState {
  return {
    variantId: row.variantId,
    name: row.name,
    kind: row.kind,
    frameId: row.frameId,
    finish: row.finish,
    artUrl: row.artUrl || "",
    animationUrl: row.animationUrl || "",
    artCrop: safeCrop(row.artCrop),
    edition: row.edition || "",
    serialLimit: row.serialLimit ? String(row.serialLimit) : "",
    acquisition: row.acquisition,
    packEligible: row.packEligible,
    dropWeight: String(row.dropWeight || 0),
  };
}

function prestigeFor(acquisition: CardCosmeticAcquisition, packEligible: boolean, dropWeight: number) {
  return resolveCardCosmeticPrestige({ acquisition, packEligible, dropWeight });
}

export default function CardCosmeticsTab({ model, role }: { model: any; role: string }) {
  const defId = String(model.card?.defId || "").trim();
  const cardName = String(model.card?.name || defId || "Carta");
  const canPublish = hasStudioUiCapability(role, "production");
  const [rows, setRows] = useState<VariantRow[]>([]);
  const [assets, setAssets] = useState<ArtAsset[]>([]);
  const [frames, setFrames] = useState<FramePreset[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>({ ...EMPTY, artCrop: { ...EMPTY.artCrop } });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const patch = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));
  const patchCrop = <K extends keyof FormState["artCrop"]>(key: K, value: number) => setForm((current) => ({ ...current, artCrop: { ...current.artCrop, [key]: value } }));

  const load = useCallback(async () => {
    if (!defId) return;
    try {
      const [variantResponse, artResponse, frameResponse] = await Promise.all([
        fetch(`/api/admin/studio/cosmetics?defId=${encodeURIComponent(defId)}`, { cache: "no-store" }),
        fetch("/api/admin/studio/art", { cache: "no-store" }),
        fetch("/api/admin/studio/frames", { cache: "no-store" }),
      ]);
      const variants = await variantResponse.json();
      const art = await artResponse.json();
      const frameData = await frameResponse.json();
      if (variants.ok && Array.isArray(variants.rows)) setRows(variants.rows);
      if (art.ok && Array.isArray(art.assets)) setAssets(art.assets.map((asset: any) => ({ id: Number(asset.id), name: String(asset.name || asset.key || asset.id), preferredUrl: String(asset.preferredUrl || asset.url || "") })).filter((asset: ArtAsset) => asset.preferredUrl));
      if (frameData.ok && Array.isArray(frameData.rows)) setFrames(frameData.rows.filter((row: FramePreset) => row.status !== "archived"));
    } catch {
      setMessage("Não foi possível carregar o authoring visual da carta.");
    }
  }, [defId]);

  useDeferredEffect(() => { void load(); }, [load]);

  const previewStyle = useMemo(() => form.artUrl ? {
    backgroundImage: `linear-gradient(rgba(2,6,23,.06),rgba(2,6,23,.70)),url(${JSON.stringify(form.artUrl)})`,
    backgroundSize: form.artCrop.scale > 1 ? `${form.artCrop.scale * 100}%` : "cover",
    backgroundPosition: `${form.artCrop.x * 100}% ${form.artCrop.y * 100}%`,
  } : {}, [form.artCrop.scale, form.artCrop.x, form.artCrop.y, form.artUrl]);
  const dropWeight = Math.max(0, Math.min(1_000_000, Math.trunc(Number(form.dropWeight) || 0)));
  const probability = cosmeticDropChancePercent(dropWeight);
  const prestige = prestigeFor(form.acquisition, form.acquisition === "pack" && form.packEligible, dropWeight);
  const activeFrameExists = form.frameId === "default" || frames.some((frame) => frame.key === form.frameId);

  const startNew = () => {
    setEditingId(null);
    setForm({ ...EMPTY, artCrop: { ...EMPTY.artCrop }, variantId: `${defId.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}_alt` });
    setMessage("");
  };

  const edit = (row: VariantRow) => {
    setEditingId(row.id);
    setForm(toForm(row));
    setMessage("");
  };

  const uploadArt = async (file?: File) => {
    if (!file || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/admin/assets/upload", { method: "POST", credentials: "include", body });
      const data = await response.json();
      if (!data.ok) { setMessage(`❌ ${data.error || "Upload falhou."}`); return; }
      const payload = data.row?.payload && typeof data.row.payload === "object" ? data.row.payload : {};
      const url = String(payload.preferredUrl || payload.url || data.url || "");
      if (url) {
        patch("artUrl", url);
        patch("artCrop", { x: .5, y: .5, scale: 1 });
      }
      setMessage("✅ Arte enviada e selecionada. Salve a variante para persistir o vínculo.");
      await load();
    } catch {
      setMessage("❌ Falha no upload da arte.");
    } finally {
      setBusy(false);
    }
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
        artCrop: form.artCrop,
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
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]" data-studio-cosmetics="true" data-studio-visual-authoring="1.0">
      <div className="space-y-4">
        <Panel title="Cosmetics & Printings" eyebrow="ONE GAMEPLAY ID · MANY APPEARANCES">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-400/15 bg-emerald-400/[.05] p-3 text-xs text-slate-300">
            <span><b className="text-emerald-300">Engine-safe:</b> todas as variantes usam <code>{defId}</code>. Arte, frame e acabamento nunca alteram regras.</span>
            <button type="button" className="btn-secondary" onClick={startNew}>＋ Nova variante</button>
          </div>

          {message && <div className="mb-4 rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-slate-200" role="status">{message}</div>}

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Variant ID"><input className="input w-full" value={form.variantId} disabled={Boolean(editingId)} onChange={(e) => patch("variantId", e.target.value)} placeholder="andrea_full_art_01" /></Field>
            <Field label="Display name"><input className="input w-full" value={form.name} onChange={(e) => patch("name", e.target.value)} placeholder="Full Art — First Forge" /></Field>
            <Field label="Kind"><select className="input w-full" value={form.kind} onChange={(e) => patch("kind", e.target.value as CardCosmeticKind)}>{CARD_COSMETIC_KINDS.map((kind) => <option key={kind} value={kind}>{KIND_LABEL[kind]}</option>)}</select></Field>
            <Field label="Acquisition"><select className="input w-full" value={form.acquisition} onChange={(e) => patch("acquisition", e.target.value as CardCosmeticAcquisition)}>{CARD_COSMETIC_ACQUISITIONS.map((mode) => <option key={mode} value={mode}>{ACQUISITION_LABEL[mode]}</option>)}</select></Field>
            <Field label="Frame preset"><select className="input w-full" value={form.frameId} onChange={(e) => patch("frameId", e.target.value)}><option value="default">Default</option>{!activeFrameExists && <option value={form.frameId}>{form.frameId} · legado</option>}{frames.map((frame) => <option key={frame.id} value={frame.key}>{frame.name}{frame.enabled ? " · LIVE" : ` · ${frame.status}`}</option>)}</select></Field>
            <div className="flex items-end"><Link href="/admin/studio/frames" className="btn-ghost w-full text-center">Criar / editar frames ↗</Link></div>
            <Field label="Finish"><input className="input w-full" value={form.finish} onChange={(e) => patch("finish", e.target.value)} placeholder="foil / holo / normal" /></Field>
            <Field label="Edition"><input className="input w-full" value={form.edition} onChange={(e) => patch("edition", e.target.value)} placeholder="First Edition" /></Field>
            <Field label="Serial limit"><input type="number" min={1} className="input w-full" value={form.serialLimit} onChange={(e) => patch("serialLimit", e.target.value)} disabled={form.kind !== "serialized"} placeholder="500" /></Field>
          </div>

          <div className="mt-5 rounded-2xl border border-cyan-400/15 bg-cyan-400/[.035] p-4" data-studio-card-art-authoring="true">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><div className="text-xs font-black uppercase tracking-[.16em] text-cyan-200">Arte da variante</div><p className="mt-1 text-[10px] text-slate-500">Upload direto, biblioteca existente e enquadramento ficam salvos na própria variante.</p></div><label className="btn-secondary cursor-pointer">Upload de arte<input className="hidden" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => void uploadArt(e.target.files?.[0])}/></label></div>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Art URL"><input className="input w-full" value={form.artUrl} onChange={(e) => patch("artUrl", e.target.value)} placeholder="/uploads/... ou https://..." /></Field>
              <Field label="Biblioteca de assets"><select className="input w-full" value="" onChange={(e) => { if (e.target.value) { patch("artUrl", e.target.value); patch("artCrop", { x: .5, y: .5, scale: 1 }); } }}><option value="">Selecionar imagem…</option>{assets.map((asset) => <option key={asset.id} value={asset.preferredUrl}>{asset.name}</option>)}</select></Field>
              <Field label="Animation URL"><input className="input w-full" value={form.animationUrl} onChange={(e) => patch("animationUrl", e.target.value)} placeholder="HTTPS video/webm/mp4" disabled={form.kind !== "animated"} /></Field>
              <div className="flex items-end"><Link href="/admin/studio/art" className="btn-ghost w-full text-center">Abrir Art Pipeline ↗</Link></div>
            </div>
            <div className="mt-4 grid gap-x-5 md:grid-cols-3"><Range label="Foco X" value={form.artCrop.x} min={0} max={1} step={.01} set={(v) => patchCrop("x", v)} /><Range label="Foco Y" value={form.artCrop.y} min={0} max={1} step={.01} set={(v) => patchCrop("y", v)} /><Range label="Zoom" value={form.artCrop.scale} min={1} max={2.5} step={.05} set={(v) => patchCrop("scale", v)} /></div>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-200"><input type="checkbox" checked={form.packEligible} disabled={form.acquisition !== "pack"} onChange={(e) => patch("packEligible", e.target.checked)} /> Elegível para drop em pack</label>
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_190px] sm:items-end">
              <div><div className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-500">Drop weight (PPM)</div><input type="number" min={0} max={1_000_000} className="input w-full" value={form.dropWeight} disabled={!form.packEligible || form.acquisition !== "pack"} onChange={(e) => patch("dropWeight", e.target.value)} /></div>
              <div className="cosmetic-prestige-readout rounded-xl border border-cyan-400/15 bg-cyan-400/[.05] p-3 text-center" data-studio-cosmetic-prestige={prestige.id} data-cosmetic-prestige={prestige.id}>
                <div className="text-[10px] uppercase tracking-wider text-slate-500">chance nominal</div>
                <div className="mt-1 text-xl font-black text-cyan-200">{probability.toFixed(probability < 1 ? 3 : 2)}%</div>
                <span className="cosmetic-prestige-badge mt-2 inline-flex rounded-full px-2 py-1 text-[8px] font-black uppercase tracking-[.12em]">{prestige.shortLabel}</span>
              </div>
            </div>
            <p className="mt-2 text-[10px] leading-4 text-slate-500">{prestige.description} O restante até 1.000.000 PPM é Standard; a classificação é cosmética e nunca altera a raridade de gameplay.</p>
          </div>

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => void save(false)}>{editingId ? "Salvar alterações" : "Criar Draft"}</button>
            {editingId && canPublish && <button type="button" className="btn-primary" disabled={busy} onClick={() => void save(true)}>Publicar + habilitar</button>}
          </div>
        </Panel>

        <Panel title={`Variantes de ${cardName}`} eyebrow={`${rows.length} PRINTING(S)`}>
          {rows.length === 0 ? <p className="text-sm text-slate-500">Nenhuma variante criada. A aparência Standard continua implícita e não precisa de registro.</p> : <div className="grid gap-3 md:grid-cols-2">{rows.map((row) => {
            const rowPrestige = prestigeFor(row.acquisition, row.packEligible, row.dropWeight);
            return (
              <article key={row.id} data-cosmetic-prestige={rowPrestige.id} className={`rounded-2xl border p-4 ${editingId === row.id ? "border-amber-300/45 bg-amber-300/[.05]" : "border-white/10 bg-black/20"}`}>
                <div className="flex items-start justify-between gap-3"><div><div className="font-black text-white">{row.name}</div><div className="mt-1 font-mono text-[10px] text-slate-500">{row.variantId}</div></div><span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${row.enabled ? "bg-emerald-400/15 text-emerald-300" : row.status === "published" ? "bg-sky-400/15 text-sky-300" : row.status === "archived" ? "bg-slate-500/20 text-slate-400" : "bg-amber-400/15 text-amber-300"}`}>{row.enabled ? "LIVE" : row.status}</span></div>
                <div className="mt-3 flex flex-wrap items-center gap-2"><span className="cosmetic-prestige-badge rounded-full px-2 py-1 text-[8px] font-black uppercase tracking-[.12em]">{rowPrestige.shortLabel}</span>{row.packEligible && <span className="text-[10px] font-bold text-slate-400">{cosmeticDropChancePercent(row.dropWeight).toFixed(3)}% pack</span>}</div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] text-slate-400"><span>{KIND_LABEL[row.kind]}</span><span>{row.frameId}</span><span>{row.finish}</span><span>{ACQUISITION_LABEL[row.acquisition]}</span>{row.serialLimit && <span>#{row.serialLimit} máx.</span>}</div>
                <div className="mt-3 flex flex-wrap gap-2"><button type="button" className="btn-ghost text-[10px]" onClick={() => edit(row)}>Editar</button>{canPublish && row.status === "published" && <button type="button" className="btn-ghost text-[10px]" onClick={() => void toggleLive(row)}>{row.enabled ? "Desabilitar" : "Habilitar"}</button>}{canPublish && <button type="button" className="btn-ghost text-[10px] text-rose-300" onClick={() => void archive(row)}>Arquivar</button>}</div>
              </article>
            );
          })}</div>}
        </Panel>
      </div>

      <aside className="space-y-4">
        <Panel title="Visual Preview" eyebrow="ART + FRAME + FINISH">
          <div className={`card-shell card-frame-${framePresetSlug(form.frameId)} relative mx-auto aspect-[2/3] w-full max-w-[290px] overflow-hidden rounded-[24px] border-2 bg-slate-900 shadow-2xl ${form.kind === "foil" ? "border-cyan-200/70" : form.kind === "serialized" ? "border-amber-200/80" : "border-white/25"}`} data-studio-cosmetic-preview="true" data-cosmetic-prestige={prestige.id} data-preview-frame={form.frameId}>
            <div className="card-art absolute inset-0 bg-cover" style={previewStyle} />
            <div className="card-frame-ornament absolute inset-0" aria-hidden="true"><i/><i/><i/><i/></div>
            <div className="card-sheen absolute inset-0" aria-hidden="true" />
            {!form.artUrl && <div className="absolute inset-0 grid place-items-center text-center text-slate-600"><div><div className="text-5xl">◇</div><div className="mt-2 text-xs">Faça upload ou selecione uma arte</div></div></div>}
            <span className="cosmetic-prestige-badge absolute left-3 top-3 z-20 rounded-full px-2 py-1 text-[8px] font-black uppercase tracking-[.12em]">{prestige.shortLabel}</span>
            <div className="card-nameplate absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-slate-950 via-slate-950/85 to-transparent p-5 pt-16"><div className="text-[10px] font-black uppercase tracking-[.2em] text-amber-300">{form.name || "Cosmetic Draft"}</div><div className="mt-1 text-xl font-black text-white">{cardName}</div><div className="mt-2 flex flex-wrap gap-1 text-[9px] uppercase text-slate-300"><span className="rounded-full bg-white/10 px-2 py-1">{KIND_LABEL[form.kind]}</span><span className="rounded-full bg-white/10 px-2 py-1">{form.frameId}</span><span className="rounded-full bg-white/10 px-2 py-1">{form.finish}</span>{form.edition && <span className="rounded-full bg-white/10 px-2 py-1">{form.edition}</span>}</div></div>
            {form.kind === "serialized" && form.serialLimit && <span className="absolute right-3 top-3 z-20 rounded-full border border-amber-200/40 bg-black/70 px-2 py-1 text-[10px] font-black text-amber-200">#—/{form.serialLimit}</span>}
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-500">Preview editorial · <b className="text-slate-300">{prestige.label}</b>. O mesmo <code>defId</code> continua autoritativo; Studio Visual Authoring altera somente arte, enquadramento, frame, acabamento, animação e serial.</p>
        </Panel>
        <Panel title="Arte base da carta" eyebrow="RUNTIME CATALOG"><p className="text-xs leading-5 text-slate-400">A arte Standard da carta continua gerenciada no Art Pipeline. Lá você pode publicar uma arte para o catálogo runtime sem criar uma variante cosmética.</p><Link href="/admin/studio/art" className="btn-ghost mt-3 block text-center">Gerenciar arte Standard ↗</Link></Panel>
      </aside>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="label mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</span>{children}</label>;
}

function Range({ label, value, min, max, step, set }: { label: string; value: number; min: number; max: number; step: number; set: (value: number) => void }) {
  return <label className="block"><span className="mb-1 flex justify-between text-[10px] font-black uppercase tracking-wider text-slate-500"><b>{label}</b><i>{value.toFixed(2)}</i></span><input className="w-full accent-cyan-300" type="range" value={value} min={min} max={max} step={step} onChange={(event) => set(Number(event.target.value))}/></label>;
}
