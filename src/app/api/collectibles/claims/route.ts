import { NextRequest } from "next/server";
import { runtimeGate } from "@/lib/runtime-gates";
import { requireStablePlayerIdentity } from "@/lib/player-session";
import { claimCollectibleCampaign, CollectibleCampaignError, type CollectibleCampaignType } from "@/lib/collectible-campaign-service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const blocked = await runtimeGate("general");
  if (blocked) return blocked;
  try {
    const identity = await requireStablePlayerIdentity(req);
    if (!identity || identity.playerId == null) return Response.json({ ok: false, error: "Player session required" }, { status: 401 });
    const body = await req.json() as Record<string, unknown>;
    const campaignType = String(body.campaignType || "") as CollectibleCampaignType;
    const campaignKey = String(body.campaignKey || "").trim();
    const defId = String(body.defId || "").trim();
    const variantId = String(body.variantId || "").trim();
    if (!["event", "promotion"].includes(campaignType)) return Response.json({ ok: false, error: "campaignType must be event or promotion" }, { status: 400 });
    if (!campaignKey || campaignKey.length > 120 || !defId || defId.length > 120 || !variantId || variantId.length > 80) {
      return Response.json({ ok: false, error: "Valid campaignKey, defId and variantId are required" }, { status: 400 });
    }
    const result = await claimCollectibleCampaign({ playerId: identity.playerId, campaignType, campaignKey, defId, variantId });
    return Response.json({ ok: true, duplicate: result.duplicate, claim: result.claim, asset: result.asset });
  } catch (error) {
    if (error instanceof CollectibleCampaignError) {
      return Response.json({ ok: false, error: error.message, code: error.code }, { status: error.status });
    }
    console.error("[collectibles/claims] failed", error);
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
