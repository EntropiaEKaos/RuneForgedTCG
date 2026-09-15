import { PRODUCT_BRAND } from "@/lib/product-brand";
import SecurityClient from "./SecurityClient";

export const metadata = {
  title: `Acesso & Segurança — ${PRODUCT_BRAND.fullName}`,
  description: "Vincule Google, Discord e e-mail ao mesmo forjador sem mover coleção, decks ou progressão.",
};

export default function ProfileSecurityPage() {
  return <SecurityClient />;
}
