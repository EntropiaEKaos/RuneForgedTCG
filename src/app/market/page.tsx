import { PRODUCT_BRAND } from "@/lib/product-brand";
import MarketClient from "./MarketClient";

export const metadata = {
  title: `Mercado — ${PRODUCT_BRAND.fullName}`,
  description: `Compre, venda e troque cartas com outros Forjadores usando a economia interna de ${PRODUCT_BRAND.displayName}.`,
};

export default function MarketPage() {
  return <MarketClient />;
}
