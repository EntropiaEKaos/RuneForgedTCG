import { redirect } from "next/navigation";
import { getStudioPageSession } from "@/lib/admin-studio-page-access";
import LoreStudioClient from "./LoreStudioClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Lore Studio · FORGED" };

export default async function LoreStudioPage() {
  const actor = await getStudioPageSession("/admin/studio/lore");
  if (!actor) redirect("/admin");
  if (actor.role !== "admin") redirect("/admin/studio");
  return <LoreStudioClient username={actor.username} role={actor.role} />;
}
