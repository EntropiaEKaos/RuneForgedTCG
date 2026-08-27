import type { ContentResource } from "./content-validation";

export type ContentRow = Record<string, any>;
export type CardVersionSnapshot = {
  card: ContentRow;
  metadata: ContentRow | null;
};

const IMMUTABLE_RESTORE_FIELDS = new Set(["id", "createdAt", "updatedAt"]);

export function buildVersionSnapshot(
  resource: string,
  row: ContentRow,
  metadata: ContentRow | null = null,
): unknown {
  if (resource === "cards") return { card: row, metadata } satisfies CardVersionSnapshot;
  return row;
}

export function isCardVersionSnapshot(value: unknown): value is CardVersionSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return Boolean(candidate.card && typeof candidate.card === "object" && !Array.isArray(candidate.card)) &&
    (candidate.metadata === null || (typeof candidate.metadata === "object" && !Array.isArray(candidate.metadata)));
}

export function unwrapVersionSnapshot(resource: string, snapshot: unknown): {
  row: ContentRow;
  metadata: ContentRow | null;
  complete: boolean;
} {
  if (resource !== "cards") {
    const row = snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)
      ? snapshot as ContentRow
      : {};
    return { row, metadata: null, complete: Object.keys(row).length > 0 };
  }
  if (!isCardVersionSnapshot(snapshot)) {
    // Versions created before 2.97.7 contain only the card row. They are useful
    // for diff/history, but cannot safely restore coupled launch metadata.
    const row = snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)
      ? snapshot as ContentRow
      : {};
    return { row, metadata: null, complete: false };
  }
  return { row: snapshot.card, metadata: snapshot.metadata, complete: snapshot.metadata !== null };
}

export function restorationPatch(row: ContentRow): ContentRow {
  return Object.fromEntries(Object.entries(row).filter(([key]) => !IMMUTABLE_RESTORE_FIELDS.has(key)));
}

export function contentIdentity(resource: ContentResource | string, row: ContentRow): string {
  if (resource === "cards") return String(row.defId || row.data?.defId || "");
  if (resource === "card-meta") return String(row.defId || "");
  if (typeof row.key === "string" && row.key) return row.key;
  return String(row.id ?? "");
}

export function assertSnapshotIdentity(
  resource: ContentResource | string,
  resourceId: number,
  current: ContentRow,
  target: ContentRow,
): string | null {
  if (Number(target.id) !== resourceId) return "Version snapshot resource ID does not match the rollback target.";
  const currentIdentity = contentIdentity(resource, current);
  const targetIdentity = contentIdentity(resource, target);
  if (currentIdentity && targetIdentity && currentIdentity !== targetIdentity) {
    return "Version snapshot stable identity does not match the rollback target.";
  }
  return null;
}
