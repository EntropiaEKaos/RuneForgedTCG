import { NextRequest } from "next/server";
import { db } from "@/db";
import { telemetryEvents } from "@/db/schema";
import { getPlayerSession } from "@/lib/player-session";
import { consumeRequestRateLimit } from "@/lib/rate-limit";
import { readBoundedJson, RequestBodyTooLargeError } from "@/lib/request-security";

const MAX_TELEMETRY_BODY_BYTES = 32 * 1024;
const SENSITIVE = /(token|secret|password|authorization|cookie|recovery|access.?key|email|phone|address)/i;
function sanitize(value: unknown, depth=0): unknown {
  if (depth>3) return undefined;
  if (typeof value === "string") return value.slice(0,500);
  if (typeof value === "number") return Number.isFinite(value)?value:undefined;
  if (typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) return value.slice(0,20).map(v=>sanitize(v,depth+1)).filter(v=>v!==undefined);
  if (value && typeof value === "object") { const out:Record<string,unknown>={}; for(const [k,v] of Object.entries(value as Record<string,unknown>).slice(0,50)){if(SENSITIVE.test(k))continue;const clean=sanitize(v,depth+1);if(clean!==undefined)out[k.slice(0,80)]=clean;} return out; }
  return undefined;
}
export async function POST(req:NextRequest){
  try{
    const rate=await consumeRequestRateLimit(req,"telemetry",120,60_000); if(!rate.allowed)return Response.json({ok:false,error:"Telemetry rate limit exceeded"},{status:429,headers:{"retry-after":String(rate.retryAfterSeconds)}});
    const body=await readBoundedJson<Record<string,unknown>>(req,MAX_TELEMETRY_BODY_BYTES);const eventName=String(body.eventName||"").trim().slice(0,100);if(!/^[a-z0-9_.:-]{2,100}$/i.test(eventName))return Response.json({ok:false,error:"Invalid event"},{status:400});
    const session=await getPlayerSession(req);const properties=sanitize(body.properties)||{};const rawSession=String(body.sessionId||"").slice(0,120);const sessionId=/^[A-Za-z0-9._:-]{1,120}$/.test(rawSession)?rawSession:null;
    await db.insert(telemetryEvents).values({playerId:session?.playerId||null,sessionId,eventName,properties:properties as Record<string,unknown>});return Response.json({ok:true});
  }catch(error){if(error instanceof RequestBodyTooLargeError)return Response.json({ok:false,error:"Payload too large"},{status:413});return Response.json({ok:false,error:"Invalid telemetry payload"},{status:400});}
}
