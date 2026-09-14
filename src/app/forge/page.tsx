import { PRODUCT_BRAND } from "@/lib/product-brand";
import ForgeClient from "./ForgeClient";

export const metadata = {
  title: `Forja — ${PRODUCT_BRAND.fullName}`,
  description: `Construa, analise, valide e compartilhe decks ${PRODUCT_BRAND.displayName} dentro das regras runtime e formatos publicados.`,
};

export default function ForgePage() {
  return <ForgeClient />;
}
