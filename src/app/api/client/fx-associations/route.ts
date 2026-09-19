import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { adminFxAssociations } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await db.select({
      kind: adminFxAssociations.kind,
      key: adminFxAssociations.key,
      sourcePresetId: adminFxAssociations.sourcePresetId,
      presetId: adminFxAssociations.presetId,
      priority: adminFxAssociations.priority,
    }).from(adminFxAssociations)
      .where(eq(adminFxAssociations.enabled, true))
      .orderBy(asc(adminFxAssociations.kind), asc(adminFxAssociations.key), asc(adminFxAssociations.sourcePresetId));

    return Response.json({ ok: true, associations: rows }, {
      headers: { "cache-control": "public, max-age=30, stale-while-revalidate=300" },
    });
  } catch (error) {
    console.error("[client/fx-associations] published association read failed", error);
    return Response.json({ ok: false, associations: [] }, {
      status: 503,
      headers: { "cache-control": "no-store" },
    });
  }
}
