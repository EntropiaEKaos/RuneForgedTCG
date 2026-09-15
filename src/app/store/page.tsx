import { PRODUCT_BRAND } from "@/lib/product-brand";
import StoreClient from "./StoreClient";

export const metadata = {
  title: `Loja — ${PRODUCT_BRAND.fullName}`,
  description: "Pacotes, recompensas diárias e conteúdo premium com economia e pagamentos autoritativos.",
};

export default function StorePage() {
  return <StoreClient />;
}
