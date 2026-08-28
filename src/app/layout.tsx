import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Cinzel, Manrope } from "next/font/google";
import CatalogBootstrap from "@/components/CatalogBootstrap";
import "./globals.css";
import "./styles/tcg-visual.css";
import "./styles/site-polish.css";
import "./styles/studio.css";
import "./styles/arena-regions.css";
import "./styles/gameplay-extensions.css";

// A strict nonce-based CSP requires request-time rendering so Next.js can
// attach the request nonce to framework and page scripts.
export const dynamic = "force-dynamic";

// Fonte de destaque (nomes de carta, números, títulos) — o resto da UI já
// tinha bastante capricho visual (gemas 3D, glow, sheen), mas o texto todo
// caía na fonte padrão do sistema, o que destoava do acabamento "premium"
// do resto do card-shell. Cinzel é a mesma família de fonte serifada que
// jogos do gênero (Hearthstone, LoR, MTG Arena) usam para nome/números.
const displayFont = Cinzel({
  subsets: ["latin"],
  weight: ["500", "700", "900"],
  variable: "--font-display",
  display: "swap",
});
// Fonte de corpo (texto de carta, UI geral) — mais legível em tamanhos
// pequenos (6-7px no card-shell) do que a serifada de destaque.
const bodyFont = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Runeforge: Legends of the Nexus",
  description:
    "A tactical collectible card battler. Ramp mana, seize the Attack Token, and shatter the enemy Nexus.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body className="bg-slate-950 text-slate-100 antialiased">
        <CatalogBootstrap>{children}</CatalogBootstrap>
      </body>
    </html>
  );
}
