import { NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { adminAuditLogs, adminGameDefinitions } from "@/db/schema";
import { getAdminSessionContext, isAdminAuthorized, unauthorized } from "@/lib/admin-auth";
import { CONTROL_DOMAINS, CONTROL_DOMAIN_INFO, seedControlPlaneDefaults, validateControlDefinition, type ControlDefinitionInput, type ControlDomain } from "@/lib/control-plane";
import { ensureCustomCardsLoaded } from "@/game/catalog";

export const dynamic = "force-dynamic";

function cleanInput(body: any): ControlDefinitionInput | null {
  const domain = String(body?.domain || "") as ControlDomain;
  if (!CONTROL_DOMAINS.includes(domain)) return null;
  const key = String(body?.key || "").trim().toLowerCase();
  const name = String(body?.name || key).trim().slice(0, 120);
  const description = String(body?.description || "").trim().slice(0, 2000);
  const dangerLevel = ["safe", "elevated", "critical"].includes(String(body?.dangerLevel)) ? body.dangerLevel : CONTROL_DOMAIN_INFO[domain].danger;
  const schemaVersion = Math.max(1, Math.min(1000, Number(body?.schemaVersion) || 1));
  const payload = body?.payload && typeof body.payload === "object" && !Array.isArray(body.payload) ? body.payload : {};
  return { domain, key, name, description, dangerLevel, schemaVersion, payload };
}

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthorized(req))) return unauthorized();
  const actor = await getAdminSessionContext(req);
  if (!actor) return unauthorized();
  const requested = req.nextUrl.searchParams.get("domain") as ControlDomain | null;
  if (requested && !CONTROL_DOMAINS.includes(requested)) return Response.json({ ok: false, error: "Unknown control domain" }, { status: 404 });
  const query = requested
    ? db.select().from(adminGameDefinitions).where(eq(adminGameDefinitions.domain, requested)).orderBy(desc(adminGameDefinitions.id))
    : db.select().from(adminGameDefinitions).orderBy(desc(adminGameDefinitions.id));
  const rows = await query.limit(1000);
  return Response.json({ ok: true, rows, domains: CONTROL_DOMAIN_INFO, role: actor.role });
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthorized(req))) return unauthorized();
  const actor = await getAdminSessionContext(req);
  if (!actor) return unauthorized();
  if (actor.role !== "admin") return Response.json({ ok: false, error: "Total Control mutations require the admin role" }, { status: 403 });
  const body = await req.json();

  if (body?.action === "bootstrap") {
    const inserted = await seedControlPlaneDefaults();
    await db.insert(adminAuditLogs).values({ action: "control.bootstrap", resource: "control-plane", actor: actor.actorId, details: { inserted } });
    return Response.json({ ok: true, inserted });
  }

  if (body?.action === "import") {
    if (!Array.isArray(body.items) || body.items.length > 500) return Response.json({ ok: false, error: "Import requires up to 500 items" }, { status: 400 });
    await ensureCustomCardsLoaded();
    const prepared: Array<ControlDefinitionInput | null> = (body.items as unknown[]).map(cleanInput);
    if (prepared.some((item: ControlDefinitionInput | null) => !item)) return Response.json({ ok: false, error: "Import contains an unknown domain" }, { status: 400 });
    const reports = prepared.map((item: ControlDefinitionInput | null) => validateControlDefinition(item!));
    if (reports.some((item: { passed: boolean }) => !item.passed)) return Response.json({ ok: false, error: "Import failed validation", reports }, { status: 400 });
    const created: number[] = [];
    try {
      await db.transaction(async (tx) => {
        for (const item of prepared as ControlDefinitionInput[]) {
          const [row] = await tx.insert(adminGameDefinitions).values({ ...item, description: item.description || "", dangerLevel: item.dangerLevel || CONTROL_DOMAIN_INFO[item.domain].danger, schemaVersion: item.schemaVersion || 1, status: "draft", enabled: false }).returning({ id: adminGameDefinitions.id });
          created.push(row.id);
        }
        await tx.insert(adminAuditLogs).values({ action: "control.import", resource: "control-plane", actor: actor.actorId, details: { count: created.length, ids: created } });
      });
      return Response.json({ ok: true, created });
    } catch {
      return Response.json({ ok: false, error: "Import is atomic and was rolled back; verify duplicate keys" }, { status: 409 });
    }
  }

  const input = cleanInput(body);
  if (!input) return Response.json({ ok: false, error: "Unknown control domain" }, { status: 400 });
  await ensureCustomCardsLoaded();
  const validation = validateControlDefinition(input);
  if (!validation.passed) return Response.json({ ok: false, error: "Definition failed validation", validation }, { status: 400 });
  try {
    const [row] = await db.insert(adminGameDefinitions).values({
      ...input, description: input.description || "", dangerLevel: input.dangerLevel || CONTROL_DOMAIN_INFO[input.domain].danger,
      schemaVersion: input.schemaVersion || 1, status: "draft", enabled: false,
    }).returning();
    await db.insert(adminAuditLogs).values({ action: "control.create", resource: input.domain, resourceId: row.id, actor: actor.actorId, details: { key: row.key, dangerLevel: row.dangerLevel, warnings: validation.warnings } });
    return Response.json({ ok: true, row, validation });
  } catch {
    return Response.json({ ok: false, error: "A definition with this domain/key already exists" }, { status: 409 });
  }
}
