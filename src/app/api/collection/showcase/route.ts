import { NextRequest } from "next/server";
import { and, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { cardAssets, cardCosmeticVariants, friendships, playerCollectionShowcases, players } from "@/db/schema";
import { allCards } from "@/game/cards";
import { ensureCustomCardsLoaded } from "@/game/catalog";
import { resolveCardCosmeticPrestige } from "@/game/card-cosmetics";
import { getPlayerSession } from "@/lib/player-session";
import { consumeRequestRateLimit } from "@/lib/rate-limit";
import { readBoundedJson, RequestBodyTooLargeError } from "@/lib/request-security";
import { runtimeGate } from "@/lib/runtime-gates";

export const dynamic = "force-dynamic";
const MAX_SHOWCASE_ASSETS = 6;
const MAX_BODY = 32 * 1024;

async function areFriends(a:number,b:number) {
  if (a===b) return true;
  const rows=await db.select({id:friendships.id}).from(friendships).where(and(
    eq(friendships.status,"accepted"),
    or(and(eq(friendships.playerId,a),eq(friendships.friendId,b)),and(eq(friendships.playerId,b),eq(friendships.friendId,a))),
  )).limit(1);
  return rows.length>0;
}
async function enrich(playerId:number, assetIds:number[]) {
  await ensureCustomCardsLoaded();
  if (!assetIds.length) return [];
  const assets=await db.select().from(cardAssets).where(and(eq(cardAssets.ownerPlayerId,playerId),inArray(cardAssets.id,assetIds)));
  const variants=await db.select().from(cardCosmeticVariants).where(and(eq(cardCosmeticVariants.status,"published"),eq(cardCosmeticVariants.enabled,true)));
  const cards=new Map(allCards().map((card)=>[card.defId,card]));
  const variantMap=new Map(variants.map((variant)=>[`${variant.defId}:${variant.variantId}`,variant]));
  const assetMap=new Map(assets.map((asset)=>[asset.id,asset]));
  return assetIds.flatMap((id)=>{
    const asset=assetMap.get(id); if(!asset)return [];
    const card=cards.get(asset.defId);
    const variant=asset.variantId==="standard"?null:variantMap.get(`${asset.defId}:${asset.variantId}`)||null;
    const prestige=variant?resolveCardCosmeticPrestige(variant):{id:"standard",label:"Standard",shortLabel:"STANDARD",description:"Impressão base.",rank:0};
    return [{assetId:asset.id,defId:asset.defId,cardName:card?.name||asset.defId,cardRarity:card?.rarity||"Common",region:card?.region||null,emoji:card?.emoji||"◇",variantId:asset.variantId,variantName:variant?.name||"Standard",kind:variant?.kind||"standard",frameId:asset.frameId,finish:asset.finish,serialNumber:asset.serialNumber,edition:variant?.edition||null,prestige}];
  });
}
export async function GET(req:NextRequest) {
  const viewer=await getPlayerSession(req);
  const requested=String(req.nextUrl.searchParams.get("player")||"").trim();
  let target;
  if(requested){[target]=await db.select().from(players).where(eq(players.name,requested)).limit(1);}
  else if(viewer){[target]=await db.select().from(players).where(eq(players.id,viewer.playerId)).limit(1);}
  if(!target)return Response.json({ok:false,error:requested?"Player not found":"Player session required"},{status:requested?404:401});
  const [showcase]=await db.select().from(playerCollectionShowcases).where(eq(playerCollectionShowcases.playerId,target.id)).limit(1);
  const visibility=showcase?.visibility||"friends";
  const own=viewer?.playerId===target.id;
  if(!own){
    if(visibility==="private")return Response.json({ok:false,error:"This showcase is private"},{status:403});
    if(visibility==="friends"&&(!viewer||!(await areFriends(viewer.playerId,target.id))))return Response.json({ok:false,error:"This showcase is visible to friends only"},{status:403});
  }
  const assetIds=Array.isArray(showcase?.assetIds)?showcase!.assetIds.filter((id)=>Number.isInteger(id)).slice(0,MAX_SHOWCASE_ASSETS):[];
  const items=await enrich(target.id,assetIds);
  const distribution=items.reduce<Record<string,number>>((acc,item)=>{acc[item.prestige.id]=(acc[item.prestige.id]||0)+1;return acc;},{});
  return Response.json({ok:true,canEdit:own,player:{name:target.name,avatar:target.avatar,title:target.title,level:target.level},showcase:{visibility,tagline:showcase?.tagline||"",updatedAt:showcase?.updatedAt||null,items,stats:{selected:items.length,serialized:items.filter((item)=>item.serialNumber!=null).length,special:items.filter((item)=>item.variantId!=="standard").length,prestige:distribution}}});
}
export async function PUT(req:NextRequest) {
  const blocked=await runtimeGate("general"); if(blocked)return blocked;
  const rate=await consumeRequestRateLimit(req,"collector-showcase",30,60_000);if(!rate.allowed)return Response.json({ok:false,error:"Too many showcase updates"},{status:429});
  const identity=await getPlayerSession(req);if(!identity)return Response.json({ok:false,error:"Player session required"},{status:401});
  try{
    const body=await readBoundedJson<Record<string,unknown>>(req,MAX_BODY);
    const rawIds=Array.isArray(body.assetIds)?body.assetIds:[];
    const assetIds=[...new Set(rawIds.map(Number).filter((id)=>Number.isSafeInteger(id)&&id>0))];
    if(assetIds.length>MAX_SHOWCASE_ASSETS||assetIds.length!==rawIds.length)return Response.json({ok:false,error:"Choose up to six unique collectible copies"},{status:400});
    const visibility=String(body.visibility||"friends");if(!["public","friends","private"].includes(visibility))return Response.json({ok:false,error:"Invalid showcase visibility"},{status:400});
    const tagline=String(body.tagline||"").trim().replace(/\s+/g," ").slice(0,120);
    if(assetIds.length){const owned=await db.select({id:cardAssets.id}).from(cardAssets).where(and(eq(cardAssets.ownerPlayerId,identity.playerId),inArray(cardAssets.id,assetIds)));if(owned.length!==assetIds.length)return Response.json({ok:false,error:"Every showcase slot must reference an exact owned collectible copy"},{status:409});}
    const [saved]=await db.insert(playerCollectionShowcases).values({playerId:identity.playerId,assetIds,visibility,tagline,updatedAt:new Date()}).onConflictDoUpdate({target:playerCollectionShowcases.playerId,set:{assetIds,visibility,tagline,updatedAt:new Date()}}).returning();
    return Response.json({ok:true,showcase:saved});
  }catch(error){if(error instanceof RequestBodyTooLargeError)return Response.json({ok:false,error:"Payload too large"},{status:413});return Response.json({ok:false,error:"Invalid showcase payload"},{status:400});}
}
