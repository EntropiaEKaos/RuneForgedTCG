import { redirect } from "next/navigation";
import { getStudioPageSession } from "@/lib/admin-studio-page-access";
import CommandCenterClient from "./CommandCenterClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Command Center · FORGED" };

export default async function CommandCenterPage() {
  const actor = await getStudioPageSession("/admin/studio/command-center");
  if (!actor) redirect("/admin");
  if (actor.role !== "admin") redirect("/admin/studio");
  return <CommandCenterClient username={actor.username} role={actor.role} />;
}
