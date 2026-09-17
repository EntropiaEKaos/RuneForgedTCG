import { FORGED_FX_PRESETS, type FxPresetId, type ResolvedFx } from "./fx-registry";
import type { GameEvent } from "./events";
import type { CardDef, GameState, Keyword, Race, Rarity, Region } from "./types";

/** Presentation-only metadata. It never changes authoritative rules or state. */
export interface FxAssociationContext {
  defId?: string;
  region?: Region;
  races?: readonly Race[];
  classes?: readonly string[];
  keywords?: readonly Keyword[];
  customKeywords?: readonly string[];
  rarity?: Rarity;
  collectionKey?: string;
  cosmeticVariantId?: string;
  frameId?: string;
}
export type FxAssociationKind = "card" | "keyword" | "race" | "class" | "region" | "rarity" | "collection" | "cosmetic" | "frame";
export type FxAssociationSource = FxPresetId | "*";
export interface FxAssociation { kind: FxAssociationKind; key: string; sourcePresetId: FxAssociationSource; presetId: FxPresetId; priority?: number; }
const KIND_SPECIFICITY: Record<FxAssociationKind, number> = { card: 900, cosmetic: 800, frame: 700, collection: 600, keyword: 500, class: 400, race: 300, region: 200, rarity: 100 };
const normalize = (value: string) => value.trim().toLowerCase();
function contextKeys(context: FxAssociationContext): Map<FxAssociationKind, Set<string>> {
  return new Map([
    ["card", new Set(context.defId ? [normalize(context.defId)] : [])],
    ["keyword", new Set([...(context.keywords ?? []), ...(context.customKeywords ?? [])].map(normalize))],
    ["race", new Set((context.races ?? []).map(normalize))],
    ["class", new Set((context.classes ?? []).map(normalize))],
    ["region", new Set(context.region ? [normalize(context.region)] : [])],
    ["rarity", new Set(context.rarity ? [normalize(context.rarity)] : [])],
    ["collection", new Set(context.collectionKey ? [normalize(context.collectionKey)] : [])],
    ["cosmetic", new Set(context.cosmeticVariantId ? [normalize(context.cosmeticVariantId)] : [])],
    ["frame", new Set(context.frameId ? [normalize(context.frameId)] : [])],
  ] as [FxAssociationKind, Set<string>][]);
}
/** Explicit priority wins, then selector specificity, then stable lexical order. */
export function resolveFxAssociation(context: FxAssociationContext, sourcePresetId: FxPresetId, associations: readonly FxAssociation[]): FxAssociation | null {
  const keys = contextKeys(context);
  const matches = associations.filter((association) => (association.sourcePresetId === sourcePresetId || association.sourcePresetId === "*") && keys.get(association.kind)?.has(normalize(association.key)));
  matches.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || Number(b.sourcePresetId !== "*") - Number(a.sourcePresetId !== "*") || KIND_SPECIFICITY[b.kind] - KIND_SPECIFICITY[a.kind] || a.kind.localeCompare(b.kind) || a.key.localeCompare(b.key) || a.presetId.localeCompare(b.presetId));
  return matches[0] ?? null;
}
export function cardFxAssociationContext(card: CardDef): FxAssociationContext {
  return { defId: card.defId, region: card.region, races: card.race ? [card.race, ...(card.secondaryRaces ?? [])] : [...(card.secondaryRaces ?? [])], classes: card.classes ?? [], keywords: card.keywords ?? [], customKeywords: card.customKeywords ?? [], rarity: card.rarity };
}
export function cardDefIdForFxEvent(event: GameEvent, state: GameState): string | null {
  if (event.type === "UNIT_SUMMONED" || event.type === "UNIT_DIED") return event.defId;
  if (event.type === "UNIT_LEVELLED_UP") return event.toDefId;
  if (!("unitId" in event)) return null;
  return state.players[event.player].bench.find((unit) => unit.instanceId === event.unitId)?.defId ?? null;
}
/** Applies only an association scoped to this event's base preset family. */
export function applyFxAssociation(resolved: ResolvedFx, context: FxAssociationContext | null, associations: readonly FxAssociation[]): ResolvedFx {
  if (!context) return resolved;
  const association = resolveFxAssociation(context, resolved.preset.id, associations);
  return association ? { ...resolved, preset: FORGED_FX_PRESETS[association.presetId] } : resolved;
}
