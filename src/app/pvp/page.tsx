import { PRODUCT_BRAND } from "@/lib/product-brand";
import PvpClient from "./PvpClient";

export const metadata = {
  title: `PvP Casual — ${PRODUCT_BRAND.fullName}`,
  description: "Lobby PvP casual com salas autoritativas, sessão estável e reconexão automática.",
};

export default function PvpPage() {
  return <PvpClient />;
}
