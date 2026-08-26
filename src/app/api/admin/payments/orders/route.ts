import { NextRequest } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { paymentOrders } from "@/db/schema";
import { getAdminSessionContext, unauthorized } from "@/lib/admin-auth";
export const dynamic="force-dynamic";
export async function GET(req:NextRequest){const actor=await getAdminSessionContext(req);if(actor?.role!=="admin")return unauthorized();const rows=await db.select().from(paymentOrders).orderBy(desc(paymentOrders.id)).limit(100);return Response.json({ok:true,orders:rows.map(r=>({externalReference:r.externalReference,playerId:r.playerId,productName:r.productName,amountCents:r.amountCents,currency:r.currency,status:r.status,environment:r.providerEnvironment,approvedAt:r.approvedAt,fulfilledAt:r.fulfilledAt,createdAt:r.createdAt,requiresReview:Boolean((r.providerPayload as any)?.requiresReview)}))});}
