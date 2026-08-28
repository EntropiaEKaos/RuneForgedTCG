"use client";

import { useState } from "react";
import type { CardAuthoringModel } from "./CardAuthoringModel";
import { F, Panel } from "./CardAuthoringFields";

const DEFAULT_SCENARIO = '{\n  "sourceDefId": "",\n  "targetDefId": "",\n  "seed": 424242,\n  "mana": 5\n}';
const DEFAULT_EXPECTED = '{\n  "eventTypes": []\n}';

function responseError(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "error" in payload && typeof (payload as { error?: unknown }).error === "string") {
    return String((payload as { error: string }).error);
  }
  return fallback;
}

export default function CardQaStudio({ model }: { model: CardAuthoringModel }) {
  const {
    id,
    tests,
    testBusy,
    setTestBusy,
    testName,
    setTestName,
    testResult,
    setTestResult,
    loadTests,
  } = model;
  const [scenario, setScenario] = useState(DEFAULT_SCENARIO);
  const [expected, setExpected] = useState(DEFAULT_EXPECTED);
  const [editingTestId, setEditingTestId] = useState<number | null>(null);
  const [expandedTestId, setExpandedTestId] = useState<number | null>(null);

  const enabledCount = tests.filter((test: any) => test.enabled).length;
  const runPassed = testResult && typeof testResult === "object" && typeof testResult.passed === "boolean"
    ? testResult.passed
    : null;

  const resetEditor = () => {
    setEditingTestId(null);
    setTestName("");
    setScenario(DEFAULT_SCENARIO);
    setExpected(DEFAULT_EXPECTED);
  };

  const loadIntoEditor = (test: any) => {
    setEditingTestId(Number(test.id));
    setTestName(String(test.name || ""));
    setScenario(JSON.stringify(test.scenario ?? {}, null, 2));
    setExpected(JSON.stringify(test.expected ?? {}, null, 2));
    setTestResult(null);
  };

  const saveTest = async () => {
    if (!id || testBusy) return;
    let parsedScenario: unknown;
    let parsedExpected: unknown;
    try {
      parsedScenario = JSON.parse(scenario || "{}");
      parsedExpected = JSON.parse(expected || "{}");
    } catch {
      setTestResult({ ok: false, error: "Scenario e Expected precisam conter JSON válido." });
      return;
    }

    setTestBusy(true);
    try {
      const editing = editingTestId != null;
      const response = await fetch("/api/admin/studio/card-tests", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...(editing ? { testId: editingTestId } : { cardId: id }),
          name: testName.trim() || "Card regression test",
          scenario: parsedScenario,
          expected: parsedExpected,
          enabled: true,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        setTestResult({ ok: false, error: responseError(payload, "Não foi possível salvar o teste.") });
        return;
      }
      setTestResult({ ok: true, message: editing ? "Teste atualizado." : "Teste criado." });
      resetEditor();
      await loadTests(id);
    } catch {
      setTestResult({ ok: false, error: "Falha de rede ao salvar o teste." });
    } finally {
      setTestBusy(false);
    }
  };

  const toggleTest = async (test: any) => {
    if (!id || testBusy) return;
    setTestBusy(true);
    try {
      const response = await fetch("/api/admin/studio/card-tests", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          testId: test.id,
          name: test.name,
          scenario: test.scenario ?? {},
          expected: test.expected ?? {},
          enabled: !test.enabled,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        setTestResult({ ok: false, error: responseError(payload, "Não foi possível alterar o estado do teste.") });
        return;
      }
      setTestResult({ ok: true, message: test.enabled ? "Teste desabilitado." : "Teste habilitado." });
      await loadTests(id);
    } catch {
      setTestResult({ ok: false, error: "Falha de rede ao atualizar o teste." });
    } finally {
      setTestBusy(false);
    }
  };

  const removeTest = async (test: any) => {
    if (!id || testBusy) return;
    if (!window.confirm(`Excluir o teste “${String(test.name || `#${test.id}`)}”?`)) return;
    setTestBusy(true);
    try {
      const response = await fetch(`/api/admin/studio/card-tests?testId=${encodeURIComponent(String(test.id))}`, {
        method: "DELETE",
        credentials: "include",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        setTestResult({ ok: false, error: responseError(payload, "Não foi possível excluir o teste.") });
        return;
      }
      if (editingTestId === Number(test.id)) resetEditor();
      setTestResult({ ok: true, message: "Teste removido." });
      await loadTests(id);
    } catch {
      setTestResult({ ok: false, error: "Falha de rede ao excluir o teste." });
    } finally {
      setTestBusy(false);
    }
  };

  const runAll = async () => {
    if (!id || testBusy) return;
    setTestBusy(true);
    setTestResult(null);
    try {
      const response = await fetch("/api/admin/studio/card-tests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ cardId: id }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        setTestResult({ ok: false, error: responseError(payload, "Não foi possível executar a suíte de QA.") });
        return;
      }
      setTestResult(payload);
    } catch {
      setTestResult({ ok: false, error: "Falha de rede durante a execução da suíte de QA." });
    } finally {
      setTestBusy(false);
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
      <Panel title={editingTestId ? `Editar teste #${editingTestId}` : "Novo teste determinístico"} eyebrow="QA AUTHORING">
        <p className="text-xs leading-5 text-slate-400">
          Os casos são executados pelo runner de cartas do servidor e registram as versões de engine e ruleset usadas na execução.
        </p>
        <div className="mt-4">
          <F l="Test name">
            <input
              className="input"
              value={testName}
              onChange={(event) => setTestName(event.target.value)}
              placeholder="Summon buff applies"
              disabled={!id || testBusy}
            />
          </F>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <F l="Scenario">
            <textarea
              className="input min-h-56 font-mono text-[11px] leading-5"
              value={scenario}
              onChange={(event) => setScenario(event.target.value)}
              spellCheck={false}
              disabled={!id || testBusy}
            />
          </F>
          <F l="Expected">
            <textarea
              className="input min-h-56 font-mono text-[11px] leading-5"
              value={expected}
              onChange={(event) => setExpected(event.target.value)}
              spellCheck={false}
              disabled={!id || testBusy}
            />
          </F>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn-primary" onClick={saveTest} disabled={!id || testBusy}>
            {testBusy ? "Processando…" : editingTestId ? "Salvar alterações" : "Criar teste"}
          </button>
          {editingTestId && (
            <button className="btn-ghost" onClick={resetEditor} disabled={testBusy}>Cancelar edição</button>
          )}
          <button className="btn-ghost" onClick={runAll} disabled={!id || testBusy || enabledCount === 0}>
            {testBusy ? "Executando…" : `Executar suíte (${enabledCount})`}
          </button>
        </div>

        {testResult && (
          <div className={`mt-4 rounded-2xl border p-4 text-xs ${runPassed === true ? "border-emerald-400/25 bg-emerald-400/[.07] text-emerald-100" : runPassed === false || testResult.ok === false ? "border-red-400/25 bg-red-400/[.07] text-red-100" : "border-cyan-400/20 bg-cyan-400/[.06] text-cyan-100"}`}>
            <div className="font-black uppercase tracking-[.12em]">
              {runPassed === true ? "✓ QA passou" : runPassed === false ? "✕ QA falhou" : testResult.ok === false ? "Operação bloqueada" : "QA atualizado"}
            </div>
            {testResult.message && <p className="mt-2">{String(testResult.message)}</p>}
            {testResult.error && <p className="mt-2">{String(testResult.error)}</p>}
            {Array.isArray(testResult.results) && (
              <div className="mt-3 space-y-2">
                {testResult.results.map((entry: any) => (
                  <div key={entry.test?.id ?? entry.run?.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                    <span className="font-semibold">{entry.test?.name || `Teste #${entry.test?.id ?? "?"}`}</span>
                    <span className={entry.result?.passed ? "text-emerald-300" : "text-red-300"}>{entry.result?.passed ? "PASS" : "FAIL"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Panel>

      <Panel title="Regression Suite" eyebrow="COVERAGE & CONTROL">
        <div className="mb-4 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-xl border border-white/10 bg-white/[.03] p-3"><b className="block text-lg text-white">{tests.length}</b><span className="text-slate-500">Total</span></div>
          <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/[.05] p-3"><b className="block text-lg text-emerald-200">{enabledCount}</b><span className="text-slate-500">Habilitados</span></div>
          <div className="rounded-xl border border-white/10 bg-white/[.03] p-3"><b className="block text-lg text-slate-300">{tests.length - enabledCount}</b><span className="text-slate-500">Pausados</span></div>
        </div>

        <div className="space-y-2">
          {tests.map((test: any) => {
            const expanded = expandedTestId === Number(test.id);
            return (
              <div key={test.id} className={`rounded-2xl border p-3 ${test.enabled ? "border-emerald-400/15 bg-emerald-400/[.035]" : "border-white/8 bg-white/[.02]"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-black text-white">{test.name}</div>
                    <div className="mt-1 font-mono text-[10px] text-slate-500">#{test.id} · {test.enabled ? "Enabled" : "Disabled"}</div>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[9px] font-black ${test.enabled ? "bg-emerald-400/10 text-emerald-300" : "bg-slate-400/10 text-slate-500"}`}>
                    {test.enabled ? "ATIVO" : "PAUSADO"}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="btn-ghost text-xs" onClick={() => loadIntoEditor(test)} disabled={testBusy}>Editar</button>
                  <button className="btn-ghost text-xs" onClick={() => toggleTest(test)} disabled={testBusy}>{test.enabled ? "Desabilitar" : "Habilitar"}</button>
                  <button className="btn-ghost text-xs" onClick={() => setExpandedTestId(expanded ? null : Number(test.id))}>{expanded ? "Ocultar JSON" : "Ver JSON"}</button>
                  <button className="btn-ghost text-xs text-red-300" onClick={() => removeTest(test)} disabled={testBusy}>Excluir</button>
                </div>
                {expanded && (
                  <div className="mt-3 grid gap-2 text-[10px] lg:grid-cols-2">
                    <pre className="max-h-48 overflow-auto rounded-xl border border-white/8 bg-black/25 p-3 text-slate-400">{JSON.stringify(test.scenario ?? {}, null, 2)}</pre>
                    <pre className="max-h-48 overflow-auto rounded-xl border border-white/8 bg-black/25 p-3 text-slate-400">{JSON.stringify(test.expected ?? {}, null, 2)}</pre>
                  </div>
                )}
              </div>
            );
          })}
          {!tests.length && (
            <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-xs leading-5 text-slate-500">
              Nenhum teste cadastrado. O pipeline exige pelo menos um caso habilitado para QA/Publish.
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}
