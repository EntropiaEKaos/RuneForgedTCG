import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { adminFxPresets } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await db.select({
      key: adminFxPresets.key,
      renderer: adminFxPresets.renderer,
      intensity: adminFxPresets.intensity,
      durationMs: adminFxPresets.durationMs,
      particleBudget: adminFxPresets.particleBudget,
      screenShake: adminFxPresets.screenShake,
      targetFlashMs: adminFxPresets.targetFlashMs,
      soundCue: adminFxPresets.soundCue,
    }).from(adminFxPresets)
      .where(eq(adminFxPresets.enabled, true))
      .orderBy(asc(adminFxPresets.key));

    return Response.json({ ok: true, presets: rows }, {
      headers: { "cache-control": "public, max-age=30, stale-while-revalidate=300" },
    });
  } catch (error) {
    console.error("[client/fx-presets] published preset read failed", error);
    return Response.json({ ok: false, presets: [] }, {
      status: 503,
      headers: { "cache-control": "no-store" },
    });
  }
}
