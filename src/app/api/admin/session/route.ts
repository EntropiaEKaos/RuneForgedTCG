import { NextRequest } from "next/server";
import { getAdminSessionContext, unauthorized } from "@/lib/admin-auth";
import { canAccessStudioAuthoring, studioLandingForRole } from "@/lib/admin-studio-access";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const actor = await getAdminSessionContext(req);
  if (!actor) return unauthorized();
  return Response.json({
    ok: true,
    user: {
      username: actor.username,
      role: actor.role,
      canAuthor: canAccessStudioAuthoring(actor.role),
      landing: studioLandingForRole(actor.role),
    },
  });
}
