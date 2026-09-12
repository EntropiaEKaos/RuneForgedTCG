import MarketClient from "./MarketClient";

export const metadata = {
  title: "Mercado — RuneForge",
  description: "Compre, venda e troque cartas com outros Forjadores usando a economia interna do RuneForge.",
};

export default function MarketPage() {
  return <MarketClient />;
}
