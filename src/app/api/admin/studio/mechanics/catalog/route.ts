import { NextRequest } from "next/server";
import { db } from "@/db";
import { adminKeywords, adminEffects, adminCardArchetypes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAdminSessionContext, isAdminAuthorized, unauthorized, adminRoleAllowed } from "@/lib/admin-auth";
import { CARD_EFFECT_KINDS, CARD_TARGETS, CARD_TRIGGERS, CARD_KEYWORDS, CARD_TYPES } from "@/game/card-authoring";
import { sanitizeKeywordBehavior, sanitizeCompositeEffectDefinition, sanitizeArchetypeDefinition } from "@/game/mechanics-authoring";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthorized(req))) return unauthorized();
  const actor = await getAdminSessionContext(req);
  if (!actor) return unauthorized();
  if (!adminRoleAllowed(actor.role, ["designer","qa","publisher"])) return Response.json({ ok:false, error:"Role cannot access mechanics catalog" }, { status:403 });
  const [keywords, effects, archetypes] = await Promise.all([
    db.select().from(adminKeywords).where(eq(adminKeywords.enabled, true)),
    db.select().from(adminEffects).where(eq(adminEffects.enabled, true)),
    db.select().from(adminCardArchetypes).where(eq(adminCardArchetypes.enabled, true)),
  ]);
  return Response.json({
    ok:true,
    primitives:{ effectKinds:CARD_EFFECT_KINDS, targets:CARD_TARGETS, triggers:CARD_TRIGGERS, engineKeywords:CARD_KEYWORDS, baseTypes:CARD_TYPES },
    keywords: keywords.map((x) => ({ key:x.key, name:x.name, icon:x.icon, behavior:sanitizeKeywordBehavior(x.behavior) })).filter((x) => x.behavior),
    effects: effects.map((x) => ({ key:x.key, name:x.name, definition:String(x.kind)==="composite" ? sanitizeCompositeEffectDefinition(x.schema) : null })).filter((x) => x.definition),
    archetypes: archetypes.map((x) => ({ key:x.key, name:x.name, description:x.description, baseType:x.baseType, definition:sanitizeArchetypeDefinition(x.definition, x.baseType) })).filter((x) => x.definition),
  });
}
