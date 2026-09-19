import CommanderClient from "./CommanderClient";
import { PRODUCT_BRAND } from "@/lib/product-brand";

export const metadata = {
  title: `Commander Alpha — ${PRODUCT_BRAND.fullName}`,
  description: "Modo experimental separado para quatro jogadores humanos, decks de 60 cartas e um General.",
};
export const dynamic = "force-dynamic";
export default function CommanderPage(){ return <CommanderClient/>; }
