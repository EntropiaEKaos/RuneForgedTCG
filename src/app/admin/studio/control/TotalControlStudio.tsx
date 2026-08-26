"use client";

import pkg from "../../../../../package.json";
import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { StudioBreadcrumb, StudioCommandPalette } from "../StudioChrome";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";

type Row = { id: number; domain: string; key: string; name: string; description: string; status: string; dangerLevel: "safe" | "elevated" | "critical"; schemaVersion: number; revision: number; payload: Record<string, any>; enabled: boolean };
type DomainInfo = Record<string, { label: string; icon: string; danger: Row["dangerLevel"]; description: string }>;
type Config = Record<string, any>;

const domainOrder = ["official-decks","doctrines","puzzles","bosses","brawls","expeditions","packs","login-rewards","rank-tiers","ranked-seasons","ai-profiles","engine-zones","engine-phases","engine-actions","matchmaking-policies","economy-products","payment-products","collection-rewards","formats","experimental-decks","asset-library","visual-themes","audio-cues","localizations","moderation-rules"];
const payloadTemplates: Record<string, Record<string, any>> = {
  "official-decks": { id: "new-deck", name: "Novo deck", regions: ["Emberhold"], description: "", emoji: "🂠", cards: [] },
  doctrines: { deckId: "new-doctrine", name: "Nova doutrina", region: "Emberhold", icon: "◈", fantasy: "", plan: ["Preparar", "Controlar", "Finalizar"], victory: "", weakness: "", signatures: [], meterLabel: "MOMENTUM" },
  puzzles: { id: "new-puzzle", name: "Novo puzzle", description: "", difficulty: 1, reward: { gold: 0, dust: 0, xp: 0 }, playerHand: [], playerMana: 1, playerNexus: 20, aiHand: [], aiNexus: 20, goal: "", hint: "" },
  bosses: { id: "new-boss", name: "Novo chefe", emoji: "👹", region: "Emberhold", difficulty: 1, description: "", playerNexusStart: 20, aiNexusStart: 20, aiDeck: [], reward: { gold: 0, dust: 0, xp: 0 } },
  brawls: { id: "new-brawl", name: "Novo brawl", description: "", emoji: "⚡", rules: { startingMana: 1, startingHand: 4, startingNexus: 20 } },
  expeditions: { id: "new-expedition", chapter: "I", name: "Nova expedição", emoji: "🧭", region: "Emberhold", difficulty: 1, description: "", objective: "", opponentDeckId: "ember_aggro", playerNexus: 20, aiNexus: 20, mutator: { id: "none", label: "Sem mutador", description: "" }, reward: { gold: 0, dust: 0, xp: 0 } },
  packs: { id: "new-pack", name: "Novo pacote", price: 100, icon: "📦", cardsCount: 5, dropRates: { Common: .7, Rare: .25, Epic: .04, Legend: .01 }, description: "", color: "from-slate-500 to-slate-700" },
  "login-rewards": { day: 1, gold: 0, dust: 0, icon: "🎁" },
  "rank-tiers": { name: "Novo Rank", minMmr: 0, maxMmr: 999, icon: "🏆", color: "text-amber-300", gradient: "from-amber-500 to-orange-700" },
  "ranked-seasons": { startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + 90 * 86400000).toISOString(), active: false, placementGames: 10, rewards: [] },
  "ai-profiles": { id: "custom", label: "IA customizada", icon: "♟", description: "", aggression: 1, valueWeight: 1, reactionDepth: 2, randomness: .08 },
  "engine-zones": { id: "new-zone", capacity: 10, visibility: "owner", runtimeAdapter: "metadata" },
  "engine-phases": { id: "new-phase", order: 50, allowedNext: ["main"], runtimeAdapter: "metadata" },
  "engine-actions": { runtimeAction: "custom", allowedPhases: ["main"], enabled: true, runtimeAdapter: "metadata" },
  "matchmaking-policies": { mode: "custom", baseRange: 150, maxRange: 600, rangeStep: 75, rangeStepSeconds: 10, staleSeconds: 20, queueTtlSeconds: 600, aiFallbackSeconds: 8, allowAiFallback: false },
  "economy-products": { type: "product", currencies: { gold: 100 }, grants: [], limits: { perPlayer: 1 } },
  "payment-products": { priceCents: 990, currency: "BRL", grants: { gold: 500, packs: [] }, active: true },
  "collection-rewards": { collectionKey: "vanilla", milestones: [{ percent: 25, grants: { gold: 150 } }] },
  formats: { id: "standard", collectionKeys: ["vanilla"], active: true, rankedEligible: false },
  "experimental-decks": { id: "", regions: ["Emberhold"], cards: [], certified: false, promoted: false },
  "asset-library": { type: "card-art", url: "", mimeType: "image/webp", width: 1024, height: 1024, tags: [], usages: [] },
  "visual-themes": { id: "new-theme", board: "default", cardBack: "default", fxIntensity: 1, reduceMotion: false, tokens: {} },
  "audio-cues": { group: "sfx", url: "", volume: 1, loop: false, ducking: 0 },
  localizations: { locale: "pt-BR", fallback: "en", strings: {} },
  "moderation-rules": { chatMaxLength: 280, floodWindowSeconds: 10, floodMaxMessages: 6, sanctions: ["warn","mute","suspend","ban"], replayRetentionDays: 90, allowDeckModeration: true },
};

export default function TotalControlStudio() {
  const [tab, setTab] = useState("settings");
  const [rows, setRows] = useState<Row[]>([]);
  const [domains, setDomains] = useState<DomainInfo>({});
  const [editing, setEditing] = useState<Row | null>(null);
  const [payloadText, setPayloadText] = useState("{}");
  const [config, setConfig] = useState<Config | null>(null);
  const [configRevision, setConfigRevision] = useState(0);
  const [advancedText, setAdvancedText] = useState("{}");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [importText, setImportText] = useState("");

  const loadDefinitions = useCallback(async () => {
    if (tab === "settings") return;
    const response = await fetch(`/api/admin/control?domain=${encodeURIComponent(tab)}`, { credentials: "include" });
    const data = await response.json();
    if (!data.ok) throw new Error(data.error);
    setRows(data.rows || []); setDomains(data.domains || {});
  }, [tab]);
  const loadSettings = useCallback(async () => {
    const response = await fetch("/api/admin/settings", { credentials: "include" });
    const data = await response.json();
    if (!data.ok) throw new Error(data.error);
    setConfig(data.config); setConfigRevision(Number(data.revision || 0)); setAdvancedText(JSON.stringify(data.config.advanced, null, 2));
  }, []);
  useDeferredEffect(() => { setError(""); setNotice(""); setEditing(null); (tab === "settings" ? loadSettings() : loadDefinitions()).catch((e) => setError(e instanceof Error ? e.message : "Load failed")); }, [tab, loadDefinitions, loadSettings]);

  const begin = (row?: Row) => {
    const info = domains[tab];
    const value = row || { id: 0, domain: tab, key: `new-${tab.replace(/s$/, "")}`, name: `Novo ${info?.label || tab}`, description: "", status: "draft", dangerLevel: info?.danger || "safe", schemaVersion: 1, revision: 1, payload: structuredClone(payloadTemplates[tab] || {}), enabled: false };
    setEditing({ ...value }); setPayloadText(JSON.stringify(value.payload, null, 2)); setError("");
  };

  const saveDefinition = async () => {
    if (!editing) return;
    let payload: Record<string, any>;
    try { payload = JSON.parse(payloadText); } catch { return setError("O payload contém JSON inválido."); }
    setBusy(true); setError("");
    try {
      const response = await fetch(editing.id ? `/api/admin/control/${editing.id}` : "/api/admin/control", { method: editing.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ ...editing, payload, expectedRevision: editing.revision }) });
      const data = await response.json(); if (!data.ok) throw new Error(data.validation?.errors?.join(" · ") || data.error);
      setNotice(editing.id ? "Definição atualizada em rascunho." : "Definição criada em rascunho."); setEditing(null); await loadDefinitions();
    } catch (e) { setError(e instanceof Error ? e.message : "Save failed"); } finally { setBusy(false); }
  };
  const transition = async (row: Row, action: "publish" | "archive") => {
    let confirmation = "";
    if (action === "publish" && row.dangerLevel === "critical") {
      const expected = `PUBLICAR ${row.domain}/${row.key}`;
      confirmation = prompt(`Definição crítica. Digite exatamente:\n${expected}`) || "";
      if (confirmation !== expected) return;
    }
    const response = await fetch(`/api/admin/control/${row.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ action, expectedRevision: row.revision, confirmation }) });
    const data = await response.json(); if (!data.ok) return setError(data.validation?.errors?.join(" · ") || data.error);
    setNotice(action === "publish" ? "Definição publicada e disponível ao runtime." : "Definição arquivada e retirada do runtime."); await loadDefinitions();
  };
  const remove = async (row: Row) => {
    if (!confirm(`Excluir definitivamente ${row.name}?`)) return;
    const response = await fetch(`/api/admin/control/${row.id}`, { method: "DELETE", credentials: "include" }); const data = await response.json();
    if (!data.ok) setError(data.error); else { setNotice("Definição removida."); await loadDefinitions(); }
  };
  const bootstrap = async () => {
    setBusy(true); const response = await fetch("/api/admin/control", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ action: "bootstrap" }) }); const data = await response.json(); setBusy(false);
    if (!data.ok) setError(data.error); else { setNotice(`${data.inserted} definições padrão importadas como rascunho.`); if (tab !== "settings") await loadDefinitions(); }
  };
  const uploadAsset = async (file?: File) => {
    if (!file) return; setBusy(true); setError(""); const form = new FormData(); form.set("file", file);
    const response = await fetch("/api/admin/assets/upload", { method: "POST", credentials: "include", body: form }); const data = await response.json(); setBusy(false);
    if (!data.ok) setError(data.error); else { setNotice(`Mídia enviada para ${data.url} e registrada como rascunho.`); await loadDefinitions(); }
  };
  const exportRows = () => {
    const blob = new Blob([JSON.stringify({ version: pkg.version, exportedAt: new Date().toISOString(), items: rows.map(({ id: _id, status: _status, enabled: _enabled, revision: _revision, ...item }) => item) }, null, 2)], { type: "application/json" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `runeforge-${tab}.json`; link.click(); URL.revokeObjectURL(link.href);
  };
  const importRows = async () => {
    try {
      const parsed = JSON.parse(importText); const items = Array.isArray(parsed) ? parsed : parsed.items;
      const response = await fetch("/api/admin/control", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ action: "import", items }) }); const data = await response.json(); if (!data.ok) throw new Error(data.error);
      setNotice(`${data.created.length} definições importadas.`); setImportText(""); await loadDefinitions();
    } catch (e) { setError(e instanceof Error ? e.message : "Import inválido"); }
  };
  const saveSettings = async () => {
    if (!config) return;
    let advanced: any; try { advanced = JSON.parse(advancedText); } catch { return setError("Configuração avançada contém JSON inválido."); }
    setBusy(true); const response = await fetch("/api/admin/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ ...config, advanced, expectedRevision: configRevision }) }); const data = await response.json(); setBusy(false);
    if (!data.ok) { if (response.status === 409) await loadSettings(); setError(data.error); } else { setConfig(data.config); setConfigRevision(Number(data.revision || configRevision + 1)); setAdvancedText(JSON.stringify(data.config.advanced, null, 2)); setNotice("Configuração global salva e auditada."); }
  };

  const counts = useMemo(() => ({ live: rows.filter((row) => row.status === "published" && row.enabled).length, draft: rows.filter((row) => row.status === "draft").length, critical: rows.filter((row) => row.dangerLevel === "critical").length }), [rows]);
  return <div className="studio-shell"><StudioCommandPalette /><header className="studio-topbar"><div className="studio-topbar-inner flex items-center justify-between"><div className="studio-brand"><div className="studio-brand-mark">⌘</div><div><div className="studio-kicker">RUNEFORGE // {pkg.version}</div><div className="studio-title">Total Game Control</div></div></div><div className="flex gap-2"><Link href="/admin/studio/art" className="btn-ghost">Art Pipeline</Link><button className="btn-ghost" onClick={bootstrap} disabled={busy}>Importar padrões</button><Link href="/admin/studio" className="btn-ghost">Control Room</Link></div></div></header>
    <div className="studio-layout"><aside className="studio-sidebar"><div className="studio-nav-label">Runtime</div><button className={`studio-nav-item ${tab === "settings" ? "active" : ""}`} onClick={() => setTab("settings")}><span>⚙</span>Configuração global</button><div className="studio-nav-label mt-5">Definições</div><div className="studio-nav-list">{domainOrder.map((id) => <button key={id} className={`studio-nav-item ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}><span>{domains[id]?.icon || "◆"}</span>{domains[id]?.label || id}</button>)}</div></aside>
      <main className="studio-main"><StudioBreadcrumb section="Total Control" current={tab === "settings" ? "Configuração global" : domains[tab]?.label || tab} />
        {notice && <div className="mb-4 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-xs text-emerald-200">{notice}</div>}{error && <div className="mb-4 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-xs text-red-200">{error}</div>}
        {tab === "settings" ? <SettingsEditor config={config} setConfig={setConfig} advancedText={advancedText} setAdvancedText={setAdvancedText} save={saveSettings} busy={busy} /> : <>
          <section className="studio-hero mb-5"><p className="studio-kicker">VERSIONED RUNTIME DOMAIN</p><h2>{domains[tab]?.icon} {domains[tab]?.label || tab}</h2><p>{domains[tab]?.description}</p><div className="mt-4 flex flex-wrap gap-2"><span className="studio-pill live">{counts.live} live</span><span className="studio-pill">{counts.draft} drafts</span><span className="studio-pill">{counts.critical} critical</span></div></section>
          <div className="mb-4 flex flex-wrap gap-2"><button className="btn-primary" onClick={() => begin()}>+ Nova definição</button><button className="btn-ghost" onClick={exportRows}>Exportar JSON</button>{tab === "asset-library" && <label className="btn-ghost cursor-pointer">Upload de mídia<input className="hidden" type="file" accept="image/png,image/jpeg,image/webp,image/gif,audio/mpeg,audio/ogg,audio/wav" onChange={(e) => uploadAsset(e.target.files?.[0])}/></label>}</div>
          <div className="grid gap-5 xl:grid-cols-[1fr_470px]"><section className="studio-section overflow-hidden"><div className="divide-y divide-white/5">{rows.map((row) => <div key={row.id} className="p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="font-black">{row.name}</div><div className="text-[10px] text-slate-500">{row.domain}/{row.key} · rev {row.revision}</div></div><div className="flex flex-wrap gap-1"><span className={`studio-pill ${row.status === "published" ? "live" : ""}`}>{row.status}</span><span className={`studio-pill ${row.dangerLevel === "critical" ? "!border-red-400/30 !text-red-300" : ""}`}>{row.dangerLevel}</span><button className="btn-ghost !px-2 !py-1 text-[10px]" onClick={() => begin(row)}>Editar</button>{row.status !== "published" && <button className="btn-primary !px-2 !py-1 text-[10px]" onClick={() => transition(row,"publish")}>Publicar</button>}{row.status === "published" && <button className="btn-ghost !px-2 !py-1 text-[10px]" onClick={() => transition(row,"archive")}>Arquivar</button>}{row.status !== "published" && <button className="btn-ghost !px-2 !py-1 text-[10px] text-red-300" onClick={() => remove(row)}>Excluir</button>}</div></div><p className="mt-2 text-xs text-slate-400">{row.description}</p></div>)}{!rows.length && <div className="p-10 text-center text-sm text-slate-500">Nenhuma definição persistida. Importe os padrões ou crie uma nova.</div>}</div></section>
            <DefinitionEditor row={editing} setRow={setEditing} payloadText={payloadText} setPayloadText={setPayloadText} save={saveDefinition} busy={busy} importText={importText} setImportText={setImportText} importRows={importRows} /></div></>}
      </main></div></div>;
}

function SettingsEditor({ config, setConfig, advancedText, setAdvancedText, save, busy }: { config: Config | null; setConfig: (value: Config) => void; advancedText: string; setAdvancedText: (value: string) => void; save: () => void; busy: boolean }) {
  if (!config) return <div className="studio-section p-8 text-slate-400">Carregando configuração…</div>;
  const numberFields = [["nexusStart","Vida do Nexus"],["maxMana","Mana máxima"],["maxSpellMana","Mana de feitiço"],["handCap","Limite da mão"],["startHand","Mão inicial"],["benchCap","Limite do banco"],["permanentsCap","Permanentes"],["deckMin","Deck mínimo"],["deckMax","Deck máximo"],["maxCopies","Máx. cópias"],["maxRegions","Máx. regiões"],["reactionMs","Reação (ms)"]];
  return <div className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]"><section className="studio-section p-5"><div className="studio-kicker">SAFE RUNTIME KNOBS</div><h2 className="mt-1 text-xl font-black">Regras globais</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{numberFields.map(([key,label]) => <label key={key}><span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span><input className="input" type="number" value={config[key]} onChange={(e) => setConfig({ ...config, [key]: Number(e.target.value) })} /></label>)}</div><div className="mt-4 grid gap-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.aiEnabled} onChange={(e) => setConfig({ ...config, aiEnabled: e.target.checked })} /> IA habilitada</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.rankedEnabled} onChange={(e) => setConfig({ ...config, rankedEnabled: e.target.checked })} /> Ranked configurado (ainda exige certificação do release)</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.maintenanceMode} onChange={(e) => setConfig({ ...config, maintenanceMode: e.target.checked })} /> Modo manutenção</label><label><span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Anúncio global</span><textarea className="input min-h-24" value={config.announcement} onChange={(e) => setConfig({ ...config, announcement: e.target.value })} /></label></div></section>
    <section className="studio-section p-5"><div className="flex items-center justify-between"><div><div className="studio-kicker text-red-300">CRITICAL RUNTIME OVERRIDES</div><h2 className="mt-1 text-xl font-black">Motor, IA e economia</h2></div><span className="studio-pill !border-red-400/30 !text-red-300">advanced</span></div><p className="mt-2 text-xs leading-5 text-slate-400">Contrato completo de motor, IA, matchmaking, ranked, economia, apresentação, idioma e moderação. O backend limita valores extremos e registra cada alteração.</p><textarea className="input mt-4 min-h-[560px] font-mono text-[11px] leading-5" spellCheck={false} value={advancedText} onChange={(e) => setAdvancedText(e.target.value)} /><div className="mt-4 flex justify-end"><button className="btn-primary" disabled={busy} onClick={save}>{busy ? "Salvando…" : "Salvar configuração completa"}</button></div></section></div>;
}

function DefinitionEditor({ row, setRow, payloadText, setPayloadText, save, busy, importText, setImportText, importRows }: { row: Row | null; setRow: (row: Row | null) => void; payloadText: string; setPayloadText: (value: string) => void; save: () => void; busy: boolean; importText: string; setImportText: (value: string) => void; importRows: () => void }) {
  if (!row) return <div className="space-y-5"><section className="studio-section border-dashed p-8 text-center text-sm text-slate-500">Selecione ou crie uma definição.</section><section className="studio-section p-5"><div className="font-black">Importação atômica</div><p className="mt-1 text-xs text-slate-500">Cole um array ou um export do Total Control. Nada será gravado se um item falhar.</p><textarea className="input mt-3 min-h-40 font-mono text-[10px]" value={importText} onChange={(e) => setImportText(e.target.value)} placeholder='{"items": [...]}'/><button className="btn-ghost mt-3" onClick={importRows}>Importar rascunhos</button></section></div>;
  const set = (key: keyof Row, value: any) => setRow({ ...row, [key]: value });
  return <section className="studio-section p-5"><div className="flex justify-between"><div><div className="studio-kicker">DEFINITION CONTRACT</div><div className="font-black">{row.id ? `Editar #${row.id}` : "Nova definição"}</div></div><button className="text-slate-500" onClick={() => setRow(null)}>×</button></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><label><span className="mb-1 block text-[10px] uppercase text-slate-500">Chave</span><input className="input" value={row.key} disabled={Boolean(row.id)} onChange={(e) => set("key",e.target.value)} /></label><label><span className="mb-1 block text-[10px] uppercase text-slate-500">Nome</span><input className="input" value={row.name} onChange={(e) => set("name",e.target.value)} /></label><label><span className="mb-1 block text-[10px] uppercase text-slate-500">Risco</span><select className="input" value={row.dangerLevel} onChange={(e) => set("dangerLevel",e.target.value)}>{["safe","elevated","critical"].map((x) => <option key={x}>{x}</option>)}</select></label><label><span className="mb-1 block text-[10px] uppercase text-slate-500">Schema</span><input className="input" type="number" value={row.schemaVersion} onChange={(e) => set("schemaVersion",Number(e.target.value))} /></label></div><label className="mt-3 block"><span className="mb-1 block text-[10px] uppercase text-slate-500">Descrição</span><textarea className="input min-h-20" value={row.description} onChange={(e) => set("description",e.target.value)} /></label><label className="mt-3 block"><span className="mb-1 block text-[10px] uppercase text-slate-500">Payload JSON</span><textarea className="input min-h-[430px] font-mono text-[11px] leading-5" spellCheck={false} value={payloadText} onChange={(e) => setPayloadText(e.target.value)} /></label><div className="mt-4 flex justify-end gap-2"><button className="btn-ghost" onClick={() => setRow(null)}>Cancelar</button><button className="btn-primary" disabled={busy || row.status === "published"} onClick={save}>{row.status === "published" ? "Arquive para editar" : busy ? "Salvando…" : "Salvar rascunho"}</button></div></section>;
}
