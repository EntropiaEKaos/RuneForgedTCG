"use client";

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
  const visible = entries.slice(0, 8);
  const targeting = Boolean(targetKind && isGraveyardTargetKind(targetKind));

  return (
    <div
      data-graveyard-tray={owner}
      data-graveyard-count={entries.length}
      className="mx-3 my-1 rounded-xl border border-violet-300/10 bg-violet-950/15 px-3 py-2"
    >
      <div className="mb-1 flex items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-[.18em] text-violet-200/70">
        <span>☠ Cemitério {owner === "player" ? "aliado" : "rival"}</span>
        <span>{entries.length}</span>
      </div>
      {visible.length === 0 ? (
        <div className="text-[11px] text-slate-500">Nenhuma carta no cemitério.</div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {visible.map((entry) => {
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
          {entries.length > visible.length && (
            <span className="self-center text-[10px] text-slate-500">+{entries.length - visible.length}</span>
          )}
        </div>
      )}
    </div>
  );
}
