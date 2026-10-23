"use client";

import { useState } from "react";

import { getCard } from "@/game/cards";
import { graveyardEntries, type GraveyardEntry } from "@/game/graveyard";
import { isGraveyardTargetKind, isValidGraveyardTarget } from "@/game/graveyard-effects";
import type { GameState, PlayerId, TargetKind } from "@/game/types";

const reasonLabel: Record<GraveyardEntry["reason"], string> = {
  discard: "descarte",
  mill: "moinho",
  death: "morte",
  destroy: "destruído",
  spell: "resolvido",
  counter: "anulado",
  sacrifice: "sacrifício",
  overflow: "excesso",
};

export function GraveyardTray({
  state,
  owner,
  targetKind,
  onEntryClick,
}: {
  state: GameState;
  owner: PlayerId;
  targetKind?: TargetKind | null;
  onEntryClick?: (entry: GraveyardEntry) => void;
}) {
  const entries = [...graveyardEntries(state, owner)].reverse();
  const targeting = Boolean(targetKind && isGraveyardTargetKind(targetKind));
  const [expanded, setExpanded] = useState(false);
  const showEntries = targeting || expanded;

  return (
    <div
      data-graveyard-tray={owner}
      data-graveyard-count={entries.length}
      className="rounded-xl border border-violet-300/20 bg-slate-950/90 p-1.5 text-violet-100 shadow-lg shadow-black/30 backdrop-blur-md"
    >
      <button type="button" aria-expanded={showEntries} aria-label={`Abrir cemitério ${owner === "player" ? "aliado" : "rival"} com ${entries.length} cartas`} onClick={() => setExpanded((current) => !current)} className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-violet-100 transition hover:bg-violet-400/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300">
        <span>☠ {owner === "player" ? "Meu cemitério" : "Cemitério rival"}</span>
        <span className="rounded-md border border-violet-300/20 bg-violet-300/10 px-1.5 py-0.5 tabular-nums">{entries.length}</span>
        <span aria-hidden="true">{showEntries ? "▴" : "▾"}</span>
      </button>
      {showEntries && (entries.length === 0 ? (
        <div className="text-[11px] text-slate-500">Nenhuma carta no cemitério.</div>
      ) : (
        <div className="flex max-h-[min(42vh,280px)] flex-wrap content-start gap-1.5 overflow-y-auto overscroll-contain p-1">
          {entries.map((entry) => {
            const def = getCard(entry.defId);
            const targetable = Boolean(
              targeting &&
              targetKind &&
              isValidGraveyardTarget(state, "player", targetKind, entry),
            );
            return (
              <button
                type="button"
                key={entry.instanceId}
                data-graveyard-entry={entry.instanceId}
                data-graveyard-targetable={targetable ? "true" : "false"}
                disabled={!targetable}
                onClick={targetable && onEntryClick ? () => onEntryClick(entry) : undefined}
                className={[
                  "rounded-lg border px-2 py-1 text-left text-[10px] transition",
                  targetable
                    ? "cursor-pointer border-amber-300/60 bg-amber-300/10 text-amber-100 ring-1 ring-amber-300/30 hover:bg-amber-300/20"
                    : "cursor-default border-white/10 bg-black/20 text-slate-400",
                ].join(" ")}
                title={`${def.name} · ${reasonLabel[entry.reason]} · rodada ${entry.roundEntered}`}
              >
                <span className="font-semibold">{def.emoji} {def.name}</span>
                <span className="ml-1 opacity-60">R{entry.roundEntered}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
