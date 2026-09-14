import { PRODUCT_BRAND } from "@/lib/product-brand";
import FriendsClient from "./FriendsClient";

export const metadata = { title: `Amigos — ${PRODUCT_BRAND.fullName}` };

export default function FriendsPage() {
  return <FriendsClient />;
}
