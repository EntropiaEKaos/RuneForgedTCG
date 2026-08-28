import { NextRequest } from "next/server";
import { db } from "@/db";
import { adminBalanceExperiments, adminBalanceMatchups, adminSimulationRuns, cardCatalogMeta } from "@/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getCard } from "@/game/cards";
import type { DeckDef } from "@/game/decks";
import { getRuntimeDecks } from "@/lib/control-plane";
import { ENGINE_VERSION, RULESET_VERSION } from "@/game/version";
import { getAdminSessionContext, isAdminAuthorized, unauthorized, adminRoleAllowed } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

function profile(deck: DeckDef, meta: Map<string, any>) {
  const classes = new Map<string, number>(), races = new Map<string, number>(), collections = new Map<string, number>();
  for (const defId of deck.cards) {
    let card;
    try { card = getCard(defId); } catch { continue; }
    for (const key of card.classes ?? []) classes.set(key, (classes.get(key) ?? 0) + 1);
    for (const race of [card.race, ...(card.secondaryRaces ?? [])].filter(Boolean)) races.set(String(race), (races.get(String(race)) ?? 0) + 1);
    const collectionId = meta.get(defId)?.collectionId;
    if (collectionId != null) collections.set(String(collectionId), (collections.get(String(collectionId)) ?? 0) + 1);
  }
  const top = (m: Map<string, number>) => [...m.entries()].sort((a,b)=>b[1]-a[1]).slice(0,4).map(([key,count])=>({key,count}));
  return { classes: top(classes), races: top(races), collections: top(collections) };
}

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthorized(req))) return unauthorized();
  const actor = await getAdminSessionContext(req);
  if (!actor) return unauthorized();
  if (!adminRoleAllowed(actor.role, "qa")) return Response.json({ ok: false, error: `Role ${actor.role} cannot access balance analysis` }, { status: 403 });
  const decks = await getRuntimeDecks();
  const experiments = await db.select({ id: adminBalanceExperiments.id }).from(adminBalanceExperiments).where(and(eq(adminBalanceExperiments.status, "completed"), eq(adminBalanceExperiments.engineVersion, ENGINE_VERSION), eq(adminBalanceExperiments.rulesetVersion, RULESET_VERSION))).orderBy(desc(adminBalanceExperiments.id)).limit(50);
  const experimentIds = experiments.map((item) => item.id);
  const rows = experimentIds.length
    ? await db.select().from(adminBalanceMatchups).where(inArray(adminBalanceMatchups.experimentId, experimentIds)).orderBy(desc(adminBalanceMatchups.id)).limit(1000)
    : [];

  // Current balance metrics intentionally stay scoped to the active engine/ruleset
  // through `experiments` above. Comparison history is different: it must retain
  // older provenance or the Version Compare UI can never compare engine/ruleset
  // generations. Return a narrow projection so historical diagnostics do not
  // expose raw simulation details that the compare surface does not need.
  const runs = await db.select({
    id: adminSimulationRuns.id,
    mode: adminSimulationRuns.mode,
    deckA: adminSimulationRuns.deckA,
    deckB: adminSimulationRuns.deckB,
    requestedGames: adminSimulationRuns.requestedGames,
    completedGames: adminSimulationRuns.completedGames,
    winsA: adminSimulationRuns.winsA,
    winsB: adminSimulationRuns.winsB,
    draws: adminSimulationRuns.draws,
    avgRounds: adminSimulationRuns.avgRounds,
    seed: adminSimulationRuns.seed,
    engineVersion: adminSimulationRuns.engineVersion,
    rulesetVersion: adminSimulationRuns.rulesetVersion,
    createdAt: adminSimulationRuns.createdAt,
  }).from(adminSimulationRuns).orderBy(desc(adminSimulationRuns.id)).limit(250);

  const metaRows = await db.select({ defId: cardCatalogMeta.defId, collectionId: cardCatalogMeta.collectionId }).from(cardCatalogMeta);
  const meta = new Map(metaRows.map(r => [r.defId, r]));
  const matchup = new Map<string, {games:number; wins:number; losses:number; draws:number}>();
  for (const r of rows) {
    for (const [deck, wins, losses] of [[r.deckA,r.winsA,r.winsB],[r.deckB,r.winsB,r.winsA]] as [string,number,number][]) {
      const x=matchup.get(deck)||{games:0,wins:0,losses:0,draws:0}; x.games+=r.completedGames; x.wins+=wins; x.losses+=losses; x.draws+=r.draws; matchup.set(deck,x);
    }
  }
  const deckMetrics = decks.map(d=>{const x=matchup.get(d.id)||{games:0,wins:0,losses:0,draws:0}; const wr=x.games?Math.round(x.wins/x.games*1000)/10:0; return {id:d.id,name:d.name,games:x.games,wins:x.wins,losses:x.losses,draws:x.draws,winRate:wr,profile:profile(d,meta)};}).filter(x=>x.games>0).sort((a,b)=>b.winRate-a.winRate);
  const outliers = deckMetrics.filter(d => d.games >= 100 && (d.winRate >= 55 || d.winRate <= 45)).map(d=>({...d,severity:d.winRate>=60||d.winRate<=40?"critical":"warning",distance:Math.round(Math.abs(d.winRate-50)*10)/10}));
  const dimensionMetrics = (kind: "classes"|"races"|"collections") => {
    const map = new Map<string,{games:number;wins:number;decks:Set<string>}>();
    for (const d of deckMetrics) for (const item of d.profile[kind]) {
      const x=map.get(item.key)||{games:0,wins:0,decks:new Set<string>()}; x.games+=d.games; x.wins+=d.wins; x.decks.add(d.id); map.set(item.key,x);
    }
    return [...map.entries()].map(([key,x])=>({key,games:x.games,wins:x.wins,winRate:x.games?Math.round(x.wins/x.games*1000)/10:0,decks:x.decks.size})).filter(x=>x.games>=100).sort((a,b)=>b.winRate-a.winRate);
  };
  const dimensionsByType={classes:dimensionMetrics("classes"),races:dimensionMetrics("races"),collections:dimensionMetrics("collections")};
  const matrix = rows.map(r=>({deckA:r.deckA,deckB:r.deckB,games:r.completedGames,winRateA:r.winRateA/10,winRateB:r.winRateB/10,draws:r.draws,avgRounds:r.avgRounds,experimentId:r.experimentId}));
  return Response.json({ok:true,deckMetrics,outliers,matrix,runs,dimensions:{classes:[...new Set(deckMetrics.flatMap(d=>d.profile.classes.map(x=>x.key)))],races:[...new Set(deckMetrics.flatMap(d=>d.profile.races.map(x=>x.key)))],collections:[...new Set(deckMetrics.flatMap(d=>d.profile.collections.map(x=>x.key)))]},dimensionsByType});
}
