"use client";
import CollectionSymbolMark from "@/components/CollectionSymbolMark";
import { Check, F, Panel } from "./CardAuthoringFields";

import type { CardAuthoringModel } from "./CardAuthoringModel";

export default function CardReleaseTab({ model }: { model: CardAuthoringModel }) {
  const { card, cm, setCm, cols, collectionIdentity, status, tests } = model;
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Panel title="Release Identity" eyebrow="COLLECTION & LIVE STATE">
        <F l="Collection">
          <select
            className="input"
            value={cm.collectionId}
            onChange={(e) => setCm({ ...cm, collectionId: e.target.value })}
          >
            <option value="">Unassigned</option>
            {cols.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.code} · {c.status}
              </option>
            ))}
          </select>
        </F>
        {collectionIdentity && <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/[.06] p-4"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl border border-cyan-300/20 bg-black/20 text-xl"><CollectionSymbolMark symbol={collectionIdentity.symbol} name={collectionIdentity.name} className="h-9 w-9 rounded-full object-cover" /></span><div><small className="text-[8px] font-black tracking-[.16em] text-cyan-300">COLEÇÃO DE LANÇAMENTO</small><b className="block text-sm text-white">{collectionIdentity.name}</b><span className="font-mono text-[10px] text-slate-400">{collectionIdentity.code}</span></div></div></div>}
        <F l="Release state" x="mt-4">
          <div className="input flex items-center justify-between"><span className="font-mono text-xs uppercase">{status}</span><span className="text-[9px] text-slate-500">Use Validate → QA → Publish; estado não é editável diretamente.</span></div>
        </F>
        <F l="Tags" x="mt-4">
          <input
            className="input"
            value={(cm.tags || []).join(", ")}
            onChange={(e) =>
              setCm({
                ...cm,
                tags: e.target.value
                  .split(",")
                  .map((x: string) => x.trim())
                  .filter(Boolean),
              })
            }
          />
        </F>
        <F l="Notes" x="mt-4">
          <textarea
            className="input min-h-24"
            value={cm.notes || ""}
            onChange={(e) => setCm({ ...cm, notes: e.target.value })}
          />
        </F>
      </Panel>
      <Panel title="Release Checklist" eyebrow="PRODUCTION GATE">
        <Check ok={!!(card.name && card.defId)} t="Stable identity" />
        <Check ok={!!(card.type && card.region && card.rarity)} t="Ruleset classification" />
        <Check ok={!!cm.collectionId} t="Collection assigned" />
        <Check ok={!!card.description} t="Player-facing description" />
        <Check ok={!!tests.length} t="Automated regression coverage" />
        {card.type === "Sentinela" && (
          <Check ok={!!(card.sentinela?.abilities?.length)} t="Sentinela loyalty & abilities defined" />
        )}
      </Panel>
    </div>
  );
}
