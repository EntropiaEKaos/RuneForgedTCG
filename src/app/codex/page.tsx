import Link from "next/link";
import Image from "next/image";
import CardTip from "@/components/CardTip";
import SiteNav from "@/components/SiteNav";
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
    <main className="rf-app-page codex-page">
      <SiteNav />
      <div className="rf-app-shell">
        <header className="rf-app-heading">
          <div><p className="rf-eyebrow"><span /> ARQUIVO DE CARTAS</p><h1>Codex do Nexus</h1><p>Unidades, feitiços, campeões, Sentinelas e formas evoluídas da coleção Vanilla.</p></div>
          <Link href="/forge" className="rf-button rf-button-secondary">◆ ABRIR A FORJA</Link>
        </header>

        {REGION_ORDER.map((region) => {
          const style = REGION_STYLE[region];
          const list = cards.filter((c) => c.region === region);
          return (
            <section key={region} className="codex-region">
              <header className="codex-region-title"><Image src={style.art} alt="" width={40} height={40} /><div><span>{list.length} DEFINIÇÕES</span><h2>{region}</h2></div></header>
              <div className="codex-card-grid">
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
