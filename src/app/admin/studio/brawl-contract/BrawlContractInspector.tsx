"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { StudioBreadcrumb, StudioCommandPalette } from "../StudioChrome";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";

type DefinitionRow = {
  id: number;
  key: string;
  name: string;
  description: string;
  status: string;
  enabled: boolean;
  schemaVersion: number;
  revision: number;
  payload: Record<string, unknown>;
};

type ContractField = {
  key: string;
  label: string;
  min: number;
  max: number;
  description: string;
};

type ContractPayload = {
  fields: ContractField[];
  unsupportedLegacyRules: string[];
  authority: string;
  runtimeNote: string;
};

type ValidationReport = { passed: boolean; errors: string[]; warnings: string[] };

const blankPayload = {
  id: "new-brawl",
  name: "Novo Brawl",
  description: "",
  emoji: "⚡",
  rules: { startingMana: 1, startingHand: 4, startingNexus: 20 },
};

export default function BrawlContractInspector() {
  const [rows, setRows] = useState<DefinitionRow[]>([]);
  const [contract, setContract] = useState<ContractPayload | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [key, setKey] = useState("new-brawl");
  const [name, setName] = useState("Novo Brawl");
  const [description, setDescription] = useState("");
  const [schemaVersion, setSchemaVersion] = useState(1);
  const [payloadText, setPayloadText] = useState(JSON.stringify(blankPayload, null, 2));
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [definitionsResponse, contractResponse] = await Promise.all([
        fetch("/api/admin/control?domain=brawls", { credentials: "include", cache: "no-store" }),
        fetch("/api/admin/control/brawl-contract", { credentials: "include", cache: "no-store" }),
      ]);
      const definitions = await definitionsResponse.json();
      const contractData = await contractResponse.json();
      if (!definitions.ok) throw new Error(definitions.error || "Could not load Brawl definitions");
      if (!contractData.ok) throw new Error(contractData.error || "Could not load Brawl contract");
      setRows(Array.isArray(definitions.rows) ? definitions.rows : []);
      setContract(contractData.contract || null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load Brawl contract inspector");
    } finally {
      setLoading(false);
    }
  }, []);

  useDeferredEffect(() => { load().catch(() => {}); }, [load]);

  const counts = useMemo(() => ({
    live: rows.filter((row) => row.status === "published" && row.enabled).length,
    draft: rows.filter((row) => row.status === "draft").length,
  }), [rows]);

  function selectDefinition(row: DefinitionRow) {
    setSelectedId(row.id);
    setKey(row.key);
    setName(row.name);
    setDescription(row.description || "");
    setSchemaVersion(row.schemaVersion || 1);
    setPayloadText(JSON.stringify(row.payload || {}, null, 2));
    setReport(null);
    setError("");
  }

  function resetDraft() {
    setSelectedId(null);
    setKey("new-brawl");
    setName("Novo Brawl");
    setDescription("");
    setSchemaVersion(1);
    setPayloadText(JSON.stringify(blankPayload, null, 2));
    setReport(null);
    setError("");
  }

  async function validate() {
    let payload: Record<string, unknown>;
    try {
      const parsed = JSON.parse(payloadText);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
      payload = parsed;
    } catch {
      setReport(null);
      setError("O payload precisa ser um objeto JSON válido antes da validação canônica.");
      return;
    }
    setValidating(true);
    setError("");
    try {
      const response = await fetch("/api/admin/control/brawl-contract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ key, name, description, schemaVersion, payload }),
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error || "Canonical validation failed");
      setReport(data.validation || null);
      if (data.contract) setContract(data.contract);
    } catch (cause) {
      setReport(null);
      setError(cause instanceof Error ? cause.message : "Canonical validation failed");
    } finally {
      setValidating(false);
    }
  }

  return <div className="studio-shell">
    <StudioCommandPalette />
    <header className="studio-topbar"><div className="studio-topbar-inner flex items-center justify-between"><div className="studio-brand"><div className="studio-brand-mark">⚡</div><div><div className="studio-kicker">RUNEFORGE // CONTROL PLANE</div><div className="studio-title">Brawl Contract Inspector</div></div></div><div className="flex gap-2"><Link href="/admin/studio/control" className="btn-ghost">Total Game Control</Link><Link href="/modes" className="btn-ghost">Game Modes</Link></div></div></header>
    <main className="studio-main mx-auto w-full max-w-[1500px]">
      <StudioBreadcrumb section="Total Control" current="Brawl Contract Inspector" />

      <section className="studio-hero mb-5">
        <p className="studio-kicker">AUTHORITATIVE PREFLIGHT // READ ONLY</p>
        <h2>⚡ Brawl Runtime Contract</h2>
        <p>Inspecione definições persistidas e valide qualquer payload contra o mesmo validator usado pelo save, publish e carregamento runtime. Esta tela não publica nem altera conteúdo.</p>
        <div className="mt-4 flex flex-wrap gap-2"><span className="studio-pill live">{counts.live} live</span><span className="studio-pill">{counts.draft} drafts</span><span className="studio-pill">{contract?.fields.length || 0} regras suportadas</span><span className="studio-pill !border-amber-400/30 !text-amber-200">canonical validator</span></div>
      </section>

      {error && <div className="mb-4 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-xs text-red-200">{error}</div>}

      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <div className="space-y-5">
          <section className="studio-section overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/5 p-4"><div><div className="studio-kicker">PERSISTED DEFINITIONS</div><h3 className="font-black">Brawls do Control Plane</h3></div><button className="btn-ghost !px-2 !py-1 text-[10px]" onClick={resetDraft}>Novo payload</button></div>
            <div className="max-h-[520px] divide-y divide-white/5 overflow-auto">
              {loading && <div className="p-6 text-sm text-slate-500">Carregando definições…</div>}
              {!loading && rows.map((row) => <button type="button" key={row.id} onClick={() => selectDefinition(row)} className={`block w-full p-4 text-left transition hover:bg-white/[.03] ${selectedId === row.id ? "bg-cyan-400/[.05]" : ""}`}><div className="flex items-start justify-between gap-3"><div><div className="font-black text-white">{row.name}</div><div className="mt-1 font-mono text-[10px] text-slate-500">brawls/{row.key} · rev {row.revision}</div></div><span className={`studio-pill ${row.status === "published" && row.enabled ? "live" : ""}`}>{row.status}</span></div><p className="mt-2 line-clamp-2 text-xs text-slate-400">{row.description || "Sem descrição."}</p></button>)}
              {!loading && !rows.length && <div className="p-6 text-sm text-slate-500">Nenhuma definição de Brawl persistida.</div>}
            </div>
          </section>

          <section className="studio-section p-4">
            <div className="studio-kicker">SUPPORTED RUNTIME SURFACE</div>
            <div className="mt-3 space-y-2">{contract?.fields.map((field) => <div key={field.key} className="rounded-xl border border-white/10 bg-white/[.02] p-3"><div className="flex items-center justify-between gap-3"><b className="text-sm text-white">{field.label}</b><span className="font-mono text-[10px] text-cyan-200">{field.key} · {field.min}–{field.max}</span></div><p className="mt-1 text-xs leading-5 text-slate-400">{field.description}</p></div>)}</div>
            {!!contract?.unsupportedLegacyRules.length && <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/[.05] p-3"><div className="text-[10px] font-black uppercase tracking-wider text-amber-200">Regras legadas rejeitadas</div><p className="mt-2 font-mono text-xs text-amber-100">{contract.unsupportedLegacyRules.join(" · ")}</p><p className="mt-2 text-[11px] leading-5 text-slate-400">Essas chaves existiram no tipo, mas nunca foram aplicadas pelo runtime. O validator agora falha fechado.</p></div>}
          </section>
        </div>

        <section className="studio-section p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="studio-kicker">CANONICAL VALIDATION</div><h3 className="mt-1 text-xl font-black">{selectedId ? `Inspecionando #${selectedId}` : "Payload de pré-flight"}</h3><p className="mt-1 text-xs text-slate-400">Authority: {contract?.authority || "validateControlDefinition"}. {contract?.runtimeNote}</p></div>{report && <span className={`rounded-full border px-3 py-1 text-[10px] font-black tracking-[.16em] ${report.passed ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-red-400/30 bg-red-400/10 text-red-200"}`}>{report.passed ? "PASS" : "FAIL"}</span>}</div>

          <div className="mt-5 grid gap-3 md:grid-cols-2"><label><span className="label">Chave administrativa</span><input className="input" value={key} onChange={(event) => { setKey(event.target.value); setReport(null); }} /></label><label><span className="label">Nome</span><input className="input" value={name} onChange={(event) => { setName(event.target.value); setReport(null); }} /></label><label className="md:col-span-2"><span className="label">Descrição</span><input className="input" value={description} onChange={(event) => { setDescription(event.target.value); setReport(null); }} /></label></div>

          <label className="mt-4 block"><span className="label">Payload JSON</span><textarea className="input min-h-[470px] font-mono text-[11px] leading-5" spellCheck={false} value={payloadText} onChange={(event) => { setPayloadText(event.target.value); setReport(null); }} /></label>

          {report && <div className="mt-4 grid gap-3 lg:grid-cols-2"><div className={`rounded-xl border p-4 ${report.errors.length ? "border-red-400/20 bg-red-400/[.05]" : "border-emerald-400/20 bg-emerald-400/[.05]"}`}><div className="label">Errors</div>{report.errors.length ? <div className="mt-2 space-y-2">{report.errors.map((item, index) => <div key={`${item}-${index}`} className="text-xs leading-5 text-red-200">• {item}</div>)}</div> : <p className="mt-2 text-xs text-emerald-300">Nenhum erro de contrato detectado.</p>}</div><div className="rounded-xl border border-white/10 bg-white/[.02] p-4"><div className="label">Warnings</div>{report.warnings.length ? <div className="mt-2 space-y-2">{report.warnings.map((item, index) => <div key={`${item}-${index}`} className="text-xs leading-5 text-amber-200">• {item}</div>)}</div> : <p className="mt-2 text-xs text-slate-500">Nenhum warning adicional.</p>}</div></div>}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><p className="max-w-2xl text-[11px] leading-5 text-slate-500">Pré-flight diagnóstico. A publicação continua protegida pelo Total Game Control, revisão CAS, auditoria e gates de release.</p><button className="btn-primary" onClick={validate} disabled={validating}>{validating ? "Validando…" : "Validar com servidor"}</button></div>
        </section>
      </div>
    </main>
  </div>;
}
