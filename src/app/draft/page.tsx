import { PRODUCT_BRAND } from "@/lib/product-brand";
import DraftClient from "./DraftClient";

export const metadata = {
  title: `Arena Draft — ${PRODUCT_BRAND.fullName}`,
  description: "Construa um deck em formato limitado com escolhas autoritativas, regras imutáveis por sessão e até três regiões.",
};

export default function DraftPage() {
  return <DraftClient />;
}
