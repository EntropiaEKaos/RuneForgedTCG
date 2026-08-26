"use client";

export type NodeKind = "trigger" | "condition" | "target" | "effect" | "followup";
export type GraphNode = { id: string; kind: NodeKind; label: string; data: Record<string, any> };

export function makeGraph(r: {
  event: string;
  sourceType: string;
  sourceKey: string;
  targetType: string;
  targetKey: string;
  target: string;
  effectKind: string;
  amount: number;
  buffPower: number;
  buffHealth: number;
  keyword: string;
}): { nodes: GraphNode[]; edges: [string, string][] } {
  return {
    nodes: [
      { id: "trigger", kind: "trigger", label: "TRIGGER", data: { event: r.event } },
      { id: "condition", kind: "condition", label: "CONDITION", data: { sourceType: r.sourceType, sourceKey: r.sourceKey } },
      { id: "target", kind: "target", label: "TARGET", data: { targetType: r.targetType, targetKey: r.targetKey, target: r.target } },
      { id: "effect", kind: "effect", label: "EFFECT", data: { effectKind: r.effectKind, amount: r.amount, buffPower: r.buffPower, buffHealth: r.buffHealth, keyword: r.keyword } },
    ],
    edges: [["trigger", "condition"], ["condition", "target"], ["target", "effect"]],
  };
}

export function StatePanel({ title, tone, value }: { title: string; tone: "slate" | "emerald"; value: any }) {
  return <div className="p-4"><div className={`text-[9px] font-black tracking-[.2em] ${tone === "emerald" ? "text-emerald-300" : "text-slate-500"}`}>{title}</div><pre className="mt-3 max-h-72 overflow-auto rounded-2xl border border-white/10 bg-black/25 p-3 text-[10px] leading-5 text-slate-400">{JSON.stringify(value, null, 2)}</pre></div>;
}

export function EventTimeline({ events }: { events: any[] }) {
  return (
    <div className="border-y border-white/10 bg-black/10 p-4 lg:border-x lg:border-y-0">
      <div className="text-[9px] font-black tracking-[.2em] text-amber-300">EVENT STREAM</div>
      <div className="mt-3 max-h-72 space-y-2 overflow-auto pr-1">
        {events.map((e: any, i) => <div key={i} className="relative pl-6"><span className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-amber-300 shadow-[0_0_10px_rgba(251,191,36,.55)]" /><div className="absolute left-1 top-4 h-full w-px bg-white/10 last:hidden" /><div className="rounded-xl border border-white/10 bg-white/[.03] p-2.5"><div className="text-[10px] font-black text-slate-200">{e.type}</div><div className="mt-1 text-[9px] text-slate-500">{e.unitId ? `unit ${e.unitId} · ` : ""}{e.amount !== undefined ? `amount ${e.amount}` : "state transition"}</div></div></div>)}
        {!events.length && <div className="rounded-xl border border-dashed border-white/10 p-4 text-center text-[10px] text-slate-500">No observable events.</div>}
      </div>
    </div>
  );
}
