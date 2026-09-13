"use client";

import { useMemo } from "react";
import { getCardCosmetic } from "@/game/card-cosmetics";
import { useCatalogRevision } from "@/components/CatalogContext";

export interface PackCosmeticPull {
  assetId: number;
  defId: string;
  variantId: string;
  frameId: string;
  finish: string;
  serialNumber?: number | null;
}

interface CardSummary {
  defId: string;
  name: string;
  emoji: string;
}

const KIND_LABEL: Record<string, string> = {
  premium_frame: "Frame Premium",
  full_art: "Full Art",
  foil: "Foil",
  animated: "Animada",
  serialized: "Serializada",
};

function safeBackground(url: string) {
  return `url(${JSON.stringify(url)})`;
}

export default function PackCosmeticHighlights({ pulls, cards }: { pulls: PackCosmeticPull[]; cards: CardSummary[] }) {
  useCatalogRevision();
  const specials = useMemo(() => pulls.filter((pull) => pull.variantId !== "standard"), [pulls]);
  if (!specials.length) return null;

  return (
    <section className="mt-5 rounded-2xl border border-amber-300/30 bg-[radial-gradient(circle_at_top,rgba(251,191,36,.12),rgba(8,12,20,.88)_55%)] p-4 sm:p-5" aria-labelledby="special-pulls-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-amber-300/70">ACHADO ESPECIAL</p>
          <h3 id="special-pulls-heading" className="mt-1 text-xl font-black text-amber-100">{specials.length === 1 ? "Uma variante rara foi forjada" : `${specials.length} variantes raras foram forjadas`}</h3>
        </div>
        <span className="rounded-full border border-amber-200/20 bg-amber-200/[0.07] px-3 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-amber-100">100% COSMÉTICO</span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {specials.map((pull) => {
          const cosmetic = getCardCosmetic(pull.defId, pull.variantId);
          const card = cards.find((entry) => entry.defId === pull.defId);
          const serial = pull.serialNumber ? `#${pull.serialNumber}${cosmetic?.serialLimit ? `/${cosmetic.serialLimit}` : ""}` : null;
          const media = cosmetic?.artUrl || null;
          return (
            <article key={pull.assetId} className="relative overflow-hidden rounded-xl border border-white/10 bg-black/35 p-3 shadow-[0_18px_50px_rgba(0,0,0,.28)]">
              <div className="flex gap-3">
                <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-lg border border-amber-200/25 bg-slate-950">
                  {cosmetic?.animationUrl ? (
                    <video className="absolute inset-0 h-full w-full object-cover" src={cosmetic.animationUrl} autoPlay loop muted playsInline aria-hidden="true" />
                  ) : media ? (
                    <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: safeBackground(media) }} aria-hidden="true" />
                  ) : (
                    <div className="grid h-full place-items-center text-3xl" aria-hidden="true">{card?.emoji || "◆"}</div>
                  )}
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_15%,rgba(255,255,255,.16)_42%,transparent_58%)] opacity-65" aria-hidden="true" />
                  {serial && <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1.5 py-0.5 text-[8px] font-black text-amber-100">{serial}</span>}
                </div>

                <div className="min-w-0 flex-1 py-1">
                  <p className="truncate text-sm font-black text-slate-100">{card?.name || pull.defId}</p>
                  <p className="mt-1 text-lg font-black text-amber-200">{cosmetic?.name || pull.variantId}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[9px] font-black uppercase tracking-[0.08em]">
                    <span className="rounded-full border border-amber-300/20 bg-amber-300/[0.07] px-2 py-1 text-amber-100">{KIND_LABEL[cosmetic?.kind || ""] || "Variante"}</span>
                    {cosmetic?.edition && <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-slate-300">{cosmetic.edition}</span>}
                    {pull.finish !== "normal" && <span className="rounded-full border border-cyan-300/15 bg-cyan-300/[0.05] px-2 py-1 text-cyan-200">{pull.finish}</span>}
                    {pull.frameId !== "default" && <span className="rounded-full border border-purple-300/15 bg-purple-300/[0.05] px-2 py-1 text-purple-200">{pull.frameId}</span>}
                  </div>
                  {serial && <p className="mt-2 text-xs font-bold text-amber-100">Edição numerada {serial}</p>}
                  <p className="mt-2 text-[10px] leading-4 text-slate-500">A carta mantém exatamente o mesmo gameplay da versão Standard.</p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
