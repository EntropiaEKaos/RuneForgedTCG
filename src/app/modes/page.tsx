import ModesClient from "./ModesClient";
import { getRuntimeModes } from "@/lib/control-plane";
export const metadata = { title: "Modos — Runeforge" };
export const dynamic = "force-dynamic";
export default async function ModesPage() {
  const modes = await getRuntimeModes();
  return <ModesClient {...modes} />;
}
