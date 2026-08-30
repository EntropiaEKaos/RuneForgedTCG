import { redirect } from "next/navigation";
import { canAccessStudioAuthoring, studioLandingForRole } from "@/lib/admin-studio-access";
import { getStudioPageSession } from "@/lib/admin-studio-page-access";
import SuperAdminStudio from "./SuperAdminStudio";

export const metadata = { title: "Runeforge Super Admin" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const actor = await getStudioPageSession("/admin/studio");
  if (actor && !canAccessStudioAuthoring(actor.role)) redirect(studioLandingForRole(actor.role));
  return <SuperAdminStudio initialUser={actor ? { username: actor.username, role: actor.role } : null} />;
}
