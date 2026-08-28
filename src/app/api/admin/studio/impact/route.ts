import { NextRequest } from "next/server";
import { getAdminSessionContext, unauthorized } from "@/lib/admin-auth";
import { analyzeCardImpact, cardArchiveAcknowledgement } from "@/lib/card-impact";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const actor = await getAdminSessionContext(req); if (!actor) return unauthorized();
  const defId = String(req.nextUrl.searchParams.get("defId") || "").trim();
  if (!defId) return Response.json({ ok: false, error: "defId is required" }, { status: 400 });
  const report = await analyzeCardImpact(defId);
  return Response.json({ ok: true, ...report, requiredArchiveAcknowledgement: report.totalActiveReferences > 0 ? cardArchiveAcknowledgement(defId, report.totalActiveReferences) : null });
}
