import { getStudioPageSession } from "@/lib/admin-studio-page-access";
import SiteContentStudio from "./SiteContentStudio";

export const metadata = { title: "Portal CMS — Runeforge" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const actor = await getStudioPageSession("/admin/studio/site");
  return (
    <SiteContentStudio
      initialUser={actor ? { username: actor.username, role: actor.role } : null}
    />
  );
}
