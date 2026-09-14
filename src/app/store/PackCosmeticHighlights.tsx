"use client";

import { useMemo } from "react";
import {
  cosmeticDropChancePercent,
  getCardCosmetic,
  resolveCardCosmeticPrestige,
} from "@/game/card-cosmetics";
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

function chanceLabel(dropWeight: number, packEligible: boolean, acquisition: string) {
  if (acquisition !== "pack" || !packEligible || dropWeight <= 0) return "Distribuição exclusiva fora do pool normal de packs";
  const chance = cosmeticDropChancePercent(dropWeight);
  const digits = chance < 0.1 ? 3 : chance < 1 ? 2 : 1;
  return `${chance.toFixed(digits)}% nominal por cópia elegível`;
}

export default function PackCosmeticHighlights({ pulls, cards }: { pulls: PackCosmeticPull[]; cards: CardSummary[] }) {
  useCatalogRevision();
  const specials = useMemo(() => pulls.filter((pull) => pull.variantId !== "standard"), [pulls]);
  if (!specials.length) return null;

  return (
    <section className="pack-cosmetic-highlights mt-5 rounded-2xl border border-amber-300/30 bg-[radial-gradient(circle_at_top,rgba(251,191,36,.12),rgba(8,12,20,.88)_55%)] p-4 sm:p-5" aria-labelledby="special-pulls-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-amber-300/70">ACHADO ESPECIAL</p>
          <h3 id="special-pulls-heading" className="mt-1 text-xl font-black text-amber-100">{specials.length === 1 ? "Uma variante cosmética foi forjada" : `${specials.length} variantes cosméticas foram forjadas`}</h3>
        </div>
        <span className="rounded-full border border-amber-200/20 bg-amber-200/[0.07] px-3 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-amber-100">100% COSMÉTICO</span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {specials.map((pull) => {
          const cosmetic = getCardCosmetic(pull.defId, pull.variantId);
          const card = cards.find((entry) => entry.defId === pull.defId);
          const serial = pull.serialNumber ? `#${pull.serialNumber}${cosmetic?.serialLimit ? `/${cosmetic.serialLimit}` : ""}` : null;
          const media = cosmetic?.artUrl || null;
          const prestige = resolveCardCosmeticPrestige(cosmetic);
          return (
            <article key={pull.assetId} className="pack-cosmetic-card relative overflow-hidden rounded-xl border border-white/10 bg-black/35 p-3 shadow-[0_18px_50px_rgba(0,0,0,.28)]" data-cosmetic-prestige={prestige.id}>
              <div className="flex gap-3">
                <div className="pack-cosmetic-mini-card relative h-28 w-20 shrink-0 overflow-hidden rounded-lg border border-amber-200/25 bg-slate-950">
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
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-black text-slate-100">{card?.name || pull.defId}</p>
                    <span className="cosmetic-prestige-badge rounded-full px-2 py-1 text-[8px] font-black uppercase tracking-[.12em]">{prestige.shortLabel}</span>
                  </div>
                  <p className="mt-1 text-lg font-black text-amber-200">{cosmetic?.name || pull.variantId}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[9px] font-black uppercase tracking-[0.08em]">
                    <span className="rounded-full border border-amber-300/20 bg-amber-300/[0.07] px-2 py-1 text-amber-100">{KIND_LABEL[cosmetic?.kind || ""] || "Variante"}</span>
                    {cosmetic?.edition && <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-slate-300">{cosmetic.edition}</span>}
                    {pull.finish !== "normal" && <span className="rounded-full border border-cyan-300/15 bg-cyan-300/[0.05] px-2 py-1 text-cyan-200">{pull.finish}</span>}
                    {pull.frameId !== "default" && <span className="rounded-full border border-purple-300/15 bg-purple-300/[0.05] px-2 py-1 text-purple-200">{pull.frameId}</span>}
                  </div>
                  {serial && <p className="mt-2 text-xs font-bold text-amber-100">Edição numerada {serial}</p>}
                  {cosmetic && <p className="mt-2 text-[10px] font-bold uppercase tracking-[.08em] text-slate-400">{chanceLabel(cosmetic.dropWeight, cosmetic.packEligible, cosmetic.acquisition)}</p>}
                  <p className="mt-1 text-[10px] leading-4 text-slate-500">Prestígio cosmético não altera gameplay, raridade da carta ou legalidade competitiva.</p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
