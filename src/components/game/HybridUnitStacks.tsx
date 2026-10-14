"use client";

import { useMemo, useState, type ReactNode } from "react";
import { groupVisualUnits, type StackableUnit } from "@/lib/visual-unit-stacks";

type Props<T extends StackableUnit> = {
  units: readonly T[];
  renderUnit: (unit: T) => ReactNode;
  label?: string;
  forceExpanded?: boolean;
};

/** Presentation-only wrapper: every expanded card still uses its original instance and handler. */
export function HybridUnitStacks<T extends StackableUnit>({ units, renderUnit, label = "Criaturas", forceExpanded = false }: Props<T>) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const [separated, setSeparated] = useState<ReadonlySet<string>>(() => new Set());
  const groups = useMemo(() => groupVisualUnits(units, {
    expandedIds: expanded,
    separatedIds: separated,
  }), [units, expanded, separated]);
  const toggle = (id: string) => setExpanded(previous => {
    const next = new Set(previous);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  return <div data-hybrid-stacks={label} className="flex w-full flex-wrap items-end justify-center gap-x-3 gap-y-4 px-2 py-3 sm:gap-x-4">
    {groups.map(group => {
      const compact = group.members.length > 1 && !group.expanded && !forceExpanded;
      return <div key={group.id} data-stack-id={group.id} data-stack-count={group.members.length} data-stack-kind={label.includes("permanent") ? "permanent" : "unit"} className="relative flex flex-wrap items-end justify-center gap-2">
        {compact ? <div className="relative">
          {renderUnit(group.members[0])}
          <button type="button" aria-label={`Expandir pilha ${group.defId} com ${group.members.length} cartas`}
            aria-expanded={false} onClick={() => toggle(group.id)}
            className="absolute -right-2 -top-3 z-30 min-h-8 rounded-full border-2 border-amber-300 bg-slate-950 px-2.5 py-1 text-xs font-black text-amber-50 shadow-lg shadow-black/70 transition-colors hover:bg-amber-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200">
            ×{group.members.length} ▾
          </button>
        </div> : <>
          {group.members.map(unit => <div key={unit.instanceId} className="relative">
            {renderUnit(unit)}
            {group.members.length > 1 && <button type="button" aria-label={`Separar carta ${unit.instanceId}`}
              title="Separar da pilha" onClick={() => setSeparated(previous => new Set(previous).add(unit.instanceId))}
              className="absolute -right-1 -top-2 z-30 min-h-7 min-w-7 rounded-full border border-cyan-300 bg-slate-950 px-1.5 text-xs font-bold text-cyan-100 shadow-md shadow-black/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200">↗</button>}
            {separated.has(unit.instanceId) && <button type="button" aria-label={`Reagrupar carta ${unit.instanceId}`}
              onClick={() => setSeparated(previous => { const next = new Set(previous); next.delete(unit.instanceId); return next; })}
              className="absolute -right-1 -bottom-2 z-30 min-h-7 min-w-7 rounded border border-cyan-300 bg-slate-950 px-1.5 text-xs font-bold text-cyan-100 shadow-md shadow-black/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200">↩</button>}
          </div>)}
          {group.members.length > 1 && <button type="button" onClick={() => toggle(group.id)}
            aria-label={`Recolher pilha ${group.defId}`} className="min-h-8 rounded-md border border-amber-400 bg-slate-950 px-3 py-1 text-xs font-bold text-amber-50 shadow-md shadow-black/60 hover:bg-amber-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200">Recolher ×{group.members.length}</button>}
        </>}
      </div>;
    })}
  </div>;
}
