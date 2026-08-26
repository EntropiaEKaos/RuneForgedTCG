import Link from "next/link";
import CardTip from "@/components/CardTip";
import { REGION_STYLE } from "@/components/CardView";
import { allCards } from "@/game/cards";
import { ensureCustomCardsLoaded } from "@/game/catalog";
import type { Region } from "@/game/types";
import { CARD_REGIONS } from "@/game/card-authoring";

export const metadata = {
  title: "Codex — Runeforge: Legends of the Nexus",
};

const REGION_ORDER: Region[] = [...CARD_REGIONS];

export default async function CodexPage() {
  await ensureCustomCardsLoaded();
  const cards = allCards().sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,#1e293b,#0f172a_55%,#020617)] px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" className="text-sm text-slate-400 hover:text-white">
            ← Home
          </Link>
          <div className="flex gap-4 text-sm text-slate-400">
            <Link href="/forge" className="hover:text-white">
              🔨 Forge
            </Link>
            <Link href="/play" className="hover:text-white">
              ⚔️ Play
            </Link>
          </div>
        </div>

        <h1 className="text-center text-4xl font-black text-amber-300 drop-shadow">📖 Codex</h1>
        <p className="mt-2 text-center text-sm text-slate-400">
          Every unit, spell, champion and leveled form in the Nexus.
        </p>

        {REGION_ORDER.map((region) => {
          const style = REGION_STYLE[region];
          const list = cards.filter((c) => c.region === region);
          return (
            <section key={region} className="mt-10">
              <h2 className={`mb-3 text-xl font-black ${style.text}`}>{region}</h2>
              <div className="flex flex-wrap gap-3">
                {list.map((c) => (
                  <div key={c.defId} className="flex flex-col items-center gap-1">
                    <CardTip defId={c.defId} size="lg" />
                    <span className="text-[10px] uppercase tracking-wider text-slate-500">
                      {c.isChampion ? (c.collectible === false ? "Leveled" : "Champion") : c.rarity}
                      {c.collectible === false && !c.isChampion ? " · Token" : ""}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
