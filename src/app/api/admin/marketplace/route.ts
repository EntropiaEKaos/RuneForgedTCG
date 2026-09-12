import { NextRequest } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { adminAuditLogs, marketListings, marketplaceSettings, tradeOffers } from "@/db/schema";
import { adminRoleAllowed, getAdminSessionContext, unauthorized, verifyAdminStepUp } from "@/lib/admin-auth";
import { readBoundedJson, RequestBodyTooLargeError } from "@/lib/request-security";

export const dynamic = "force-dynamic";
const MAX_BODY = 12 * 1024;

export async function GET(req: NextRequest) {
  const actor = await getAdminSessionContext(req);
  if (!actor) return unauthorized();
  if (!adminRoleAllowed(actor.role, ["liveops", "qa"])) return Response.json({ ok: false, error: "Insufficient marketplace permission" }, { status: 403 });
  try {
    const [settings, listingStats, tradeStats] = await Promise.all([
      db.select().from(marketplaceSettings).where(eq(marketplaceSettings.id, 1)).limit(1).then((rows) => rows[0] ?? null),
      db.select({
        active: sql<number>`count(*) filter (where ${marketListings.status} = 'active')::int`,
        sold: sql<number>`count(*) filter (where ${marketListings.status} = 'sold')::int`,
        grossGold: sql<number>`coalesce(sum(${marketListings.priceGold}) filter (where ${marketListings.status} = 'sold'),0)::int`,
        sunkFees: sql<number>`coalesce(sum(${marketListings.feeGold}) filter (where ${marketListings.status} = 'sold'),0)::int`,
      }).from(marketListings).then((rows) => rows[0]),
      db.select({
        active: sql<number>`count(*) filter (where ${tradeOffers.status} = 'active')::int`,
        accepted: sql<number>`count(*) filter (where ${tradeOffers.status} = 'accepted')::int`,
      }).from(tradeOffers).then((rows) => rows[0]),
    ]);
    return Response.json({ ok: true, settings, stats: { listings: listingStats, trades: tradeStats } });
  } catch (error) {
    console.error("[admin-marketplace] GET failed", error);
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const actor = await getAdminSessionContext(req);
  if (!actor) return unauthorized();
  if (actor.role !== "admin") return Response.json({ ok: false, error: "Only admin can change marketplace economy controls" }, { status: 403 });
  try {
    const body = await readBoundedJson<Record<string, unknown>>(req, MAX_BODY);
    const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
    const currentTotp = typeof body.currentTotp === "string" ? body.currentTotp : undefined;
    if (!(await verifyAdminStepUp(actor.userId, currentPassword, currentTotp))) return Response.json({ ok: false, error: "Step-up authentication failed" }, { status: 403 });

    const int = (key: string, min: number, max: number) => {
      if (body[key] === undefined) return undefined;
      const value = Math.trunc(Number(body[key]));
      if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`INVALID_${key}`);
      return value;
    };
    const patch = {
      enabled: body.enabled === undefined ? undefined : body.enabled === true,
      feeBps: int("feeBps", 0, 5000),
      minPriceGold: int("minPriceGold", 1, 1_000_000),
      maxPriceGold: int("maxPriceGold", 1, 10_000_000),
      maxActiveListings: int("maxActiveListings", 1, 200),
      listingDurationHours: int("listingDurationHours", 1, 720),
      tradeDurationHours: int("tradeDurationHours", 1, 720),
      maxTradeCardsPerSide: int("maxTradeCardsPerSide", 1, 20),
      minPlayerLevel: int("minPlayerLevel", 1, 1000),
      minAccountAgeHours: int("minAccountAgeHours", 0, 8760),
      updatedAt: new Date(),
      updatedBy: actor.actorId,
    };
    const clean = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
    const [current] = await db.select().from(marketplaceSettings).where(eq(marketplaceSettings.id, 1)).limit(1);
    if (!current) return Response.json({ ok: false, error: "Marketplace is not provisioned" }, { status: 503 });
    const nextMin = Number(clean.minPriceGold ?? current.minPriceGold);
    const nextMax = Number(clean.maxPriceGold ?? current.maxPriceGold);
    if (nextMax < nextMin) return Response.json({ ok: false, error: "maxPriceGold must be >= minPriceGold" }, { status: 400 });
    const [updated] = await db.update(marketplaceSettings).set(clean).where(eq(marketplaceSettings.id, 1)).returning();
    await db.insert(adminAuditLogs).values({
      action: "marketplace.settings.update",
      resource: "marketplace_settings",
      resourceId: 1,
      actor: actor.actorId,
      details: { before: current, after: updated },
    });
    return Response.json({ ok: true, settings: updated });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return Response.json({ ok: false, error: "Payload too large" }, { status: 413 });
    if (error instanceof Error && error.message.startsWith("INVALID_")) return Response.json({ ok: false, error: `Invalid ${error.message.slice(8)}` }, { status: 400 });
    console.error("[admin-marketplace] PATCH failed", error);
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
