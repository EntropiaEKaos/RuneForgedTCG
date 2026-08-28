import { NextRequest } from "next/server";
import { db } from "@/db";
import { players, matches, customCards, adminEvents, adminPromotions, adminCollections, adminCardTestRuns, playerCards, adminSimulationRuns } from "@/db/schema";
import { count, eq, desc, sql } from "drizzle-orm";
import { getAdminSessionContext, isAdminAuthorized, unauthorized, adminRoleAllowed } from "@/lib/admin-auth";
export const dynamic="force-dynamic";
export async function GET(req:NextRequest){
  if(!(await isAdminAuthorized(req)))return unauthorized();const actor=await getAdminSessionContext(req);if(!actor)return unauthorized();if(!adminRoleAllowed(actor.role,"qa"))return Response.json({ok:false,error:`Role ${actor.role} cannot access this resource`},{status:403});
  const [p,m,c,e,promo,col,tests,wins,topCards,runs,recentMatches]=await Promise.all([
    db.select({value:count()}).from(players),db.select({value:count()}).from(matches),db.select({value:count()}).from(customCards),
    db.select({value:count()}).from(adminEvents).where(eq(adminEvents.status,"published")),db.select({value:count()}).from(adminPromotions).where(eq(adminPromotions.status,"published")),
    db.select({value:count()}).from(adminCollections),db.select({value:count()}).from(adminCardTestRuns),db.select({value:count()}).from(matches).where(eq(matches.won,true)),
    db.select({defId:playerCards.defId,copies:sql<number>`sum(${playerCards.count})`}).from(playerCards).groupBy(playerCards.defId).orderBy(desc(sql`sum(${playerCards.count})`)).limit(10),
    db.select().from(adminSimulationRuns).orderBy(desc(adminSimulationRuns.id)).limit(8),
    db.select({won:matches.won,rounds:matches.rounds,createdAt:matches.createdAt}).from(matches).orderBy(desc(matches.id)).limit(20),
  ]);
  const total=Number(m[0]?.value||0),won=Number(wins[0]?.value||0);
  return Response.json({ok:true,metrics:{players:p[0]?.value||0,matches:total,cards:c[0]?.value||0,activeEvents:e[0]?.value||0,activePromotions:promo[0]?.value||0,collections:col[0]?.value||0,testRuns:tests[0]?.value||0,wins:won,losses:Math.max(total-won,0),winRate:total?Math.round(won/total*1000)/10:0,topCards,recentSimulations:runs,recentMatches}});
}
