import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import { allCards } from "@/game/cards";
import { getCardCollection } from "@/game/card-collections";
import { ensureCustomCardsLoaded } from "@/game/catalog";
import CodexExplorer, { type CodexEntry } from "./CodexExplorer";

export const metadata = {
  title: "Codex — Runeforge: Legends of the Nexus",
  description: "Explore o catálogo publicado de cartas, coleções, regiões, raridades e formas geradas de Runeforge.",
};

export default async function CodexPage() {
  await ensureCustomCardsLoaded();
  const entries: CodexEntry[] = allCards()
    .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name))
    .map((card) => ({ card, collection: getCardCollection(card.defId) }));

  return (
    <main className="rf-app-page codex-page">
      <SiteNav />
      <div className="rf-app-shell">
        <header className="rf-app-heading">
          <div>
            <p className="rf-eyebrow"><span /> ARQUIVO DE CARTAS</p>
            <h1>Codex do Nexus</h1>
            <p>Catálogo publicado com cartas Vanilla e coleções do Studio, incluindo identidades regionais duplas e triplas, tokens e formas evoluídas.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/album" className="rf-button rf-button-secondary">◇ VER ÁLBUM</Link>
            <Link href="/forge" className="rf-button rf-button-secondary">◆ ABRIR A FORJA</Link>
          </div>
        </header>

        <CodexExplorer entries={entries} />
      </div>
    </main>
  );
}
