"use client";

import { useMemo, useState, type ReactNode } from "react";
import { groupVisualUnits, type StackableUnit } from "@/lib/visual-unit-stacks";
import type { VisualStackStatus } from "@/lib/visual-stack-status";

type Props<T extends StackableUnit> = {
  units: readonly T[];
  renderUnit: (unit: T) => ReactNode;
  label?: string;
  summarizeStatus?: (units: readonly T[]) => VisualStackStatus;
  forceExpanded?: boolean;
};

/** Presentation-only wrapper: every expanded card still uses its original instance and handler. */
export function HybridUnitStacks<T extends StackableUnit>({ units, renderUnit, label = "Criaturas", summarizeStatus, forceExpanded = false }: Props<T>) {
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
  return <div data-hybrid-stacks={label} className="flex flex-wrap items-end justify-center gap-2">
    {groups.map(group => {
      const compact = group.members.length > 1 && !group.expanded && !forceExpanded;
      const status = summarizeStatus ? summarizeStatus(group.members) : null;
      const indicators = status ? ([
        ["⚔", status.attacking, "atacando"],
        ["◷", status.spentAttack, "já atacaram"],
        ["♥", status.damaged, "feridas"],
        ["✦", status.buffed, "fortalecidas"],
        ["↓", status.impaired, "afetadas"],
      ] as const).filter(([, count]) => count > 0) : [];
      return <div key={group.id} data-stack-id={group.id} data-stack-count={group.members.length} data-stack-kind={label.includes("permanent") ? "permanent" : "unit"} className="relative flex flex-wrap items-end justify-center gap-1">
        {compact ? <div className="relative flex flex-col items-center gap-1">
          {renderUnit(group.members[0])}
          <button type="button" aria-label={`Expandir pilha ${group.defId} com ${group.members.length} cartas`}
            aria-expanded={false} onClick={() => toggle(group.id)}
            className="absolute -right-2 -top-2 z-30 rounded-full border border-amber-300 bg-slate-950 px-2 py-1 text-xs font-black text-amber-100 shadow-lg">
            ×{group.members.length} ▾
          </button>
          {indicators.length > 0 && <div data-stack-status={group.id} aria-label={`Estados da pilha: ${indicators.map(([, count, name]) => `${count} ${name}`).join(", ")}`}
            className="relative z-20 flex w-max max-w-[min(180px,85vw)] flex-wrap justify-center gap-0.5 rounded-md border border-amber-400/40 bg-slate-950/95 px-1 py-0.5 text-[10px] text-amber-100 shadow-lg">
            {indicators.map(([symbol, count, name]) => <span key={name} title={`${count} ${name}`} className="whitespace-nowrap rounded bg-slate-800 px-1">{symbol}{count}</span>)}
          </div>}
        </div> : <>
          {group.members.map(unit => <div key={unit.instanceId} className="relative">
            {renderUnit(unit)}
            {group.members.length > 1 && <button type="button" aria-label={`Separar carta ${unit.instanceId}`}
              title="Separar da pilha" onClick={() => setSeparated(previous => new Set(previous).add(unit.instanceId))}
              className="absolute -right-1 -top-1 z-30 rounded-full bg-slate-950/95 px-1 text-[10px] text-cyan-200">↗</button>}
            {separated.has(unit.instanceId) && <button type="button" aria-label={`Reagrupar carta ${unit.instanceId}`}
              onClick={() => setSeparated(previous => { const next = new Set(previous); next.delete(unit.instanceId); return next; })}
              className="absolute -right-1 -bottom-1 z-30 rounded bg-slate-950/95 px-1 text-[10px] text-cyan-200">↩</button>}
          </div>)}
          {group.members.length > 1 && <button type="button" onClick={() => toggle(group.id)}
            aria-label={`Recolher pilha ${group.defId}`} className="rounded bg-slate-900 px-2 py-1 text-xs text-amber-100">Recolher ×{group.members.length}</button>}
        </>}
      </div>;
    })}
  </div>;
}
