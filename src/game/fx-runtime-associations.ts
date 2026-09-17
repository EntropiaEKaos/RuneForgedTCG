import { FORGED_FX_PRESETS, type FxPresetId } from "./fx-registry";
import type { FxAssociation, FxAssociationKind } from "./fx-associations";

const PRESET_IDS = new Set<FxPresetId>(Object.keys(FORGED_FX_PRESETS) as FxPresetId[]);
const KINDS = new Set<FxAssociationKind>(["card", "keyword", "race", "class", "region", "rarity", "collection", "cosmetic", "frame"]);
let runtimeAssociations: readonly FxAssociation[] = [];
let loadPromise: Promise<void> | null = null;

type PublishedFxAssociationRow = {
  kind?: unknown;
  key?: unknown;
  sourcePresetId?: unknown;
  presetId?: unknown;
  priority?: unknown;
};

function normalizeRow(row: PublishedFxAssociationRow): FxAssociation | null {
  if (typeof row.kind !== "string" || !KINDS.has(row.kind as FxAssociationKind)) return null;
  if (typeof row.key !== "string") return null;
  const key = row.key.trim();
  if (!key || key.length > 120) return null;
  if (typeof row.sourcePresetId !== "string" || (row.sourcePresetId !== "*" && !PRESET_IDS.has(row.sourcePresetId as FxPresetId))) return null;
  if (typeof row.presetId !== "string" || !PRESET_IDS.has(row.presetId as FxPresetId)) return null;
  if (!Number.isInteger(row.priority) || (row.priority as number) < -1000 || (row.priority as number) > 1000) return null;
  return {
    kind: row.kind as FxAssociationKind,
    key,
    sourcePresetId: row.sourcePresetId as FxPresetId | "*",
    presetId: row.presetId as FxPresetId,
    priority: row.priority as number,
  };
}

export function parsePublishedFxAssociations(payload: unknown): readonly FxAssociation[] {
  if (!payload || typeof payload !== "object") return [];
  const rows = (payload as { associations?: unknown }).associations;
  if (!Array.isArray(rows)) return [];
  const associations: FxAssociation[] = [];
  for (const candidate of rows) {
    if (!candidate || typeof candidate !== "object") continue;
    const association = normalizeRow(candidate as PublishedFxAssociationRow);
    if (association) associations.push(association);
  }
  return associations;
}

export function getRuntimeFxAssociations(): readonly FxAssociation[] {
  return runtimeAssociations;
}

/** Non-blocking presentation-only refresh. An empty snapshot preserves all static defaults. */
export function ensureRuntimeFxAssociationsLoaded(): void {
  if (typeof window === "undefined" || loadPromise) return;
  loadPromise = fetch("/api/client/fx-associations", { headers: { accept: "application/json" } })
    .then(async (response) => {
      if (!response.ok) return;
      const payload: unknown = await response.json();
      runtimeAssociations = parsePublishedFxAssociations(payload);
    })
    .catch(() => {})
    .finally(() => { loadPromise = null; });
}
