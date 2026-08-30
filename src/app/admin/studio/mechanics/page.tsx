import { redirect } from "next/navigation";
import { canAccessStudioAuthoring, studioLandingForRole } from "@/lib/admin-studio-access";
import { getStudioPageSession } from "@/lib/admin-studio-page-access";
import MechanicsStudio from "./MechanicsStudio";

export const dynamic = "force-dynamic";

export default async function Page() {
  const actor = await getStudioPageSession("/admin/studio/mechanics");
  if (!actor) redirect("/admin/studio");
  if (!canAccessStudioAuthoring(actor.role)) redirect(studioLandingForRole(actor.role));
  return <MechanicsStudio role={actor.role} />;
}
