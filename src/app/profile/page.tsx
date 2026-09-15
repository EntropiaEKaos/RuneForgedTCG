import { PRODUCT_BRAND } from "@/lib/product-brand";
import ProfileClient from "./ProfileClient";

export const metadata = {
  title: `Perfil — ${PRODUCT_BRAND.fullName}`,
  description: "Progressão, conquistas, missões, decks compartilhados e segurança da identidade do jogador.",
};

export default function ProfilePage() {
  return <ProfileClient />;
}
