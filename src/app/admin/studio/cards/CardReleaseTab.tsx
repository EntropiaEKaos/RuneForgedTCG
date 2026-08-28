"use client";
import CollectionSymbolMark from "@/components/CollectionSymbolMark";
import { Check, F, Panel } from "./CardAuthoringFields";

import type { CardAuthoringModel } from "./CardAuthoringModel";

export default function CardReleaseTab({ model }: { model: CardAuthoringModel }) {
  const { card, cm, setCm, cols, collectionIdentity, status, tests, val } = model;
  const enabledTests = tests.filter((test: any) => test.enabled);
  const identityReady = Boolean(card.name && card.defId);
  const classificationReady = Boolean(card.type && card.region && card.rarity);
  const collectionReady = Boolean(cm.collectionId);
  const descriptionReady = Boolean(card.description);
  const regressionReady = enabledTests.length > 0;
  const validationReady = val?.ok === true;
  const sentinelaReady = card.type !== "Sentinela" || Boolean(card.sentinela?.abilities?.length);
  const localReady = identityReady && classificationReady && collectionReady && descriptionReady && regressionReady && validationReady && sentinelaReady;

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
        {collectionIdentity && (
          <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/[.06] p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl border border-cyan-300/20 bg-black/20 text-xl">
                <CollectionSymbolMark symbol={collectionIdentity.symbol} name={collectionIdentity.name} className="h-9 w-9 rounded-full object-cover" />
              </span>
              <div>
                <small className="text-[8px] font-black tracking-[.16em] text-cyan-300">COLEÇÃO DE LANÇAMENTO</small>
                <b className="block text-sm text-white">{collectionIdentity.name}</b>
                <span className="font-mono text-[10px] text-slate-400">{collectionIdentity.code}</span>
              </div>
            </div>
          </div>
        )}
        <F l="Release state" x="mt-4">
          <div className="input flex items-center justify-between gap-4">
            <span className="font-mono text-xs uppercase">{status}</span>
            <span className="text-right text-[9px] text-slate-500">Use Validate → QA → Publish; estado não é editável diretamente.</span>
          </div>
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
        <div className={`mb-4 rounded-2xl border p-4 ${localReady ? "border-emerald-400/20 bg-emerald-400/[.06]" : "border-amber-400/20 bg-amber-400/[.055]"}`}>
          <div className={`text-xs font-black uppercase tracking-[.14em] ${localReady ? "text-emerald-300" : "text-amber-300"}`}>
            {localReady ? "✓ Pré-check local completo" : "Pré-check local incompleto"}
          </div>
          <p className="mt-2 text-[11px] leading-5 text-slate-400">
            Este painel antecipa requisitos visíveis. QA/Publish continuam reexecutando validação, testes habilitados, grafo de dependências, Balance Lab e aprovações no servidor.
          </p>
        </div>

        <Check ok={identityReady} t="Stable identity" />
        <Check ok={classificationReady} t="Ruleset classification" />
        <Check ok={collectionReady} t="Collection assigned" />
        <Check ok={descriptionReady} t="Player-facing description" />
        <Check ok={regressionReady} t={`Enabled regression coverage (${enabledTests.length})`} />
        <Check ok={validationReady} t="Latest explicit validation passed" />
        {card.type === "Sentinela" && (
          <Check ok={sentinelaReady} t="Sentinela loyalty & abilities defined" />
        )}

        <div className="mt-4 rounded-xl border border-white/8 bg-black/20 px-3 py-3 text-[10px] leading-5 text-slate-500">
          O checklist não substitui a autoridade do pipeline. Uma mudança, aprovação ausente, teste falhando, ciclo de dependência ou resultado crítico de balanceamento ainda pode bloquear a operação no servidor.
        </div>
      </Panel>
    </div>
  );
}
