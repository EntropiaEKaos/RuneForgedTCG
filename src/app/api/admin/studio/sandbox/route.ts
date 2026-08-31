import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { adminSandboxSessions } from "@/db/schema";
import { getAdminSessionContext, unauthorized } from "@/lib/admin-auth";
import { validateAuthorableCardWithActivatedAbilities } from "@/game/activated-ability-authoring";
const hash=(v:string)=>crypto.createHash("sha256").update(v).digest("hex");
export async function POST(req:NextRequest){const actor=await getAdminSessionContext(req);if(!actor)return unauthorized();if(!["admin","designer","qa"].includes(actor.role))return Response.json({ok:false,error:"Role cannot create sandbox"},{status:403});const body=await req.json();const validated=validateAuthorableCardWithActivatedAbilities(body.card);if(!validated.ok)return Response.json({ok:false,error:validated.error},{status:400});const token=crypto.randomBytes(32).toString("base64url");await db.insert(adminSandboxSessions).values({tokenHash:hash(token),actorId:actor.actorId,card:validated.card,metadata:body.metadata&&typeof body.metadata==="object"?body.metadata:{},expiresAt:new Date(Date.now()+30*60_000)});return Response.json({ok:true,token,expiresInMinutes:30});}
export async function GET(req:NextRequest){const actor=await getAdminSessionContext(req);if(!actor)return unauthorized();const token=String(req.nextUrl.searchParams.get("token")||"");const [row]=await db.select().from(adminSandboxSessions).where(and(eq(adminSandboxSessions.tokenHash,hash(token)),gt(adminSandboxSessions.expiresAt,new Date()))).limit(1);if(!row)return Response.json({ok:false,error:"Sandbox expired or invalid"},{status:404});if(actor.role!=="admin"&&row.actorId!==actor.actorId)return Response.json({ok:false,error:"Sandbox owner mismatch"},{status:403});return Response.json({ok:true,card:row.card,metadata:row.metadata,expiresAt:row.expiresAt});}
