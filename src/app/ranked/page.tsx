import { PRODUCT_BRAND } from "@/lib/product-brand";
import RankedClient from "./RankedClient";

export const metadata = {
  title: `Ranked — ${PRODUCT_BRAND.fullName}`,
  description: `Acompanhe sua temporada, pool certificado, MMR, fila humana e classificação competitiva de ${PRODUCT_BRAND.displayName}.`,
};

export default function RankedPage() {
  return <RankedClient />;
}
