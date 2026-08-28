import { NextRequest } from "next/server";
import { db } from "@/db";
import { adminBalanceExperiments, adminBalanceMatchups } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { getAdminSessionContext, isAdminAuthorized, unauthorized, adminRoleAllowed } from "@/lib/admin-auth";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  if (!(await isAdminAuthorized(req))) return unauthorized();
  const actor = await getAdminSessionContext(req);
  if (!actor) return unauthorized();
  if (!adminRoleAllowed(actor.role, "qa"))
    return Response.json({ ok: false, error: `Role ${actor.role} cannot access this resource` }, { status: 403 });
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (Number.isInteger(id)) {
    const [experiment] = await db
      .select()
      .from(adminBalanceExperiments)
      .where(eq(adminBalanceExperiments.id, id))
      .limit(1);
    if (!experiment) return Response.json({ ok: false, error: "Experiment not found" }, { status: 404 });
    const rows = await db.select().from(adminBalanceMatchups).where(eq(adminBalanceMatchups.experimentId, id));
    return Response.json({ ok: true, experiment, rows });
  }
  const rows = await db.select().from(adminBalanceExperiments).orderBy(desc(adminBalanceExperiments.id)).limit(50);
  return Response.json({ ok: true, rows });
}
