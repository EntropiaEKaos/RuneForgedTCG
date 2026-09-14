import { PRODUCT_BRAND } from "@/lib/product-brand";
import CollectionClient from "./CollectionClient";

export const metadata = {
  title: `Coleção — ${PRODUCT_BRAND.fullName}`,
  description: `Gerencie seu acervo ${PRODUCT_BRAND.displayName}, acompanhe o progresso e faça craft ou desencanto com operações de economia protegidas.`,
};

export default function CollectionPage() {
  return <CollectionClient />;
}
