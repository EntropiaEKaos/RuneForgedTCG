import { db } from "@/db";
import { adminCollections, adminEffects, adminInteractions, adminKeywords, adminClasses, adminRaces, adminEvents, adminPromotions, adminCardArchetypes, cardCatalogMeta, customCards } from "@/db/schema";
import { eq } from "drizzle-orm";
import { baseCardsOnly } from "@/game/cards";
import { sanitizeKeywordBehavior, sanitizeCompositeEffectDefinition, sanitizeArchetypeDefinition } from "@/game/mechanics-authoring";
import { CARD_KEYWORDS, CARD_EFFECT_KINDS } from "@/game/card-authoring";
import { dependenciesForCard } from "@/game/content-dependency-graph";
import type { ContentResource } from "./content-validation";
export {
  APPROVAL_STAGES,
  CONTENT_RESOURCES,
  isValidApprovalStage,
  requiredApprovalStages,
  validateContent,
} from "./content-validation";
export type { ApprovalStage, ContentResource } from "./content-validation";

export const contentTables: Record<ContentResource, any> = {
  cards: customCards, keywords: adminKeywords, effects: adminEffects, archetypes: adminCardArchetypes, races: adminRaces, classes: adminClasses,
  interactions: adminInteractions, collections: adminCollections, "card-meta": cardCatalogMeta,
  events: adminEvents, promotions: adminPromotions,
};

export function tableFor(resource: string) { return contentTables[resource as ContentResource]; }

/** Card approvals include launch metadata so changing the collection invalidates stale approvals. */
export async function approvalSnapshot(resource: string, row: any): Promise<unknown> {
  if (resource !== "cards") return row;
  const defId = String(row?.defId || row?.data?.defId || "");
  const [metadata] = defId
    ? await db.select().from(cardCatalogMeta).where(eq(cardCatalogMeta.defId, defId)).limit(1)
    : [];
  return { card: row, metadata: metadata ?? null };
}

export async function validateContentReferences(resource: ContentResource, row: any) {
  const errors: string[] = [];
  if (resource === "card-meta") {
    const [card] = await db.select().from(customCards).where(eq(customCards.defId, String(row?.defId || ""))).limit(1);
    const baseExists = baseCardsOnly().some((item) => item.defId === String(row?.defId || ""));
    if (!card && !baseExists) errors.push(`Card definition ${String(row?.defId || "") || "<empty>"} does not exist.`);
    if (row?.collectionId != null) {
      const [collection] = await db.select().from(adminCollections).where(eq(adminCollections.id, Number(row.collectionId))).limit(1);
      if (!collection) errors.push(`Collection ${Number(row.collectionId)} does not exist.`);
    }
  }
  if (resource === "keywords") {
    const mapsNative = (CARD_KEYWORDS as readonly string[]).includes(String(row?.engineKeyword || ""));
    if (!mapsNative && !sanitizeKeywordBehavior(row?.behavior)) errors.push("Keyword must map to a native engine keyword or compile to a safe mechanic trigger/condition/effect contract.");
  }
  if (resource === "effects") {
    const kind = String(row?.kind || "");
    if (kind === "composite" && !sanitizeCompositeEffectDefinition(row?.schema)) errors.push("Composite effect definition is invalid.");
    else if (kind !== "composite" && !(CARD_EFFECT_KINDS as readonly string[]).includes(kind)) errors.push("Effect must map to a native effect kind or be a valid composite macro.");
  }
  if (resource === "archetypes") {
    if (!sanitizeArchetypeDefinition(row?.definition, row?.baseType)) errors.push("Card archetype definition is invalid or requests unsupported structural behavior.");
  }
  if (resource === "interactions") {
    if (!row?.sourceKey || !row?.targetKey) errors.push("Interaction source and target are required.");
  }
  if (resource === "cards") {
    const defId = String(row?.defId || row?.data?.defId || "");
    if (defId && (await db.select().from(customCards).where(eq(customCards.defId, defId)).limit(1)).length === 0) {
      errors.push(`Card ${defId} is not persisted.`);
    }
    const card = row?.data ?? row;
    const [metadata] = await db.select().from(cardCatalogMeta).where(eq(cardCatalogMeta.defId, defId)).limit(1);
    if (!metadata?.collectionId) errors.push("Card must be assigned to a published launch collection.");
    else {
      const [collection] = await db.select({ status: adminCollections.status, name: adminCollections.name }).from(adminCollections).where(eq(adminCollections.id, metadata.collectionId)).limit(1);
      if (!collection) errors.push(`Collection ${metadata.collectionId} does not exist.`);
      else if (collection.status !== "published") errors.push(`Collection ${collection.name} must be published before this card can enter QA or Live.`);
    }
    const refs = dependenciesForCard(card).filter((ref) => ref.kind === "card" || ref.kind === "token" || ref.kind === "equipment");
    for (const ref of refs) {
      const value = String(ref.to);
      const [custom] = await db.select({ defId: customCards.defId, enabled: customCards.enabled, data: customCards.data }).from(customCards).where(eq(customCards.defId, value)).limit(1);
      const base = baseCardsOnly().find((candidate) => candidate.defId === value);
      const target = custom?.data as any ?? base;
      if (!target) {
        errors.push(`${ref.path} references unknown card ${value}.`);
        continue;
      }
      if (custom && !custom.enabled && value !== defId) errors.push(`${ref.path} references inactive custom card ${value}.`);
      if (ref.kind === "token" && target.type !== "Unit") errors.push(`${ref.path} must reference a Unit token (${value} is ${String(target.type)}).`);
      if (ref.kind === "equipment" && target.type !== "Equipment") errors.push(`${ref.path} must reference an Equipment card (${value} is ${String(target.type)}).`);
    }

    for (const key of Array.isArray(card?.customKeywords) ? card.customKeywords : []) {
      const [keyword] = await db.select({ id: adminKeywords.id, enabled: adminKeywords.enabled, behavior: adminKeywords.behavior }).from(adminKeywords).where(eq(adminKeywords.key, String(key))).limit(1);
      if (!keyword) { errors.push(`Custom keyword ${String(key)} does not exist.`); continue; }
      if (!keyword.enabled) { errors.push(`Custom keyword ${String(key)} is not published.`); continue; }
      const published = sanitizeKeywordBehavior(keyword.behavior);
      const embedded = (card?.mechanics || []).find((m:any) => m?.key === key);
      const embeddedNormalized = embedded ? { version:1, trigger:embedded.trigger, condition:embedded.condition ?? {kind:"always"}, effect:embedded.effect } : null;
      if (!published || !embeddedNormalized || JSON.stringify(published) !== JSON.stringify(embeddedNormalized)) errors.push(`Custom keyword ${String(key)} does not match its published mechanic contract.`);
    }
    if (card?.archetypeKey) {
      const [archetype] = await db.select({ id: adminCardArchetypes.id, enabled: adminCardArchetypes.enabled, baseType: adminCardArchetypes.baseType }).from(adminCardArchetypes).where(eq(adminCardArchetypes.key, String(card.archetypeKey))).limit(1);
      if (!archetype) errors.push(`Card archetype ${String(card.archetypeKey)} does not exist.`);
      else if (!archetype.enabled) errors.push(`Card archetype ${String(card.archetypeKey)} is not published.`);
      else if (String(archetype.baseType) !== String(card?.type)) errors.push(`Card archetype ${String(card.archetypeKey)} requires structural base type ${String(archetype.baseType)}.`);
    }
  }
  return errors;
}

export async function fetchContent(resource: ContentResource, id: number) {
  const table = tableFor(resource);
  const [row] = await db.select().from(table).where(eq((table as any).id, id)).limit(1);
  return row;
}
