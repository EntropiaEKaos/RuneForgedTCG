import ModesClient from "./ModesClient";
import { getRuntimeModes } from "@/lib/control-plane";

export const metadata = {
  title: "Modos de Jogo — RuneForge",
  description: "Explore Expedições, Puzzles, Boss Battles e Brawls preparados pelo fluxo autoritativo RuneForge.",
};

export const dynamic = "force-dynamic";

export default async function ModesPage() {
  const modes = await getRuntimeModes();
  return <ModesClient {...modes} />;
}
