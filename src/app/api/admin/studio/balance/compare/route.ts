import { NextRequest } from "next/server";
import { db } from "@/db";
import { adminSimulationRuns, adminContentVersions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAdminSessionContext, isAdminAuthorized, unauthorized, adminRoleAllowed } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthorized(req))) return unauthorized();
  const actor = await getAdminSessionContext(req);
  if (!actor) return unauthorized();
  if (!adminRoleAllowed(actor.role, "qa")) return Response.json({ ok: false, error: `Role ${actor.role} cannot access balance analysis` }, { status: 403 });
  const a = Number(req.nextUrl.searchParams.get("a")), b = Number(req.nextUrl.searchParams.get("b"));
  if (!Number.isInteger(a) || !Number.isInteger(b)) return Response.json({ok:false,error:"Run ids a and b are required."},{status:400});
  const [ra] = await db.select().from(adminSimulationRuns).where(eq(adminSimulationRuns.id,a)).limit(1);
  const [rb] = await db.select().from(adminSimulationRuns).where(eq(adminSimulationRuns.id,b)).limit(1);
  if(!ra||!rb)return Response.json({ok:false,error:"One or both simulation runs were not found."},{status:404});
  if (ra.deckA !== rb.deckA || ra.deckB !== rb.deckB) return Response.json({ok:false,error:"Runs must use the same deck matchup and orientation."},{status:409});
  if (ra.completedGames !== rb.completedGames) return Response.json({ok:false,error:"Runs must contain the same number of completed games."},{status:409});
  const delta=(x:number,y:number)=>Math.round((x-y)*10)/10;
  const rate = (value:number,total:number) => total ? Math.round(value / total * 1000) / 10 : 0;
  return Response.json({ok:true,comparison:{baseline:{id:ra.id,deckA:ra.deckA,deckB:ra.deckB,games:ra.completedGames,winRateA:rate(ra.winsA,ra.completedGames),winRateB:rate(ra.winsB,ra.completedGames),drawRate:rate(ra.draws,ra.completedGames),avgRounds:ra.avgRounds,engineVersion:ra.engineVersion,rulesetVersion:ra.rulesetVersion},candidate:{id:rb.id,deckA:rb.deckA,deckB:rb.deckB,games:rb.completedGames,winRateA:rate(rb.winsA,rb.completedGames),winRateB:rate(rb.winsB,rb.completedGames),drawRate:rate(rb.draws,rb.completedGames),avgRounds:rb.avgRounds,engineVersion:rb.engineVersion,rulesetVersion:rb.rulesetVersion},delta:{winRateA:delta(rate(rb.winsA,rb.completedGames),rate(ra.winsA,ra.completedGames)),winRateB:delta(rate(rb.winsB,rb.completedGames),rate(ra.winsB,ra.completedGames)),drawRate:delta(rate(rb.draws,rb.completedGames),rate(ra.draws,ra.completedGames)),avgRounds:delta(rb.avgRounds,ra.avgRounds),engineChanged:ra.engineVersion!==rb.engineVersion,rulesetChanged:ra.rulesetVersion!==rb.rulesetVersion}}});
}
