import { NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { adminCardLabRuns, customCards } from "@/db/schema";
import { runCardLaboratory } from "@/game/card-laboratory";
import type { CardDef } from "@/game/types";
import { ENGINE_VERSION, RULESET_VERSION } from "@/game/version";
import { CONTENT_VERSION } from "@/game/content-version";
import { getAdminSessionContext, adminRoleAllowed, unauthorized } from "@/lib/admin-auth";
import { consumeRateLimit } from "@/lib/rate-limit";

const POST_LIMIT = 12;
const POST_WINDOW_MS = 60_000;

async function requireQa(req: NextRequest) {
  const context = await getAdminSessionContext(req);
  if (!context) return { context: null, response: unauthorized() } as const;
  if (!adminRoleAllowed(context.role, "qa")) {
    return { context: null, response: Response.json({ ok: false, error: "Forbidden" }, { status: 403 }) } as const;
  }
  return { context, response: null } as const;
}

export async function GET(req: NextRequest) {
  const auth = await requireQa(req);
  if (!auth.context) return auth.response;

  const requestedLimit = Number(req.nextUrl.searchParams.get("limit") || 60);
  const limit = Math.max(1, Math.min(100, Number.isFinite(requestedLimit) ? Math.trunc(requestedLimit) : 60));
  const defId = String(req.nextUrl.searchParams.get("defId") || "").trim().slice(0, 160);
  const projection = {
    id: adminCardLabRuns.id,
    defId: adminCardLabRuns.defId,
    iterations: adminCardLabRuns.iterations,
    passed: adminCardLabRuns.passed,
    failed: adminCardLabRuns.failed,
    engineVersion: adminCardLabRuns.engineVersion,
    rulesetVersion: adminCardLabRuns.rulesetVersion,
    contentVersion: adminCardLabRuns.contentVersion,
    createdAt: adminCardLabRuns.createdAt,
  };

  const rows = defId
    ? await db.select(projection).from(adminCardLabRuns).where(eq(adminCardLabRuns.defId, defId)).orderBy(desc(adminCardLabRuns.createdAt)).limit(limit)
    : await db.select(projection).from(adminCardLabRuns).orderBy(desc(adminCardLabRuns.createdAt)).limit(limit);

  return Response.json({ ok: true, rows });
}

export async function POST(req: NextRequest) {
  const auth = await requireQa(req);
  if (!auth.context) return auth.response;

  const rate = await consumeRateLimit(`studio:card-lab:${auth.context.userId}`, POST_LIMIT, POST_WINDOW_MS);
  if (!rate.allowed) {
    return Response.json(
      { ok: false, error: "Card Laboratory rate limit exceeded" },
      { status: 429, headers: { "retry-after": String(rate.retryAfterSeconds) } },
    );
  }

  const body = await req.json().catch(() => null) as { defId?: unknown; iterations?: unknown } | null;
  if (!body) return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });

  const defId = String(body.defId || "").trim();
  if (!defId) return Response.json({ ok: false, error: "defId is required" }, { status: 400 });

  const [row] = await db.select().from(customCards).where(eq(customCards.defId, defId)).limit(1);
  if (!row) return Response.json({ ok: false, error: "Card not found" }, { status: 404 });

  const iterations = Math.max(1, Math.min(100, Number(body.iterations) || 12));
  const report = runCardLaboratory(row.data as CardDef, iterations);
  const [run] = await db.insert(adminCardLabRuns).values({
    cardId: row.id,
    defId,
    iterations,
    passed: report.passed,
    failed: report.failed,
    report,
    engineVersion: ENGINE_VERSION,
    rulesetVersion: RULESET_VERSION,
    contentVersion: CONTENT_VERSION,
  }).returning();

  return Response.json({ ok: true, run, report });
}
