import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { collectionRewardClaims, playerCards } from "@/db/schema";
import { allCards } from "@/game/cards";
import { getCardCollection } from "@/game/card-collections";
import { ensureCustomCardsLoaded } from "@/game/catalog";
import { getCollectionRewardDefinition, getRuntimePacks } from "@/lib/control-plane";
import { requireStablePlayerIdentity } from "@/lib/player-session";
import { applyGameGrants, sanitizeGameGrants, validateGrantPackIds } from "@/lib/game-grants";
import { runtimeGate } from "@/lib/runtime-gates";

export const dynamic="force-dynamic";
async function snapshot(playerId:number,key:string){
  await ensureCustomCardsLoaded();
  const cards=allCards().filter(c=>getCardCollection(c.defId)?.key===key);
  const collectible=cards.filter(c=>c.collectible!==false);
  const owned=await db.select().from(playerCards).where(eq(playerCards.playerId,playerId)); const map=new Map(owned.map(x=>[x.defId,x.count]));
  const ownedDistinct=collectible.filter(c=>(map.get(c.defId)||0)>0).length; const percent=collectible.length?Math.floor(ownedDistinct*100/collectible.length):0;
  const rewardDef=await getCollectionRewardDefinition(key); const milestones=Array.isArray(rewardDef?.milestones)?rewardDef.milestones:[];
  const claims=await db.select().from(collectionRewardClaims).where(and(eq(collectionRewardClaims.playerId,playerId),eq(collectionRewardClaims.collectionKey,key))); const claimed=new Set(claims.map(x=>x.milestone));
  return {cards:cards.map(c=>({defId:c.defId,name:c.name,rarity:c.rarity,region:c.region,emoji:c.emoji,cost:c.cost,collectible:c.collectible!==false,owned:map.get(c.defId)||0})),totalDefinitions:cards.length,totalCollectible:collectible.length,ownedDistinct,percent,milestones:milestones.map((m:any)=>({percent:Number(m.percent),grants:sanitizeGameGrants(m.grants),claimed:claimed.has(Number(m.percent)),available:percent>=Number(m.percent)}))};
}
export async function GET(req:NextRequest,{params}:{params:Promise<{key:string}>}){const id=await requireStablePlayerIdentity(req);if(!id)return Response.json({ok:false,error:"Player session required"},{status:401});const key=String((await params).key||"").toLowerCase();return Response.json({ok:true,collection:key,...await snapshot(id.playerId,key)});}
export async function POST(req:NextRequest,{params}:{params:Promise<{key:string}>}){const blocked=await runtimeGate("general");if(blocked)return blocked;const id=await requireStablePlayerIdentity(req);if(!id)return Response.json({ok:false,error:"Player session required"},{status:401});const key=String((await params).key||"").toLowerCase();const body=await req.json();const milestone=Math.trunc(Number(body.milestone));const snap=await snapshot(id.playerId,key);const reward=snap.milestones.find((m:any)=>m.percent===milestone);if(!reward)return Response.json({ok:false,error:"Unknown milestone"},{status:404});if(!reward.available)return Response.json({ok:false,error:`Album progress ${snap.percent}% is below ${milestone}%`},{status:409});
 const packDefs=await getRuntimePacks(); const invalidPacks=validateGrantPackIds(reward.grants,packDefs.map(p=>p.id)); if(invalidPacks.length)return Response.json({ok:false,error:`Album reward is misconfigured: unknown pack(s) ${invalidPacks.join(", ")}`},{status:409});
 try{await db.transaction(async tx=>{const inserted=await tx.insert(collectionRewardClaims).values({playerId:id.playerId,collectionKey:key,milestone,grants:reward.grants}).onConflictDoNothing().returning({id:collectionRewardClaims.id});if(!inserted.length)throw new Error("Reward already claimed");await applyGameGrants(tx,{playerId:id.playerId,grants:reward.grants,reason:"collection_milestone",referenceType:"collection",referenceId:`${key}:${milestone}`});});}catch(e){return Response.json({ok:false,error:e instanceof Error?e.message:"Claim failed"},{status:409});}
 return Response.json({ok:true,...await snapshot(id.playerId,key)});}
