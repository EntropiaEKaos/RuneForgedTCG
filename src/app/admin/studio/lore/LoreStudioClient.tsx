"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { StudioBreadcrumb, StudioCommandPalette } from "../StudioChrome";

type LoreItem = {
  id: number;
  slug: string;
  status: "draft" | "review" | "published" | "archived";
  version: number;
  payload: Record<string, unknown>;
  seo: Record<string, unknown>;
  updatedAt: string;
};

type FormState = {
  slug: string;
  version: number;
  title: string;
  summary: string;
  category: string;
  eyebrow: string;
  chronology: string;
  imageUrl: string;
  tags: string;
  relatedCards: string;
  relatedLore: string;
  body: string;
  featured: boolean;
  seoTitle: string;
  seoDescription: string;
  changeNote: string;
};

const EMPTY: FormState = {
  slug: "",
  version: 0,
  title: "",
  summary: "",
  category: "Crônica",
  eyebrow: "",
  chronology: "",
  imageUrl: "",
  tags: "",
  relatedCards: "",
  relatedLore: "",
  body: "",
  featured: false,
  seoTitle: "",
  seoDescription: "",
  changeNote: "",
};

function asText(value: unknown) { return typeof value === "string" ? value : ""; }
function listText(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").join(", ") : ""; }
function csv(value: string) { return value.split(",").map((part) => part.trim()).filter(Boolean).slice(0, 24); }

function fromItem(item: LoreItem): FormState {
  return {
    slug: item.slug,
    version: item.version,
    title: asText(item.payload.title),
    summary: asText(item.payload.summary),
    category: asText(item.payload.category) || "Crônica",
    eyebrow: asText(item.payload.eyebrow),
    chronology: asText(item.payload.chronology),
    imageUrl: asText(item.payload.imageUrl),
    tags: listText(item.payload.tags),
    relatedCards: listText(item.payload.relatedCards),
    relatedLore: listText(item.payload.relatedLore),
    body: asText(item.payload.body),
    featured: item.payload.featured === true,
    seoTitle: asText(item.seo.title),
    seoDescription: asText(item.seo.description),
    changeNote: "",
  };
}

export default function LoreStudioClient({ username, role }: { username: string; role: string }) {
  const [items, setItems] = useState<LoreItem[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/site/lore?locale=pt-BR", { credentials: "include", cache: "no-store" });
    if (!response.ok) throw new Error("Não foi possível carregar as crônicas.");
    const data = await response.json() as { items?: LoreItem[] };
    setItems(data.items ?? []);
  }, []);

  useEffect(() => { void load().catch((err) => setError(err instanceof Error ? err.message : "Falha ao carregar.")); }, [load]);

  async function open(slug: string) {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/admin/site/lore/${encodeURIComponent(slug)}?locale=pt-BR`, { credentials: "include", cache: "no-store" });
      const data = await response.json() as { item?: LoreItem; error?: string };
      if (!response.ok || !data.item) throw new Error(data.error || "Crônica não encontrada.");
      setForm(fromItem(data.item));
    } catch (err) { setError(err instanceof Error ? err.message : "Falha ao abrir."); }
    finally { setBusy(false); }
  }

  async function save() {
    if (!form.slug.trim() || !form.title.trim()) { setError("Slug e título são obrigatórios."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/admin/site/lore/${encodeURIComponent(form.slug.trim())}`, {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          locale: "pt-BR",
          expectedVersion: form.version,
          status: "draft",
          changeNote: form.changeNote,
          payload: {
            title: form.title.trim(),
            summary: form.summary.trim(),
            category: form.category.trim() || "Crônica",
            eyebrow: form.eyebrow.trim(),
            chronology: form.chronology.trim(),
            imageUrl: form.imageUrl.trim(),
            tags: csv(form.tags),
            relatedCards: csv(form.relatedCards),
            relatedLore: csv(form.relatedLore),
            body: form.body.trim(),
            featured: form.featured,
          },
          seo: {
            title: form.seoTitle.trim() || form.title.trim(),
            description: form.seoDescription.trim() || form.summary.trim(),
          },
        }),
      });
      const data = await response.json() as { item?: LoreItem; error?: string; currentVersion?: number };
      if (!response.ok || !data.item) throw new Error(data.error || "Não foi possível salvar.");
      setForm(fromItem(data.item));
      await load();
      setNotice("Rascunho salvo. A versão publicada anterior continua no client até o próximo publish.");
    } catch (err) { setError(err instanceof Error ? err.message : "Falha ao salvar."); }
    finally { setBusy(false); }
  }

  async function publish() {
    if (form.version < 1) { setError("Salve o rascunho antes de publicar."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/admin/site/lore/${encodeURIComponent(form.slug)}/publish`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locale: "pt-BR", expectedVersion: form.version, changeNote: form.changeNote || "Lore publicada pelo Studio" }),
      });
      const data = await response.json() as { item?: LoreItem; error?: string };
      if (!response.ok || !data.item) throw new Error(data.error || "Não foi possível publicar.");
      setForm(fromItem(data.item));
      await load();
      setNotice("Crônica publicada no client FORGED.");
    } catch (err) { setError(err instanceof Error ? err.message : "Falha ao publicar."); }
    finally { setBusy(false); }
  }

  const field = (key: keyof FormState, label: string, placeholder = "") => (
    <label className="grid gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">
      {label}
      <input value={String(form[key] ?? "")} placeholder={placeholder} onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))} className="border border-white/10 bg-black/25 px-3 py-2.5 text-sm normal-case tracking-normal text-slate-100 outline-none focus:border-amber-200/35" />
    </label>
  );

  return (
    <main className="min-h-screen bg-[#070b10] text-slate-100">
      <div className="mx-auto max-w-[1500px] px-5 py-7 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <StudioBreadcrumb section="Content" current="Lore Studio" />
          <StudioCommandPalette role={role} />
        </div>

        <div className="mt-7 flex flex-wrap items-end justify-between gap-5 border-b border-white/8 pb-5">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[.28em] text-amber-200/45">FORGED CONTENT CONTROL</p>
            <h1 className="mt-2 font-[var(--font-display)] text-3xl font-black text-[#efe2c3]">Lore Studio</h1>
            <p className="mt-2 text-sm text-slate-400">Crônicas, personagens, mundos e acontecimentos publicados diretamente no client. Operador: {username}.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/lore" target="_blank" className="border border-white/10 px-4 py-2 text-[10px] font-bold uppercase tracking-[.16em] text-slate-300">Pré-visualizar client</Link>
            <button onClick={() => { setForm(EMPTY); setNotice(""); setError(""); }} className="border border-amber-200/25 bg-amber-100/5 px-4 py-2 text-[10px] font-bold uppercase tracking-[.16em] text-amber-100">Nova crônica</button>
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="border border-white/8 bg-white/[.02]">
            <div className="border-b border-white/8 px-4 py-3 text-[9px] font-bold uppercase tracking-[.2em] text-slate-500">ARQUIVO · {items.length}</div>
            <div className="max-h-[720px] overflow-y-auto">
              {items.map((item) => (
                <button key={item.id} onClick={() => void open(item.slug)} className="grid w-full gap-1 border-b border-white/6 px-4 py-4 text-left transition hover:bg-white/[.03]">
                  <span className="text-sm font-semibold text-slate-200">{asText(item.payload.title) || item.slug}</span>
                  <span className="text-[9px] uppercase tracking-[.14em] text-slate-600">{item.status} · v{item.version}</span>
                </button>
              ))}
              {!items.length && <p className="p-5 text-xs leading-6 text-slate-500">Nenhuma crônica criada. Use “Nova crônica”.</p>}
            </div>
          </aside>

          <section className="border border-white/8 bg-white/[.018] p-5 sm:p-7">
            <div className="grid gap-4 md:grid-cols-2">
              {field("slug", "Slug", "queda-da-primeira-forja")}
              {field("title", "Título", "A Queda da Primeira Forja")}
              {field("category", "Categoria", "Personagem, Mundo, Facção, Evento...")}
              {field("eyebrow", "Chamada curta", "ARQUIVO PROIBIDO")}
              {field("chronology", "Cronologia", "Era / Ano / Capítulo")}
              {field("imageUrl", "Imagem / key art URL", "/images/lore/...")}
              {field("tags", "Tags (vírgula)", "fogo, império, guerra")}
              {field("relatedCards", "Cartas relacionadas (defId)", "ember_champion, ...")}
              {field("relatedLore", "Crônicas relacionadas (slug)", "origem-da-forja, ...")}
              {field("seoTitle", "SEO title")}
            </div>

            <label className="mt-4 grid gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">Resumo
              <textarea rows={3} value={form.summary} onChange={(e) => setForm((prev) => ({ ...prev, summary: e.target.value }))} className="border border-white/10 bg-black/25 px-3 py-3 text-sm normal-case tracking-normal text-slate-100 outline-none focus:border-amber-200/35" />
            </label>
            <label className="mt-4 grid gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">Corpo narrativo
              <textarea rows={16} value={form.body} onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))} className="border border-white/10 bg-black/25 px-3 py-3 text-sm normal-case leading-7 tracking-normal text-slate-100 outline-none focus:border-amber-200/35" />
            </label>
            <label className="mt-4 grid gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">SEO description
              <textarea rows={2} value={form.seoDescription} onChange={(e) => setForm((prev) => ({ ...prev, seoDescription: e.target.value }))} className="border border-white/10 bg-black/25 px-3 py-3 text-sm normal-case tracking-normal text-slate-100 outline-none focus:border-amber-200/35" />
            </label>

            <div className="mt-4 flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={form.featured} onChange={(e) => setForm((prev) => ({ ...prev, featured: e.target.checked }))} /> Destacar no topo das Crônicas</label>
              <input value={form.changeNote} onChange={(e) => setForm((prev) => ({ ...prev, changeNote: e.target.value }))} placeholder="Nota da alteração" className="min-w-[240px] flex-1 border border-white/10 bg-black/25 px-3 py-2 text-xs text-slate-200 outline-none" />
            </div>

            {(error || notice) && <div className={`mt-5 border px-4 py-3 text-xs ${error ? "border-red-400/25 bg-red-950/20 text-red-200" : "border-emerald-400/20 bg-emerald-950/15 text-emerald-200"}`}>{error || notice}</div>}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-white/8 pt-5">
              <span className="text-[9px] uppercase tracking-[.16em] text-slate-600">Versão atual: {form.version || "nova"}</span>
              <div className="flex gap-2">
                <button disabled={busy} onClick={() => void save()} className="border border-white/12 px-5 py-2.5 text-[10px] font-bold uppercase tracking-[.16em] text-slate-200 disabled:opacity-40">Salvar rascunho</button>
                <button disabled={busy || form.version < 1} onClick={() => void publish()} className="border border-amber-200/30 bg-amber-100/8 px-5 py-2.5 text-[10px] font-bold uppercase tracking-[.16em] text-amber-100 disabled:opacity-40">Publicar no client</button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
