"use client";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { EventTimeline, StatePanel, makeGraph, type GraphNode } from "./RuleBuilderParts";
import RuleBuilderCanvas from "./RuleBuilderCanvas";
import { effects, emptyRule, events, sources, targets, targetTypes, type CardFixture, type Rule } from "./RuleBuilderModel";

export default function RuleBuilder({
  value,
  setValue,
  eventOptions = events,
}: {
  value: any;
  setValue: (v: any) => void;
  eventOptions?: readonly string[];
}) {
  const allowedEvents = eventOptions.length ? eventOptions : events;
  const initial = useMemo<Rule>(() => {
    const candidate: Rule = {
      ...emptyRule,
      ...(value?.condition || {}),
      ...(value?.effect?.__ruleDsl || {}),
      fixture: { ...emptyRule.fixture, ...(value?.testFixture || {}) },
      graph: value?.graph,
    };
    const requestedEvent = String(value?.event ?? candidate.event);
    return {
      ...candidate,
      event: allowedEvents.includes(requestedEvent) ? requestedEvent : (allowedEvents[0] ?? candidate.event),
    };
  }, [allowedEvents, value]);
  const [rule, setRule] = useState<Rule>(initial);
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [cards, setCards] = useState<CardFixture[]>([]);
  const [cardBusy, setCardBusy] = useState(false);
  const [selectedNode, setSelectedNode] = useState<string>("effect");
  const [zoom, setZoom] = useState(1);
  const [showInspector, setShowInspector] = useState(true);
  useEffect(() => {
    setRule(initial);
    setResult(null);
  }, [initial]);
  useEffect(() => {
    let alive = true;
    setCardBusy(true);
    fetch("/api/admin/studio/rule-cards", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (alive && d.ok) setCards(d.cards || []);
      })
      .catch(() => {})
      .finally(() => alive && setCardBusy(false));
    return () => {
      alive = false;
    };
  }, []);
  const graph = useMemo(() => (rule.graph?.nodes?.length ? rule.graph : makeGraph(rule)), [rule]);
  const selected = graph.nodes.find((node) => node.id === selectedNode);
  const sync = (next: Rule) => {
    const safeEvent = allowedEvents.includes(next.event) ? next.event : (allowedEvents[0] ?? next.event);
    const safeNext = safeEvent === next.event ? next : { ...next, event: safeEvent };
    setRule(safeNext);
    setValue({
      ...value,
      name: value?.name || "New Interaction",
      sourceType: safeNext.sourceType,
      sourceKey: safeNext.sourceKey,
      event: safeNext.event,
      targetType: safeNext.targetType,
      targetKey: safeNext.targetKey,
      condition: { ...safeNext },
      effect: {
        kind: safeNext.effectKind,
        amount: Number(safeNext.amount) || 0,
        target: safeNext.target,
        buffPower: Number(safeNext.buffPower) || 0,
        buffHealth: Number(safeNext.buffHealth) || 0,
        classKey: safeNext.targetType === "class" ? safeNext.targetKey : undefined,
        race: safeNext.targetType === "race" ? safeNext.targetKey : undefined,
        keyword: safeNext.keyword || undefined,
        __ruleDsl: { ...safeNext },
      },
      graph: safeNext.graph,
      testFixture: safeNext.fixture,
    });
  };
  const set = (k: keyof Rule, v: any) => sync({ ...rule, [k]: v });
  const setFixture = (k: string, v: any) => sync({ ...rule, fixture: { ...rule.fixture!, [k]: v } });
  const addFollowup = () => {
    const id = `followup_${Date.now()}`;
    const node: GraphNode = {
      id,
      kind: "followup",
      label: "FOLLOW-UP",
      data: { effectKind: "draw", amount: 1, target: "none", buffPower: 0, buffHealth: 0, keyword: "" },
    };
    const nextGraph = { nodes: [...graph.nodes, node], edges: [...graph.edges, ["effect", id] as [string, string]] };
    sync({ ...rule, graph: nextGraph });
    setSelectedNode(id);
  };
  const removeNode = (id: string) => {
    if (["trigger", "condition", "target", "effect"].includes(id)) return;
    const nodes = graph.nodes.filter((n) => n.id !== id);
    sync({ ...rule, graph: { nodes, edges: graph.edges.filter(([a, b]) => a !== id && b !== id) } });
    setSelectedNode("effect");
  };
  const updateNode = (id: string, k: string, v: any) => {
    const nodes = graph.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, [k]: v } } : n));
    sync({ ...rule, graph: { ...graph, nodes } });
  };
  const test = async () => {
    setBusy(true);
    setResult(null);
    try {
      const r = await fetch("/api/admin/studio/rule-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(rule),
      });
      setResult(await r.json());
    } catch {
      setResult({ ok: false, error: "Could not reach sandbox" });
    } finally {
      setBusy(false);
    }
  };
  const cardOptions = cards.length
    ? cards
    : [
        {
          defId: "ember_whelp",
          name: "Ember Whelp",
          emoji: "🐉",
          region: "Emberhold",
          classes: ["dragon"],
          power: 1,
          health: 1,
          keywords: [],
        },
        {
          defId: "ember_drake",
          name: "Ember Drake",
          emoji: "🔥",
          region: "Emberhold",
          classes: ["dragon"],
          power: 4,
          health: 4,
          keywords: [],
        },
      ];
  const updateSelected = (key: string, v: any) => {
    if (!selected) return;
    if (selected.kind === "trigger") set("event", v);
    else if (selected.kind === "condition") key === "sourceType" ? set("sourceType", v) : set("sourceKey", v);
    else if (selected.kind === "target") {
      if (key === "targetType") set("targetType", v);
      else if (key === "targetKey") set("targetKey", v);
      else set("target", v);
    } else if (selected.kind === "effect") set(key as keyof Rule, v);
    else updateNode(selected.id, key, v);
  };
  const field = (label: string, content: ReactNode) => (
    <label className="block">
      <span className="mb-1 block text-[10px] font-black uppercase tracking-[.14em] text-slate-500">{label}</span>
      {content}
    </label>
  );
  const select = (v: any, onChange: (x: string) => void, opts: readonly string[]) => (
    <select className="input" value={String(v ?? "")} onChange={(e) => onChange(e.target.value)}>
      {opts.map((x) => (
        <option key={x}>{x}</option>
      ))}
    </select>
  );
  return (
    <div className="space-y-5">
      <RuleBuilderCanvas
        rule={rule}
        graph={graph}
        selectedNode={selectedNode}
        setSelectedNode={setSelectedNode}
        zoom={zoom}
        setZoom={setZoom}
        showInspector={showInspector}
        setShowInspector={setShowInspector}
        busy={busy}
        test={test}
        addFollowup={addFollowup}
        removeNode={removeNode}
        updateSelected={updateSelected}
      />
      <div className="grid gap-4 xl:grid-cols-[1fr_430px]">
        <section className="rounded-2xl border border-white/10 bg-black/10 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="font-black">ENGINE CONTRACT</h3>
              <p className="text-[11px] text-slate-500">Typed parameters used by the canonical Runeforge engine.</p>
            </div>
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/[.06] px-2 py-1 text-[9px] font-black text-emerald-300">
              ENGINE SAFE
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {field(
              "Source",
              select(rule.sourceType, (v) => set("sourceType", v), sources),
            )}
            {field(
              "Source key",
              <input className="input" value={rule.sourceKey} onChange={(e) => set("sourceKey", e.target.value)} />,
            )}
            {field(
              "Event",
              select(rule.event, (v) => set("event", v), allowedEvents),
            )}
            {field(
              "Target group",
              select(rule.targetType, (v) => set("targetType", v), targetTypes),
            )}
            {field(
              "Target key",
              <input className="input" value={rule.targetKey} onChange={(e) => set("targetKey", e.target.value)} />,
            )}
            {field(
              "Engine target",
              select(rule.target, (v) => set("target", v), targets),
            )}
            {field(
              "Effect",
              select(rule.effectKind, (v) => set("effectKind", v), effects),
            )}
            {field(
              "Amount",
              <input
                className="input"
                type="number"
                value={rule.amount}
                onChange={(e) => set("amount", Number(e.target.value))}
              />,
            )}
            {field(
              "Power",
              <input
                className="input"
                type="number"
                value={rule.buffPower}
                onChange={(e) => set("buffPower", Number(e.target.value))}
              />,
            )}
            {field(
              "Health",
              <input
                className="input"
                type="number"
                value={rule.buffHealth}
                onChange={(e) => set("buffHealth", Number(e.target.value))}
              />,
            )}
          </div>
          {field(
            "Keyword",
            <input className="input mt-0" value={rule.keyword} onChange={(e) => set("keyword", e.target.value)} />,
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn-primary" onClick={test} disabled={busy}>
              {busy ? "Running engine…" : "▶ Simulate in Engine"}
            </button>
            <button
              className="btn-ghost"
              onClick={() => {
                const resetRule: Rule = { ...emptyRule, event: allowedEvents[0] ?? emptyRule.event };
                sync({ ...resetRule, graph: makeGraph(resetRule) });
                setSelectedNode("effect");
                setZoom(1);
              }}
            >
              Reset graph
            </button>
          </div>
        </section>
        <section className="rounded-2xl border border-white/10 bg-black/10 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-black">FIXTURE LAB</h3>
              <p className="text-[11px] text-slate-500">Real CardDef fixtures</p>
            </div>
            {cardBusy && <span className="text-[10px] text-slate-500">Loading…</span>}
          </div>
          <div className="mt-3 space-y-3">
            {field(
              "Source unit",
              select(
                rule.fixture?.sourceDefId,
                (v) => setFixture("sourceDefId", v),
                cardOptions.map((c) => c.defId),
              ),
            )}
            {field(
              "Target unit",
              select(
                rule.fixture?.targetDefId,
                (v) => setFixture("targetDefId", v),
                cardOptions.map((c) => c.defId),
              ),
            )}
            {field(
              "Enemy unit",
              select(
                rule.fixture?.enemyDefId,
                (v) => setFixture("enemyDefId", v),
                cardOptions.map((c) => c.defId),
              ),
            )}
            <div className="grid grid-cols-2 gap-2">
              {field(
                "Seed",
                <input
                  className="input"
                  type="number"
                  value={rule.fixture?.seed}
                  onChange={(e) => setFixture("seed", Number(e.target.value))}
                />,
              )}
              {field(
                "Mana",
                <input
                  className="input"
                  type="number"
                  value={rule.fixture?.mana}
                  onChange={(e) => setFixture("mana", Number(e.target.value))}
                />,
              )}
            </div>
          </div>
        </section>
      </div>
      {result && (
        <section
          className={`overflow-hidden rounded-3xl border ${result.ok ? "border-emerald-400/20 bg-emerald-400/[.03]" : "border-red-400/20 bg-red-400/[.03]"}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4">
            <div>
              <div className="text-[9px] font-black tracking-[.2em] text-slate-500">SIMULATION LAB</div>
              <h3 className="mt-1 text-xl font-black">{result.ok ? "Engine Timeline" : "Rule Rejected"}</h3>
              {result.ok && (
                <p className="text-[11px] text-slate-500">
                  {result.context?.source?.name} → {result.context?.trigger} → {result.context?.target?.name}
                </p>
              )}
            </div>
            {result.ok ? (
              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-black text-emerald-300">
                ✓ ENGINE EXECUTED
              </span>
            ) : (
              <span className="rounded-full border border-red-400/20 bg-red-400/10 px-3 py-1 text-xs font-black text-red-300">
                BLOCKED
              </span>
            )}
          </div>
          {result.ok ? (
            <div className="grid gap-0 lg:grid-cols-[.9fr_1.2fr_.9fr]">
              <StatePanel title="BEFORE" tone="slate" value={result.before} />
              <EventTimeline events={result.events || []} />
              <StatePanel title="AFTER" tone="emerald" value={result.after} />
            </div>
          ) : (
            <p className="p-5 text-sm text-red-300">{result.error}</p>
          )}
        </section>
      )}
    </div>
  );
}