export type MarketplaceConfig = {
  enabled: boolean;
  feeBps: number;
  minPriceGold: number;
  maxPriceGold: number;
  maxActiveListings: number;
  listingDurationHours: number;
  tradeDurationHours: number;
  maxTradeCardsPerSide: number;
  minPlayerLevel: number;
  minAccountAgeHours: number;
};

export type RequestedCollectible = {
  defId: string;
  variantId?: string;
  frameId?: string;
  finish?: string;
};

export function marketplaceFee(priceGold: number, feeBps: number) {
  const price = Math.max(0, Math.trunc(priceGold));
  const bps = Math.max(0, Math.min(5000, Math.trunc(feeBps)));
  return Math.floor((price * bps) / 10_000);
}

export function marketplaceNet(priceGold: number, feeBps: number) {
  return Math.max(0, Math.trunc(priceGold) - marketplaceFee(priceGold, feeBps));
}

export function validateMarketPrice(priceGold: number, settings: Pick<MarketplaceConfig, "minPriceGold" | "maxPriceGold">) {
  return Number.isSafeInteger(priceGold) && priceGold >= settings.minPriceGold && priceGold <= settings.maxPriceGold;
}

export function playerCanUseMarketplace(
  player: { level: number; createdAt: Date },
  settings: Pick<MarketplaceConfig, "enabled" | "minPlayerLevel" | "minAccountAgeHours">,
  now = new Date(),
) {
  if (!settings.enabled) return { ok: false as const, error: "Marketplace is disabled" };
  if (player.level < settings.minPlayerLevel) return { ok: false as const, error: `Marketplace requires level ${settings.minPlayerLevel}` };
  const ageMs = now.getTime() - new Date(player.createdAt).getTime();
  if (ageMs < settings.minAccountAgeHours * 60 * 60 * 1000) {
    return { ok: false as const, error: `Marketplace requires an account age of ${settings.minAccountAgeHours} hours` };
  }
  return { ok: true as const };
}

export function normalizeRequestedCollectibles(input: unknown, max: number): RequestedCollectible[] | null {
  if (!Array.isArray(input) || input.length < 1 || input.length > max) return null;
  const normalized: RequestedCollectible[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") return null;
    const record = raw as Record<string, unknown>;
    const defId = String(record.defId || "").trim().slice(0, 120);
    if (!defId) return null;
    const optional = (value: unknown, limit: number) => {
      const text = typeof value === "string" ? value.trim().slice(0, limit) : "";
      return text || undefined;
    };
    normalized.push({
      defId,
      variantId: optional(record.variantId, 80),
      frameId: optional(record.frameId, 80),
      finish: optional(record.finish, 40),
    });
  }
  return normalized;
}

export function collectibleMatches(
  asset: { defId: string; variantId: string; frameId: string; finish: string },
  request: RequestedCollectible,
) {
  return asset.defId === request.defId
    && (!request.variantId || asset.variantId === request.variantId)
    && (!request.frameId || asset.frameId === request.frameId)
    && (!request.finish || asset.finish === request.finish);
}
