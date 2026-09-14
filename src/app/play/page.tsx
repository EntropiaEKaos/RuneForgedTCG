import PlayEntryClient from "./PlayEntryClient";
import { PRODUCT_BRAND } from "@/lib/product-brand";

export const metadata = {
  title: `Jogar — ${PRODUCT_BRAND.fullName}`,
  description: `Prepare sua identidade, escolha um deck e entre em partidas autoritativas de ${PRODUCT_BRAND.fullName}.`,
};

export default function PlayPage() {
  return <PlayEntryClient />;
}
