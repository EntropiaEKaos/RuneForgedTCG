import { PRODUCT_BRAND } from "@/lib/product-brand";
import CollectionsCalendarClient from "./CollectionsCalendarClient";

export const metadata = {
  title: `Calendário de Coleções — ${PRODUCT_BRAND.fullName}`,
  description: `Acompanhe lançamentos, rotações e o lifecycle Standard/Eternal das coleções publicadas em ${PRODUCT_BRAND.displayName}.`,
};

export default function CollectionsPage() {
  return <CollectionsCalendarClient />;
}
