import { eq } from "drizzle-orm";
import { adminGameDefinitions } from "@/db/schema";

/** Remove stale asset-library reverse references for a card inside the caller transaction. */
export async function removeCardArtUsages(tx: any, defId: string, exceptAssetId?: number) {
  const rows = await tx.select().from(adminGameDefinitions).where(eq(adminGameDefinitions.domain, "asset-library"));
  let updated = 0;
  for (const row of rows) {
    if (exceptAssetId && row.id === exceptAssetId) continue;
    const payload = row.payload && typeof row.payload === "object" && !Array.isArray(row.payload) ? row.payload as Record<string, unknown> : {};
    const usages = Array.isArray(payload.usages) ? payload.usages : [];
    const next = usages.filter((usage) => !(usage && typeof usage === "object" && (usage as Record<string, unknown>).type === "card-art" && (usage as Record<string, unknown>).defId === defId));
    if (next.length === usages.length) continue;
    await tx.update(adminGameDefinitions).set({ payload: { ...payload, usages: next }, updatedAt: new Date() }).where(eq(adminGameDefinitions.id, row.id));
    updated += 1;
  }
  return updated;
}
