"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { StudioBreadcrumb, StudioCommandPalette } from "../StudioChrome";

type CardRow = {
  id: number;
  defId: string;
  name: string;
  enabled: boolean;
  data?: {
    type?: string;
    rarity?: string;
    region?: string;
    regions?: string[];
    cost?: number;
    emoji?: string;
  };
};

type LabCase = {
  seed: number;
  playable: boolean;
  resolved: boolean;
  logEntries: number;
  playerNexus: number;
  opponentNexus: number;
  error?: string;
};

type LabReport = {
  defId: string;
  valid: boolean;
  cases: LabCase[];
  passed: number;
  failed: number;
  warnings: string[];
};

type LabRun = {
  id?: number;
  defId?: string;
  iterations?: number;
  passed?: number;
  failed?: number;
  engineVersion?: string;
  rulesetVersion?: string;
  contentVersion?: string;
};

type LabResponse = {
  ok: boolean;
  error?: string;
  run?: LabRun;
  report?: LabReport;
};

const ITERATION_PRESETS = [
  { value: 12, label: "Rápido", detail: "checagem de criação" },
  { value: 30, label: "QA", detail: "amostra recomendada" },
  { value: 60, label: "Stress", detail: "cobertura ampliada" },
  { value: 100, label: "Máximo", detail: "limite do servidor" },
];

function getRegions(row?: CardRow | null) {
  const regions = row?.data?.regions?.length ? row.data.regions : row?.data?.region ? [row.data.region] : [];
  return regions.join(" + ") || "Sem região";
}

function caseStatus(testCase: LabCase) {
  if (testCase.error) return { label: "Erro", tone: "border-red-400/25 bg-red-400/10 text-red-200" };
  if (!testCase.playable) return { label: "Não jogável", tone: "border-amber-400/25 bg-amber-400/10 text-amber-200" };
  if (testCase.resolved) return { label: "Resolvido", tone: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200" };
  return { label: "Falhou", tone: "border-red-400/25 bg-red-400/10 text-red-200" };
}

export default function CardLabClient() {
  const [cards, setCards] = useState<CardRow[]>([]);
  const [defId, setDefId] = useState("");
  const [iterations, setIterations] = useState(30);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<LabResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useDeferredEffect(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/studio/cards?limit=300", { credentials: "include" });
      const payload = await response.json().catch(() => null) as { rows?: CardRow[]; error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || "Não foi possível carregar o catálogo de cartas.");
      const rows = Array.isArray(payload?.rows) ? payload.rows : [];
      setCards(rows);
      if (rows.length > 0) setDefId((current) => current || rows[0].defId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao carregar o laboratório.");
    } finally {
      setLoading(false);
    }
  }, []);

  const filteredCards = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return cards;
    return cards.filter((row) => {
      const haystack = [row.name, row.defId, row.data?.type, row.data?.rarity, row.data?.region, ...(row.data?.regions || [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [cards, query]);

  const selectedCard = useMemo(() => cards.find((row) => row.defId === defId) ?? null, [cards, defId]);
  const report = result?.report ?? null;
  const total = report ? report.passed + report.failed : 0;
  const passRate = total > 0 ? Math.round((report!.passed / total) * 100) : 0;
  const playableCases = report?.cases.filter((testCase) => testCase.playable).length ?? 0;
  const resolvedCases = report?.cases.filter((testCase) => testCase.resolved).length ?? 0;
  const erroredCases = report?.cases.filter((testCase) => Boolean(testCase.error)).length ?? 0;

  async function run() {
    if (!defId || busy) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/admin/studio/card-lab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ defId, iterations }),
      });
      const payload = await response.json().catch(() => null) as LabResponse | null;
      if (!response.ok || !payload?.ok || !payload.report) {
        throw new Error(payload?.error || "O laboratório não conseguiu concluir o run.");
      }
      setResult(payload);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha inesperada ao executar o laboratório.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="studio-shell min-h-screen">
      <StudioCommandPalette />
      <div className="studio-main mx-auto max-w-[1500px] p-5 sm:p-8">
        <StudioBreadcrumb section="QA" current="Card Laboratory" />

        <header className="mt-5 overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/70 shadow-2xl shadow-black/30">
          <div className="bg-gradient-to-br from-cyan-400/10 via-transparent to-fuchsia-400/10 px-5 py-7 sm:px-8">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div className="max-w-3xl">
                <div className="studio-kicker">QA // ENGINE</div>
                <h1 className="studio-title mt-2">Automated Card Laboratory</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                  Execute cenários determinísticos contra a engine real para confirmar se uma carta customizada valida,
                  entra em jogo e resolve sem exceções. O laboratório não publica, não altera a carta e não modifica o registro global do engine.
                </p>
              </div>
              <div className="grid min-w-[230px] gap-2 text-xs">
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3">
                  <p className="font-black uppercase tracking-wider text-emerald-200">Execução</p>
                  <p className="mt-1 text-emerald-50">Server-side · persistida</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <p className="font-black uppercase tracking-wider text-slate-400">Limite por run</p>
                  <p className="mt-1 font-semibold text-white">1–100 cenários</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {error && (
          <div className="mt-5 rounded-2xl border border-red-400/25 bg-red-400/10 p-4 text-sm text-red-100" role="alert">
            <p className="font-black">Laboratório indisponível</p>
            <p className="mt-1 text-red-200/80">{error}</p>
          </div>
        )}

        <div className="mt-6 grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/65">
            <div className="border-b border-white/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-300">Catálogo</p>
                  <h2 className="mt-1 font-black text-white">Carta sob teste</h2>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold text-slate-400">
                  {cards.length}
                </span>
              </div>
              <input
                className="input mt-4 w-full"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por nome, defId, tipo…"
                aria-label="Buscar cartas"
              />
            </div>

            <div className="max-h-[660px] space-y-2 overflow-y-auto p-3">
              {loading && <div className="p-5 text-center text-xs text-slate-500">Carregando catálogo…</div>}
              {!loading && filteredCards.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-xs text-slate-500">
                  Nenhuma carta encontrada.
                </div>
              )}
              {filteredCards.map((row) => {
                const selected = row.defId === defId;
                return (
                  <button
                    key={row.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      setDefId(row.defId);
                      setResult(null);
                    }}
                    className={`w-full rounded-2xl border p-3 text-left transition ${selected ? "border-cyan-300/50 bg-cyan-300/10" : "border-white/10 bg-white/[0.025] hover:border-white/20 hover:bg-white/[0.05]"}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-black/20 text-xl">
                        {row.data?.emoji || "🃏"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate font-black text-white">{row.name || row.defId}</p>
                          <span className={`h-2 w-2 shrink-0 rounded-full ${row.enabled ? "bg-emerald-400" : "bg-amber-400"}`} title={row.enabled ? "Publicada" : "Draft/QA"} />
                        </div>
                        <p className="mt-1 truncate font-mono text-[10px] text-slate-500">{row.defId}</p>
                        <p className="mt-2 text-[10px] text-slate-400">{row.data?.type || "Card"} · {row.data?.rarity || "—"} · {getRegions(row)}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="space-y-5">
            <div className="rounded-3xl border border-white/10 bg-slate-950/65 p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-fuchsia-300">Configuração do run</p>
                  <h2 className="mt-1 text-xl font-black text-white">{selectedCard?.name || "Selecione uma carta"}</h2>
                  <p className="mt-1 font-mono text-xs text-slate-500">{selectedCard?.defId || "—"}</p>
                </div>
                {selectedCard && (
                  <Link href={`/admin/studio/cards?card=${encodeURIComponent(selectedCard.defId)}`} className="btn-ghost inline-flex">
                    Abrir no Card Studio
                  </Link>
                )}
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {ITERATION_PRESETS.map((preset) => {
                  const selected = preset.value === iterations;
                  return (
                    <button
                      key={preset.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setIterations(preset.value)}
                      className={`rounded-2xl border p-3 text-left transition ${selected ? "border-fuchsia-300/50 bg-fuchsia-300/10" : "border-white/10 bg-white/[0.025] hover:border-white/20"}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-black text-white">{preset.label}</span>
                        <span className="font-mono text-xs text-fuchsia-200">{preset.value}x</span>
                      </div>
                      <p className="mt-1 text-[10px] text-slate-500">{preset.detail}</p>
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs leading-5 text-slate-400">
                  <p className="font-bold text-slate-200">Run determinístico</p>
                  <p>Seeds controladas pelo servidor, mana preparada e snapshot temporário da carta.</p>
                </div>
                <button className="btn-primary min-w-[190px]" disabled={busy || !defId || loading} onClick={run}>
                  {busy ? "Executando…" : "Run Engine Lab"}
                </button>
              </div>
            </div>

            {!result && !busy && (
              <div className="grid min-h-[300px] place-items-center rounded-3xl border border-dashed border-white/10 bg-white/[0.015] p-8 text-center">
                <div className="max-w-md">
                  <div className="text-4xl">🧪</div>
                  <h3 className="mt-3 text-lg font-black text-white">Workbench pronto</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Escolha uma carta e uma intensidade de teste. O resultado mostrará validação, resolução por seed e warnings do laboratório.
                  </p>
                </div>
              </div>
            )}

            {report && (
              <>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Pass rate</p>
                    <p className={`mt-2 text-3xl font-black ${passRate === 100 ? "text-emerald-300" : passRate >= 80 ? "text-amber-300" : "text-red-300"}`}>{passRate}%</p>
                    <p className="mt-1 text-xs text-slate-500">{report.passed} passou · {report.failed} falhou</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Jogável</p>
                    <p className="mt-2 text-3xl font-black text-cyan-300">{playableCases}/{report.cases.length}</p>
                    <p className="mt-1 text-xs text-slate-500">cenários com play permitido</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Resolvido</p>
                    <p className="mt-2 text-3xl font-black text-fuchsia-300">{resolvedCases}</p>
                    <p className="mt-1 text-xs text-slate-500">ações alteraram o estado</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Exceções</p>
                    <p className={`mt-2 text-3xl font-black ${erroredCases === 0 ? "text-emerald-300" : "text-red-300"}`}>{erroredCases}</p>
                    <p className="mt-1 text-xs text-slate-500">erros capturados pelo run</p>
                  </div>
                </div>

                <div className={`rounded-3xl border p-5 ${report.valid && report.failed === 0 ? "border-emerald-400/20 bg-emerald-400/[0.07]" : "border-amber-400/20 bg-amber-400/[0.07]"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Resultado do laboratório</p>
                      <h3 className="mt-1 text-xl font-black text-white">
                        {report.valid && report.failed === 0 ? "✓ Carta passou pelo run" : report.valid ? "Atenção: existem cenários a revisar" : "Validação da carta bloqueada"}
                      </h3>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[10px] text-slate-400">
                      {result.run?.engineVersion && <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1">Engine {result.run.engineVersion}</span>}
                      {result.run?.rulesetVersion && <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1">Rules {result.run.rulesetVersion}</span>}
                      {result.run?.contentVersion && <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1">Content {result.run.contentVersion}</span>}
                    </div>
                  </div>
                  {report.warnings.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {report.warnings.map((warning, index) => (
                        <div key={`${warning}-${index}`} className="rounded-xl border border-amber-400/20 bg-black/15 px-3 py-2 text-xs text-amber-100">⚠ {warning}</div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/65">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-300">Seeds determinísticas</p>
                      <h3 className="mt-1 font-black text-white">Matriz de execução</h3>
                    </div>
                    <span className="text-xs text-slate-500">{report.cases.length} casos</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left text-xs">
                      <thead className="bg-white/[0.025] text-[10px] uppercase tracking-wider text-slate-500">
                        <tr>
                          <th className="px-5 py-3">Seed</th>
                          <th className="px-3 py-3">Status</th>
                          <th className="px-3 py-3">Jogável</th>
                          <th className="px-3 py-3">Resolveu</th>
                          <th className="px-3 py-3">Log</th>
                          <th className="px-3 py-3">Nexus P</th>
                          <th className="px-3 py-3">Nexus O</th>
                          <th className="px-5 py-3">Erro</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {report.cases.map((testCase) => {
                          const status = caseStatus(testCase);
                          return (
                            <tr key={testCase.seed} className="text-slate-300 hover:bg-white/[0.025]">
                              <td className="px-5 py-3 font-mono text-cyan-200">{testCase.seed}</td>
                              <td className="px-3 py-3"><span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${status.tone}`}>{status.label}</span></td>
                              <td className="px-3 py-3">{testCase.playable ? "✓" : "—"}</td>
                              <td className="px-3 py-3">{testCase.resolved ? "✓" : "—"}</td>
                              <td className="px-3 py-3 font-mono">{testCase.logEntries}</td>
                              <td className="px-3 py-3 font-mono">{testCase.playerNexus}</td>
                              <td className="px-3 py-3 font-mono">{testCase.opponentNexus}</td>
                              <td className="max-w-[320px] truncate px-5 py-3 text-red-200/80" title={testCase.error}>{testCase.error || "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>

        <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-xs text-slate-500">
          <span>Engine-safe · snapshot temporário · run persistido · sem publish automático</span>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/studio/cards" className="btn-ghost inline-flex">Card Studio</Link>
            <Link href="/admin/studio/production" className="btn-ghost inline-flex">Production</Link>
            <Link href="/admin/studio" className="btn-ghost inline-flex">Control Room</Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
