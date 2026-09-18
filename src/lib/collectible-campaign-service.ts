import { and, eq, gte, isNull, lte, or } from "drizzle-orm";
import { db } from "@/db";
import { adminEvents, adminPromotions, cardAssets, collectibleCampaignClaims, players } from "@/db/schema";
import { upgradeStandardAssetToCampaignVariant } from "@/lib/card-cosmetic-service";

export type CollectibleCampaignType = "event" | "promotion";

type CollectibleGrant = {
  type: "collectible";
  defId: string;
  variantId: string;
};

export class CollectibleCampaignError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 409) {
    super(message);
    this.name = "CollectibleCampaignError";
    this.code = code;
    this.status = status;
  }
}

function collectibleGrants(raw: unknown): CollectibleGrant[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const value = entry as Record<string, unknown>;
    if (String(value.type || "") !== "collectible") return [];
    const defId = String(value.defId || "").trim();
    const variantId = String(value.variantId || "").trim();
    return defId && variantId ? [{ type: "collectible" as const, defId, variantId }] : [];
  });
}

async function activeCampaign(tx: any, type: CollectibleCampaignType, key: string) {
  const now = new Date();
  if (type === "event") {
    const [row] = await tx.select().from(adminEvents).where(and(
      eq(adminEvents.key, key),
      eq(adminEvents.status, "published"),
      or(isNull(adminEvents.startsAt), lte(adminEvents.startsAt, now)),
      or(isNull(adminEvents.endsAt), gte(adminEvents.endsAt, now)),
    )).limit(1);
    return row ? { grants: collectibleGrants(row.rewards) } : null;
  }
  const [row] = await tx.select().from(adminPromotions).where(and(
    eq(adminPromotions.key, key),
    eq(adminPromotions.status, "published"),
    or(isNull(adminPromotions.startsAt), lte(adminPromotions.startsAt, now)),
    or(isNull(adminPromotions.endsAt), gte(adminPromotions.endsAt, now)),
  )).limit(1);
  return row ? { grants: collectibleGrants(row.offers) } : null;
}

/**
 * Campaign rewards upgrade one already-owned unlocked Standard copy rather than
 * minting gameplay power. player_cards count therefore remains unchanged.
 */
export async function claimCollectibleCampaign(input: {
  playerId: number;
  campaignType: CollectibleCampaignType;
  campaignKey: string;
  defId: string;
  variantId: string;
}) {
  return db.transaction(async (tx) => {
    // Serialize claims for the same account so retries/concurrent tabs cannot
    // consume two base copies before the unique claim row is observed.
    const [player] = await tx.select({ id: players.id }).from(players).where(eq(players.id, input.playerId)).limit(1).for("update");
    if (!player) throw new CollectibleCampaignError("PLAYER_NOT_FOUND", "Player not found", 404);

    const campaign = await activeCampaign(tx, input.campaignType, input.campaignKey);
    if (!campaign) throw new CollectibleCampaignError("CAMPAIGN_INACTIVE", "Campaign is not active", 404);
    const eligible = campaign.grants.some((grant) => grant.defId === input.defId && grant.variantId === input.variantId);
    if (!eligible) throw new CollectibleCampaignError("REWARD_NOT_ELIGIBLE", "This collectible is not a reward of the active campaign", 403);

    const [existing] = await tx.select().from(collectibleCampaignClaims).where(and(
      eq(collectibleCampaignClaims.playerId, input.playerId),
      eq(collectibleCampaignClaims.campaignType, input.campaignType),
      eq(collectibleCampaignClaims.campaignKey, input.campaignKey),
      eq(collectibleCampaignClaims.defId, input.defId),
      eq(collectibleCampaignClaims.variantId, input.variantId),
    )).limit(1);
    if (existing) {
      const assets = existing.assetId
        ? await tx.select().from(cardAssets).where(eq(cardAssets.id, existing.assetId)).limit(1)
        : [];
      return { duplicate: true, claim: existing, asset: assets[0] ?? null };
    }

    let asset;
    try {
      asset = await upgradeStandardAssetToCampaignVariant(tx, {
        playerId: input.playerId,
        defId: input.defId,
        variantId: input.variantId,
        acquisition: input.campaignType,
        source: `${input.campaignType}:${input.campaignKey}`,
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      if (code === "CAMPAIGN_BASE_COPY_REQUIRED") throw new CollectibleCampaignError(code, "An unlocked Standard copy of this card is required");
      if (code === "CAMPAIGN_VARIANT_UNAVAILABLE") throw new CollectibleCampaignError(code, "The campaign printing is not published and enabled");
      if (code === "CAMPAIGN_SERIAL_EXHAUSTED") throw new CollectibleCampaignError(code, "This serialized printing is exhausted");
      throw error;
    }

    const [claim] = await tx.insert(collectibleCampaignClaims).values({
      playerId: input.playerId,
      campaignType: input.campaignType,
      campaignKey: input.campaignKey,
      defId: input.defId,
      variantId: input.variantId,
      assetId: asset.id,
    }).returning();

    return { duplicate: false, claim, asset };
  });
}
