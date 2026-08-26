"use client";
import type { ReactNode } from "react";
import type { GraphNode } from "./RuleBuilderParts";
import type { Rule } from "./RuleBuilderModel";
import { effects, events, kindDot, kindStyle, sources, targets, targetTypes } from "./RuleBuilderModel";

type RuleGraph = { nodes: GraphNode[]; edges: [string, string][] };

type Props = {
  rule: Rule;
  graph: RuleGraph;
  selectedNode: string;
  setSelectedNode: (id: string) => void;
  zoom: number;
  setZoom: (value: number) => void;
  showInspector: boolean;
  setShowInspector: (value: boolean | ((value: boolean) => boolean)) => void;
  busy: boolean;
  test: () => void;
  addFollowup: () => void;
  removeNode: (id: string) => void;
  updateSelected: (key: string, value: unknown) => void;
};

const field = (label: string, content: ReactNode) => (
  <label className="block">
    <span className="mb-1 block text-[10px] font-black uppercase tracking-[.14em] text-slate-500">{label}</span>
    {content}
  </label>
);

const select = (value: unknown, onChange: (value: string) => void, options: readonly string[]) => (
  <select className="input" value={String(value ?? "")} onChange={(event) => onChange(event.target.value)}>
    {options.map((option) => <option key={option}>{option}</option>)}
  </select>
);

export default function RuleBuilderCanvas(props: Props) {
  const {
    rule, graph, selectedNode, setSelectedNode, zoom, setZoom, showInspector, setShowInspector,
    busy, test, addFollowup, removeNode, updateSelected,
  } = props;
  const selected = graph.nodes.find((node) => node.id === selectedNode) || graph.nodes[0];
  const nodeLabel = (node: GraphNode) =>
    node.kind === "trigger" ? rule.event
      : node.kind === "condition" ? `${rule.sourceType}:${rule.sourceKey || "*"}`
        : node.kind === "target" ? `${rule.targetType}:${rule.targetKey || "*"}`
          : node.kind === "effect" ? rule.effectKind : node.data.effectKind || "draw";
  const nodeSummary = (node: GraphNode) =>
    node.kind === "trigger" ? "Entry event"
      : node.kind === "condition" ? "Gate the rule by card context"
        : node.kind === "target" ? `${rule.target} · ${rule.targetType}`
          : node.kind === "effect"
            ? `${rule.buffPower >= 0 ? "+" : ""}${rule.buffPower} power · ${rule.buffHealth >= 0 ? "+" : ""}${rule.buffHealth} health`
            : `${node.data.amount || 0} amount`;

  return <>
    <div className="studio-graph-toolbar rounded-2xl border border-white/10 bg-[#080c15]/90 p-3 shadow-2xl shadow-black/20">
      <div>
        <div className="text-[10px] font-black tracking-[.25em] text-amber-300">RULE GRAPH STUDIO // CANVAS</div>
        <h3 className="mt-1 text-lg font-black">Visual rule authoring</h3>
        <p className="text-[11px] text-slate-500">Select a node to inspect it. Zoom and minimap are visual controls only; the typed graph remains the source of truth.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => setZoom(Math.max(0.75, Number((zoom - 0.1).toFixed(2))))}>−</button>
        <span className="min-w-12 text-center text-xs font-black text-slate-300">{Math.round(zoom * 100)}%</span>
        <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => setZoom(Math.min(1.35, Number((zoom + 0.1).toFixed(2))))}>+</button>
        <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => setZoom(1)}>Fit</button>
        <button className={`btn-ghost !px-3 !py-1.5 text-xs ${showInspector ? "border-amber-400/30 text-amber-200" : ""}`} onClick={() => setShowInspector((value) => !value)}>Inspector</button>
        <button className="btn-primary !px-4 !py-1.5 text-xs" onClick={test} disabled={busy}>{busy ? "Running…" : "▶ Simulate"}</button>
      </div>
    </div>
    <section className="studio-graph-shell overflow-hidden rounded-3xl border border-white/10 bg-[#050812] shadow-2xl shadow-black/30">
      <div className="grid min-h-[560px] xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="relative min-h-[560px] overflow-hidden bg-[radial-gradient(circle_at_50%_20%,rgba(99,102,241,.11),transparent_36rem)]">
          <div className="studio-grid absolute inset-0" />
          <div className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[10px] text-slate-500 backdrop-blur"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,.8)]" /> GRAPH VALIDATED STRUCTURE</div>
          <div className="absolute bottom-4 left-4 z-10 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[10px] text-slate-500 backdrop-blur">Drag-ready canvas · {graph.nodes.length} nodes · {graph.edges.length} connections</div>
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1000 560" preserveAspectRatio="none" aria-hidden="true">
            {graph.edges.map(([from, to]) => {
              const fromIndex = graph.nodes.findIndex((node) => node.id === from);
              const toIndex = graph.nodes.findIndex((node) => node.id === to);
              const x1 = 150 + fromIndex * 170 + 135, y1 = 280, x2 = 150 + toIndex * 170, y2 = 280;
              const cx = (x1 + x2) / 2;
              return <path key={`${from}-${to}`} d={`M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`} fill="none" stroke="rgba(251,191,36,.45)" strokeWidth="2" strokeDasharray="6 5" />;
            })}
          </svg>
          <div className="relative z-10 flex h-[560px] min-w-[900px] items-center px-8" style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}>
            <div className="flex w-full items-center justify-center gap-5">
              {graph.nodes.map((node, index) => <div key={node.id} className="flex items-center gap-5">
                <button onClick={() => setSelectedNode(node.id)} className={`studio-node relative w-[154px] rounded-2xl border p-3 text-left shadow-xl transition ${kindStyle[node.kind]} ${selectedNode === node.id ? "ring-2 ring-amber-300/80 ring-offset-2 ring-offset-[#050812]" : "hover:-translate-y-1 hover:border-white/20"}`}>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-[9px] font-black tracking-[.18em] text-slate-400"><i className={`h-2 w-2 rounded-full ${kindDot[node.kind]}`} />{node.label}</span>
                    {node.kind === "followup" && <span onClick={(event) => { event.stopPropagation(); removeNode(node.id); }} className="cursor-pointer text-slate-500 hover:text-red-300">×</span>}
                  </div>
                  <div className="mt-3 truncate text-sm font-black text-white">{nodeLabel(node)}</div>
                  <div className="mt-1 min-h-7 text-[10px] leading-4 text-slate-500">{nodeSummary(node)}</div>
                  <div className="mt-3 flex items-center justify-between text-[9px] text-slate-600"><span>#{index + 1}</span><span>{node.kind}</span></div>
                </button>
                {index < graph.nodes.length - 1 && <span className="relative z-20 text-amber-300/70">→</span>}
              </div>)}
              <button onClick={addFollowup} className="flex h-[84px] w-[84px] items-center justify-center rounded-2xl border border-dashed border-emerald-300/20 bg-emerald-300/[.03] text-[10px] font-black text-emerald-200/70 hover:border-emerald-300/50">+ FOLLOW-UP</button>
            </div>
          </div>
          <div className="studio-minimap absolute bottom-4 right-4 z-20 hidden w-44 rounded-xl border border-white/10 bg-black/60 p-2 backdrop-blur md:block">
            <div className="mb-2 text-[8px] font-black tracking-[.18em] text-slate-500">MINIMAP</div>
            <div className="flex h-12 items-center justify-center gap-1 rounded-lg bg-white/[.02]">{graph.nodes.map((node) => <span key={node.id} className={`h-2 w-6 rounded-full ${kindDot[node.kind]}`} />)}</div>
          </div>
        </div>
        {showInspector && <aside className="border-t border-white/10 bg-[#070b13] p-4 xl:border-l xl:border-t-0">
          <div className="mb-4 flex items-center justify-between"><div><div className="text-[9px] font-black tracking-[.2em] text-amber-300">NODE INSPECTOR</div><div className="mt-1 text-lg font-black">{selected?.label || "Select node"}</div></div><span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${selected ? kindStyle[selected.kind] : "bg-white/5"}`}>{selected?.kind}</span></div>
          {selected && <div className="space-y-3">
            {selected.kind === "trigger" && field("Event", select(rule.event, (value) => updateSelected("event", value), events))}
            {selected.kind === "condition" && <>{field("Source", select(rule.sourceType, (value) => updateSelected("sourceType", value), sources))}{field("Source key", <input className="input" value={rule.sourceKey} onChange={(event) => updateSelected("sourceKey", event.target.value)} />)}</>}
            {selected.kind === "target" && <>{field("Target group", select(rule.targetType, (value) => updateSelected("targetType", value), targetTypes))}{field("Target key", <input className="input" value={rule.targetKey} onChange={(event) => updateSelected("targetKey", event.target.value)} />)}{field("Engine target", select(rule.target, (value) => updateSelected("target", value), targets))}</>}
            {(selected.kind === "effect" || selected.kind === "followup") && <>
              {field("Effect", select(selected.kind === "effect" ? rule.effectKind : selected.data.effectKind, (value) => updateSelected("effectKind", value), effects))}
              {field("Amount", <input className="input" type="number" value={selected.kind === "effect" ? rule.amount : selected.data.amount || 0} onChange={(event) => updateSelected("amount", Number(event.target.value))} />)}
              {field("Power", <input className="input" type="number" value={selected.kind === "effect" ? rule.buffPower : selected.data.buffPower || 0} onChange={(event) => updateSelected("buffPower", Number(event.target.value))} />)}
              {field("Health", <input className="input" type="number" value={selected.kind === "effect" ? rule.buffHealth : selected.data.buffHealth || 0} onChange={(event) => updateSelected("buffHealth", Number(event.target.value))} />)}
              {field("Keyword", <input className="input" value={selected.kind === "effect" ? rule.keyword : selected.data.keyword || ""} onChange={(event) => updateSelected("keyword", event.target.value)} />)}
            </>}
          </div>}
          <div className="mt-6 border-t border-white/10 pt-4"><div className="text-[9px] font-black tracking-[.18em] text-slate-500">GRAPH CONTRACT</div><div className="mt-2 space-y-2 text-[10px] text-slate-500"><div className="flex justify-between"><span>Nodes</span><b className="text-slate-300">{graph.nodes.length}</b></div><div className="flex justify-between"><span>Edges</span><b className="text-slate-300">{graph.edges.length}</b></div><div className="flex justify-between"><span>Execution</span><b className="text-emerald-300">ENGINE</b></div><div className="flex justify-between"><span>Arbitrary code</span><b className="text-emerald-300">BLOCKED</b></div></div></div>
          <button className="btn-ghost mt-5 w-full text-xs" onClick={addFollowup}>+ Add follow-up effect</button>
        </aside>}
      </div>
    </section>
  </>;
}
