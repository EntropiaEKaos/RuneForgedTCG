import { NextRequest } from "next/server";
import { db } from "@/db";
import { desc } from "drizzle-orm";
import {
  adminKeywords, adminEffects, adminRaces, adminClasses, adminInteractions,
  adminCollections, cardCatalogMeta, adminEvents, adminPromotions, adminCardArchetypes, players, customCards,
} from "@/db/schema";
import { getAdminSessionContext, isAdminAuthorized, unauthorized, adminRoleAllowed } from "@/lib/admin-auth";
import { adminAuditLogs } from "@/db/schema";
import { validateContent, validateContentReferences } from "@/lib/content-pipeline";

export const dynamic = "force-dynamic";

const tables = {
  cards: customCards,
  keywords: adminKeywords,
  effects: adminEffects,
  archetypes: adminCardArchetypes,
  races: adminRaces,
  classes: adminClasses,
  interactions: adminInteractions,
  collections: adminCollections,
  "card-meta": cardCatalogMeta,
  events: adminEvents,
  promotions: adminPromotions,
  players,
} as const;

type Resource = keyof typeof tables;
function getTable(resource: string) { return tables[resource as Resource]; }

export async function GET(req: NextRequest, { params }: { params: Promise<{ resource: string }> }) {
  if (!(await isAdminAuthorized(req))) return unauthorized();
  const { resource } = await params;
  const actor = await getAdminSessionContext(req);
  if (!actor) return unauthorized();
  if (resource === "players" && !adminRoleAllowed(actor.role, "admin")) return Response.json({ ok: false, error: "Only admin can view player profiles" }, { status: 403 });
  const table = getTable(resource);
  if (!table) return Response.json({ ok: false, error: "Unknown resource" }, { status: 404 });
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit") || 200), 1), 1000);
  const rows = await db.select().from(table).orderBy(desc((table as any).id)).limit(limit);
  return Response.json({ ok: true, resource, rows });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ resource: string }> }) {
  if (!(await isAdminAuthorized(req))) return unauthorized();
  const actor = await getAdminSessionContext(req);
  if (!actor) return unauthorized();
  if (!adminRoleAllowed(actor.role, "designer")) return Response.json({ ok: false, error: `Role ${actor.role} cannot create content` }, { status: 403 });
  const { resource } = await params;
  if (resource === "players" && !adminRoleAllowed(actor.role, "admin")) return Response.json({ ok: false, error: "Only admin can manage player profiles" }, { status: 403 });
  if (resource === "players" || resource === "cards") return Response.json({ ok: false, error: resource === "cards" ? "Use the canonical Card Creator API for card creation." : "Player profiles are edited, not created here." }, { status: 405 });
  const table = getTable(resource);
  if (!table) return Response.json({ ok: false, error: "Unknown resource" }, { status: 404 });
  const body = await req.json();
  const clean = sanitize(resource, body);
  if (!clean.ok) return Response.json(clean, { status: 400 });
  const validation = validateContent(resource, clean.value);
  const refErrors = await validateContentReferences(resource as any, clean.value);
  if (!validation.passed || refErrors.length) return Response.json({ ok: false, error: "Content failed validation", validation: { ...validation, errors: [...validation.errors, ...refErrors], passed: false } }, { status: 400 });
  try {
    const [row] = await db.insert(table).values(clean.value as any).returning();
    await db.insert(adminAuditLogs).values({ action: "create", resource, resourceId: row.id, actor: actor.actorId, details: { role: actor.role } });
    return Response.json({ ok: true, row });
  } catch (e) {
    return Response.json({ ok: false, error: "Could not create resource. Key may already exist." }, { status: 409 });
  }
}

function sanitize(resource: string, body: any): { ok: true; value: any } | { ok: false; error: string } {
  if (resource === "cards") return { ok: false, error: "Cards must be created through /api/admin/cards." };
  if (!body || typeof body !== "object") return { ok: false, error: "Invalid JSON body" };
  const key = typeof body.key === "string" ? body.key.trim() : "";
  if (!["card-meta"].includes(resource) && !key) return { ok: false, error: "key is required" };
  if (resource !== "card-meta" && resource !== "players" && !/^[a-z0-9][a-z0-9_-]{1,63}$/.test(key)) return { ok: false, error: "Invalid key format" };
  const base = { ...body };
  delete base.id; delete base.createdAt; delete base.updatedAt;
  if (resource === "keywords") return { ok: true, value: { key, name: String(body.name || key).slice(0, 80), description: String(body.description || "").slice(0, 500), icon: body.icon ? String(body.icon).slice(0, 16) : null, engineKeyword: body.engineKeyword ? String(body.engineKeyword).slice(0, 80) : null, behavior: body.behavior || {}, enabled: false } };
  if (resource === "effects") return { ok: true, value: { key, name: String(body.name || key).slice(0, 80), description: String(body.description || "").slice(0, 500), kind: String(body.kind || "").slice(0, 80), schema: body.schema || {}, enabled: false } };
  if (resource === "archetypes") {
    const baseType = String(body.baseType || "");
    if (!["Unit","Spell","Enchantment","Artifact","Equipment","Sentinela"].includes(baseType)) return { ok: false, error: "Invalid archetype baseType" };
    return { ok: true, value: { key, name: String(body.name || key).slice(0,80), description: String(body.description || "").slice(0,500), baseType, definition: body.definition || {}, enabled: false } };
  }
  if (resource === "races") return { ok: true, value: { key, name: String(body.name || key).slice(0, 80), description: String(body.description || "").slice(0, 500), icon: body.icon ? String(body.icon).slice(0, 16) : null, region: body.region ? String(body.region).slice(0, 50) : null, color: body.color ? String(body.color).slice(0, 30) : null, enabled: false } };
  if (resource === "classes") return { ok: true, value: { key, name: String(body.name || key).slice(0, 80), description: String(body.description || "").slice(0, 500), icon: body.icon ? String(body.icon).slice(0, 16) : null, color: body.color ? String(body.color).slice(0, 30) : null, enabled: false } };
  if (resource === "interactions") return { ok: true, value: { name: String(body.name || "Interaction").slice(0, 120), sourceType: String(body.sourceType || "class"), sourceKey: String(body.sourceKey || ""), targetType: String(body.targetType || "class"), targetKey: String(body.targetKey || ""), condition: body.condition || {}, effect: body.effect || {}, priority: Number(body.priority) || 0, enabled: false } };
  if (resource === "collections") return { ok: true, value: { key, name: String(body.name || key).slice(0, 100), description: String(body.description || "").slice(0, 800), code: String(body.code || key).slice(0, 30), symbol: body.symbol ? String(body.symbol).slice(0, 300) : null, banner: body.banner ? String(body.banner).slice(0, 300) : null, releaseDate: body.releaseDate ? new Date(body.releaseDate) : null, rotationDate: body.rotationDate ? new Date(body.rotationDate) : null, status: "draft", metadata: body.metadata || {} } };
  if (resource === "card-meta") return { ok: true, value: { defId: String(body.defId || ""), collectionId: body.collectionId ? Number(body.collectionId) : null, tags: Array.isArray(body.tags) ? body.tags : [], classKeys: Array.isArray(body.classKeys) ? body.classKeys : [], raceKeys: Array.isArray(body.raceKeys) ? body.raceKeys : [], releaseState: "draft", notes: body.notes ? String(body.notes).slice(0, 1000) : null } };
  if (resource === "events") return { ok: true, value: { key, name: String(body.name || key).slice(0, 100), description: String(body.description || "").slice(0, 1000), type: String(body.type || "event"), status: "draft", startsAt: body.startsAt ? new Date(body.startsAt) : null, endsAt: body.endsAt ? new Date(body.endsAt) : null, rules: body.rules || {}, rewards: Array.isArray(body.rewards) ? body.rewards : [], metadata: body.metadata || {} } };
  if (resource === "promotions") return { ok: true, value: { key, name: String(body.name || key).slice(0, 100), description: String(body.description || "").slice(0, 1000), type: String(body.type || "store"), status: "draft", startsAt: body.startsAt ? new Date(body.startsAt) : null, endsAt: body.endsAt ? new Date(body.endsAt) : null, conditions: body.conditions || {}, offers: Array.isArray(body.offers) ? body.offers : [], metadata: body.metadata || {} } };
  return { ok: false, error: `Unsupported resource: ${resource}` };
}
