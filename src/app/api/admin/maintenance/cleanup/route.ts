import { NextRequest } from "next/server";
import { adminRoleAllowed, getAdminSessionContext, isAdminAuthorized, unauthorized } from "@/lib/admin-auth";
import { cleanupExpiredRuntimeData } from "@/lib/session-cleanup";

export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthorized(req))) return unauthorized();
  const actor = await getAdminSessionContext(req);
  if (!actor || !adminRoleAllowed(actor.role, "liveops")) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
  const result = await cleanupExpiredRuntimeData();
  return Response.json({ ok: true, ...result });
}
