import { PRODUCT_BRAND } from "@/lib/product-brand";
import CommunityClient from "./CommunityClient";

export const metadata = {
  title: `Comunidade — ${PRODUCT_BRAND.fullName}`,
  description: `Descubra, importe e acompanhe decks compartilhados pela comunidade ${PRODUCT_BRAND.displayName}.`,
};

export default function CommunityPage() {
  return <CommunityClient />;
}
