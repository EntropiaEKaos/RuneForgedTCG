import { NextRequest } from "next/server";
import { db } from "@/db";
import { adminSimulationRuns } from "@/db/schema";
import { getAdminSessionContext, isAdminAuthorized, unauthorized, adminRoleAllowed } from "@/lib/admin-auth";
import { runBalanceSimulation } from "@/lib/balance-simulator";
import { getRuntimeDecks, getRuntimeExperimentalDecks } from "@/lib/control-plane";
import { ensureConfigLoaded } from "@/game/settings";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  if (!(await isAdminAuthorized(req))) return unauthorized();
  const actor = await getAdminSessionContext(req);
  if (!actor) return unauthorized();
  if (!adminRoleAllowed(actor.role,"qa")) return Response.json({ ok:false, error:`Role ${actor.role} cannot run simulations` }, { status:403 });
  const decks = [...await getRuntimeDecks(), ...await getRuntimeExperimentalDecks()];
  return Response.json({ ok: true, decks: decks.map(d => ({ id: d.id, name: d.name })) });
}
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthorized(req))) return unauthorized();
  const actor = await getAdminSessionContext(req);
  if (!actor) return unauthorized();
  if (!adminRoleAllowed(actor.role,"qa")) return Response.json({ ok:false, error:`Role ${actor.role} cannot run simulations` }, { status:403 });
  try {
    await ensureConfigLoaded();
    const DECKS = [...await getRuntimeDecks(), ...await getRuntimeExperimentalDecks()];
    const overrides = Object.fromEntries(DECKS.map((deck) => [deck.id, { id: deck.id, name: deck.name, cards: deck.cards }]));
    const body = await req.json(); const deckA=String(body.deckA||""); const deckB=String(body.deckB||"");
    const games=Math.min(Math.max(Math.floor(Number(body.games)||100),1),1000); const seed=Math.max(1,Math.floor(Number(body.seed)||Date.now()%0x7fffffff));
    if(!DECKS.some(d=>d.id===deckA)||!DECKS.some(d=>d.id===deckB)) return Response.json({ok:false,error:"Unknown deck."},{status:400});
    if(deckA===deckB) return Response.json({ok:false,error:"Choose two different decks."},{status:400});
    const summary=runBalanceSimulation(deckA,deckB,games,seed,overrides);
    const [row]=await db.insert(adminSimulationRuns).values({mode:"ai-vs-ai",deckA,deckB,requestedGames:summary.requestedGames,completedGames:summary.completedGames,winsA:summary.winsA,winsB:summary.winsB,draws:summary.draws,avgRounds:summary.avgRounds,seed,engineVersion:summary.engineVersion,rulesetVersion:summary.rulesetVersion,details:summary as any}).returning();
    return Response.json({ok:true,summary,run:row});
  } catch (error) {
    console.error("[admin/studio/simulate] POST failed", error);
    return Response.json({ ok: false, error: "Simulation failed" }, { status: 500 });
  }
}
