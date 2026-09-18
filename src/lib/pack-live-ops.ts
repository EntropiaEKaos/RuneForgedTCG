import type { Rarity } from "@/game/types";
import type { PackDef } from "@/lib/packs";

const PACK_KEY = /^[a-z0-9][a-z0-9_-]{1,79}$/;
const RARITIES: Rarity[] = ["Common", "Rare", "Epic", "Legend"];
const RARITY_RANK: Record<Rarity, number> = { Common: 0, Rare: 1, Epic: 2, Legend: 3 };

export interface PackLiveOpsRule {
  packIds: string[];
  discountPercent?: number;
  bonusCards?: number;
  guaranteedRarity?: Rarity;
  label?: string;
}

export interface PackLiveOpsSource {
  key: string;
  name: string;
  kind: "event" | "promotion";
  rule: PackLiveOpsRule;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function rawRules(value: unknown): unknown[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function packIdsFrom(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 50) return null;
  const normalized = value.map((item) => String(item).trim()).filter(Boolean);
  if (normalized.length !== value.length) return null;
  if (normalized.some((item) => item !== "*" && !PACK_KEY.test(item))) return null;
  return [...new Set(normalized)];
}

function integer(value: unknown, min: number, max: number): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) return null;
  return parsed;
}

export function validatePackLiveOpsRule(value: unknown, label = "Pack Live Ops"): string[] {
  if (!isObject(value)) return [`${label} must be an object.`];
  const errors: string[] = [];
  const packIds = packIdsFrom(value.packIds);
  if (!packIds) errors.push(`${label} needs 1-50 valid packIds (or "*").`);

  const discount = integer(value.discountPercent, 0, 75);
  if (value.discountPercent != null && discount == null) errors.push(`${label} discountPercent must be an integer from 0 to 75.`);

  const bonus = integer(value.bonusCards, 0, 2);
  if (value.bonusCards != null && bonus == null) errors.push(`${label} bonusCards must be an integer from 0 to 2.`);

  if (value.guaranteedRarity != null && !RARITIES.includes(String(value.guaranteedRarity) as Rarity)) {
    errors.push(`${label} guaranteedRarity must be Common, Rare, Epic, or Legend.`);
  }

  if (value.label != null && (typeof value.label !== "string" || value.label.trim().length > 120)) {
    errors.push(`${label} label must contain at most 120 characters.`);
  }

  if (value.discountPercent == null && value.bonusCards == null && value.guaranteedRarity == null) {
    errors.push(`${label} must define discountPercent, bonusCards, or guaranteedRarity.`);
  }
  return errors;
}

export function normalizePackLiveOpsRule(value: unknown): PackLiveOpsRule | null {
  if (validatePackLiveOpsRule(value).length || !isObject(value)) return null;
  const packIds = packIdsFrom(value.packIds);
  if (!packIds) return null;
  const discountPercent = integer(value.discountPercent, 0, 75);
  const bonusCards = integer(value.bonusCards, 0, 2);
  const guaranteedRarity = value.guaranteedRarity == null ? undefined : String(value.guaranteedRarity) as Rarity;
  const label = typeof value.label === "string" && value.label.trim() ? value.label.trim().slice(0, 120) : undefined;
  return {
    packIds,
    ...(discountPercent == null ? {} : { discountPercent }),
    ...(bonusCards == null ? {} : { bonusCards }),
    ...(guaranteedRarity ? { guaranteedRarity } : {}),
    ...(label ? { label } : {}),
  };
}

export function validatePackLiveOpsConfig(resource: string, row: any): string[] {
  if (resource === "events") {
    const value = row?.rules?.packEconomy;
    return rawRules(value).flatMap((rule, index) => validatePackLiveOpsRule(rule, `Event packEconomy #${index + 1}`));
  }
  if (resource === "promotions") {
    const offers = Array.isArray(row?.offers) ? row.offers : [];
    return offers.flatMap((offer: unknown, index: number) => {
      if (!isObject(offer)) return [];
      const kind = String(offer.kind ?? offer.type ?? "");
      if (kind !== "pack_modifier") return [];
      return validatePackLiveOpsRule(offer, `Promotion pack_modifier offer #${index + 1}`);
    });
  }
  return [];
}

function matching(rule: PackLiveOpsRule, packId: string) {
  return rule.packIds.includes("*") || rule.packIds.includes(packId);
}

function higherRarity(a: Rarity | undefined, b: Rarity | undefined): Rarity | undefined {
  if (!a) return b;
  if (!b) return a;
  return RARITY_RANK[b] > RARITY_RANK[a] ? b : a;
}

export function applyPackLiveOpsModifiers(pack: PackDef, sources: PackLiveOpsSource[]): PackDef {
  const active = sources.filter((source) => matching(source.rule, pack.id));
  if (!active.length) return structuredClone(pack);

  const discountPercent = active.reduce((max, source) => Math.max(max, source.rule.discountPercent ?? 0), 0);
  const bonusCards = active.reduce((max, source) => Math.max(max, source.rule.bonusCards ?? 0), 0);
  const guaranteedRarity = active.reduce<Rarity | undefined>(
    (current, source) => higherRarity(current, source.rule.guaranteedRarity),
    pack.guaranteedRarity,
  );

  const effectivePrice = Math.max(0, Math.floor(pack.price * (100 - discountPercent) / 100));
  const sourceNames = [...new Set(active.map((source) => source.rule.label || source.name).filter(Boolean))];
  const effects = [
    discountPercent > 0 ? `${discountPercent}% OFF` : null,
    bonusCards > 0 ? `+${bonusCards} carta${bonusCards === 1 ? "" : "s"}` : null,
    guaranteedRarity && guaranteedRarity !== pack.guaranteedRarity ? `garantia ${guaranteedRarity}+` : null,
  ].filter((item): item is string => Boolean(item));

  return {
    ...structuredClone(pack),
    price: effectivePrice,
    cardsCount: pack.cardsCount + bonusCards,
    guaranteedRarity,
    description: effects.length
      ? `${pack.description} · Live Ops: ${sourceNames.join(" + ")} — ${effects.join(" · ")}.`
      : pack.description,
  };
}

export function extractPackLiveOpsSources(resource: "events" | "promotions", row: any): PackLiveOpsSource[] {
  const key = String(row?.key || "").trim();
  const name = String(row?.name || key || "Live Ops").trim();
  if (!key) return [];

  if (resource === "events") {
    const values: unknown[] = rawRules(row?.rules?.packEconomy);
    return values
      .map((value: unknown): PackLiveOpsRule | null => normalizePackLiveOpsRule(value))
      .filter((rule: PackLiveOpsRule | null): rule is PackLiveOpsRule => rule !== null)
      .map((rule: PackLiveOpsRule): PackLiveOpsSource => ({ key, name, kind: "event", rule }));
  }

  const offers: unknown[] = Array.isArray(row?.offers) ? row.offers : [];
  return offers
    .filter((offer: unknown) => isObject(offer) && String(offer.kind ?? offer.type ?? "") === "pack_modifier")
    .map((value: unknown): PackLiveOpsRule | null => normalizePackLiveOpsRule(value))
    .filter((rule: PackLiveOpsRule | null): rule is PackLiveOpsRule => rule !== null)
    .map((rule: PackLiveOpsRule): PackLiveOpsSource => ({ key, name, kind: "promotion", rule }));
}

export async function loadActivePackLiveOpsSources(now = new Date()): Promise<PackLiveOpsSource[]> {
  try {
    const [{ db }, { adminEvents, adminPromotions }, drizzle] = await Promise.all([
      import("@/db"),
      import("@/db/schema"),
      import("drizzle-orm"),
    ]);
    const inWindow = (startsAt: any, endsAt: any) => drizzle.and(
      drizzle.or(drizzle.isNull(startsAt), drizzle.lte(startsAt, now)),
      drizzle.or(drizzle.isNull(endsAt), drizzle.gte(endsAt, now)),
    );
    const [events, promotions] = await Promise.all([
      db.select({
        key: adminEvents.key,
        name: adminEvents.name,
        rules: adminEvents.rules,
      }).from(adminEvents).where(drizzle.and(
        drizzle.eq(adminEvents.status, "published"),
        inWindow(adminEvents.startsAt, adminEvents.endsAt),
      )),
      db.select({
        key: adminPromotions.key,
        name: adminPromotions.name,
        offers: adminPromotions.offers,
      }).from(adminPromotions).where(drizzle.and(
        drizzle.eq(adminPromotions.status, "published"),
        inWindow(adminPromotions.startsAt, adminPromotions.endsAt),
      )),
    ]);
    return [
      ...events.flatMap((row) => extractPackLiveOpsSources("events", row)),
      ...promotions.flatMap((row) => extractPackLiveOpsSources("promotions", row)),
    ];
  } catch {
    return [];
  }
}

export async function applyActivePackLiveOps(packs: PackDef[]): Promise<PackDef[]> {
  const sources = await loadActivePackLiveOpsSources();
  if (!sources.length) return packs.map((pack) => structuredClone(pack));
  return packs.map((pack) => applyPackLiveOpsModifiers(pack, sources));
}
