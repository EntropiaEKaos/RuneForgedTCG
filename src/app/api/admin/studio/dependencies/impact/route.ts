import { NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  adminCardArchetypes,
  adminCardLabRuns,
  adminEffects,
  adminKeywords,
  adminQaRuns,
  cardCatalogMeta,
  customCards,
} from "@/db/schema";
import { CARD_EFFECT_KINDS, CARD_KEYWORDS } from "@/game/card-authoring";
import { baseCardsOnly } from "@/game/cards";
import { buildCardDependencyGraph } from "@/game/content-dependency-graph";
import { analyzeDependencyImpact, type ImpactTargetKind } from "@/game/content-dependency-impact";
import {
  sanitizeArchetypeDefinition,
  sanitizeCompositeEffectDefinition,
  sanitizeKeywordBehavior,
} from "@/game/mechanics-authoring";
import type { CardDef } from "@/game/types";
import { ENGINE_VERSION, RULESET_VERSION } from "@/game/version";
import { adminRoleAllowed, getAdminSessionContext, isAdminAuthorized, unauthorized } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

type TargetRow = {
  id: number;
  key: string;
  name: string;
  enabled: boolean;
  engineKeyword?: string | null;
  behavior?: unknown;
  kind?: string;
  schema?: unknown;
  baseType?: string;
  definition?: unknown;
};

function isImpactKind(value: string): value is ImpactTargetKind {
  return value === "keyword" || value === "effect" || value === "archetype";
}

async function fetchTarget(kind: ImpactTargetKind, key: string): Promise<TargetRow | null> {
  if (kind === "keyword") {
    const [row] = await db.select({
      id: adminKeywords.id,
      key: adminKeywords.key,
      name: adminKeywords.name,
      enabled: adminKeywords.enabled,
      engineKeyword: adminKeywords.engineKeyword,
      behavior: adminKeywords.behavior,
    }).from(adminKeywords).where(eq(adminKeywords.key, key)).limit(1);
    return row ?? null;
  }
  if (kind === "effect") {
    const [row] = await db.select({
      id: adminEffects.id,
      key: adminEffects.key,
      name: adminEffects.name,
      enabled: adminEffects.enabled,
      kind: adminEffects.kind,
      schema: adminEffects.schema,
    }).from(adminEffects).where(eq(adminEffects.key, key)).limit(1);
    return row ?? null;
  }
  const [row] = await db.select({
    id: adminCardArchetypes.id,
    key: adminCardArchetypes.key,
    name: adminCardArchetypes.name,
    enabled: adminCardArchetypes.enabled,
    baseType: adminCardArchetypes.baseType,
    definition: adminCardArchetypes.definition,
  }).from(adminCardArchetypes).where(eq(adminCardArchetypes.key, key)).limit(1);
  return row ?? null;
}

function supportFor(kind: ImpactTargetKind, row: TargetRow) {
  if (kind === "keyword") {
    if (row.engineKeyword && (CARD_KEYWORDS as readonly string[]).includes(row.engineKeyword)) {
      return { valid: true, mode: "native", label: `Native engine keyword · ${row.engineKeyword}` };
    }
    const safe = sanitizeKeywordBehavior(row.behavior);
    return safe
      ? { valid: true, mode: "safe-dsl", label: "Safe DSL · trigger/condition/effect" }
      : { valid: false, mode: "invalid", label: "Keyword contract is not engine-supported" };
  }
  if (kind === "effect") {
    if (row.kind && (CARD_EFFECT_KINDS as readonly string[]).includes(row.kind)) {
      return { valid: true, mode: "native", label: `Native effect primitive · ${row.kind}` };
    }
    const safe = row.kind === "composite" && sanitizeCompositeEffectDefinition(row.schema);
    return safe
      ? { valid: true, mode: "safe-macro", label: "Safe composite macro" }
      : { valid: false, mode: "invalid", label: "Effect contract is not engine-supported" };
  }
  const safe = sanitizeArchetypeDefinition(row.definition, row.baseType);
  return safe
    ? { valid: true, mode: "structural", label: `Structural archetype · ${row.baseType}` }
    : { valid: false, mode: "invalid", label: "Archetype requests unsupported structural behavior" };
}

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthorized(req))) return unauthorized();
  const actor = await getAdminSessionContext(req);
  if (!actor) return unauthorized();
  if (!adminRoleAllowed(actor.role, "designer")) {
    return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const kindParam = String(req.nextUrl.searchParams.get("kind") || "").trim();
  const key = String(req.nextUrl.searchParams.get("key") || "").trim();
  if (!isImpactKind(kindParam)) return Response.json({ ok: false, error: "kind must be keyword, effect, or archetype" }, { status: 400 });
  if (!key || key.length > 64) return Response.json({ ok: false, error: "A valid mechanic key is required" }, { status: 400 });

  try {
    const target = await fetchTarget(kindParam, key);
    if (!target) return Response.json({ ok: false, error: `${kindParam} ${key} was not found` }, { status: 404 });

    const [customRows, metadataRows, qaRows, labRows] = await Promise.all([
      db.select().from(customCards),
      db.select({ defId: cardCatalogMeta.defId, releaseState: cardCatalogMeta.releaseState }).from(cardCatalogMeta),
      db.select({
        resourceId: adminQaRuns.resourceId,
        passed: adminQaRuns.passed,
        createdAt: adminQaRuns.createdAt,
      }).from(adminQaRuns).where(eq(adminQaRuns.resource, "cards")).orderBy(desc(adminQaRuns.createdAt)).limit(1000),
      db.select({
        defId: adminCardLabRuns.defId,
        passed: adminCardLabRuns.passed,
        failed: adminCardLabRuns.failed,
        engineVersion: adminCardLabRuns.engineVersion,
        rulesetVersion: adminCardLabRuns.rulesetVersion,
        contentVersion: adminCardLabRuns.contentVersion,
        createdAt: adminCardLabRuns.createdAt,
      }).from(adminCardLabRuns).orderBy(desc(adminCardLabRuns.createdAt)).limit(1000),
    ]);

    const baseCards = baseCardsOnly();
    const cards: CardDef[] = [...baseCards, ...customRows.map((row) => row.data as CardDef)];
    const graph = buildCardDependencyGraph(cards);
    const impact = analyzeDependencyImpact(graph, { kind: kindParam, key });

    const baseIds = new Set(baseCards.map((card) => card.defId));
    const customByDefId = new Map(customRows.map((row) => [row.defId, row]));
    const metadataByDefId = new Map(metadataRows.map((row) => [row.defId, row]));
    const cardByDefId = new Map(cards.map((card) => [card.defId, card]));
    const latestQaByCardId = new Map<number, (typeof qaRows)[number]>();
    for (const qa of qaRows) if (qa.resourceId != null && !latestQaByCardId.has(qa.resourceId)) latestQaByCardId.set(qa.resourceId, qa);
    const latestLabByDefId = new Map<string, (typeof labRows)[number]>();
    for (const lab of labRows) if (!latestLabByDefId.has(lab.defId)) latestLabByDefId.set(lab.defId, lab);

    const directSet = new Set(impact.directCardIds);
    const cardsInImpact = impact.allCardIds.map((defId) => {
      const card = cardByDefId.get(defId);
      const custom = customByDefId.get(defId);
      const metadata = metadataByDefId.get(defId);
      const qa = custom ? latestQaByCardId.get(custom.id) : undefined;
      const lab = latestLabByDefId.get(defId);
      const source = baseIds.has(defId) ? "base" : "custom";
      const live = source === "base" || Boolean(custom?.enabled);
      return {
        defId,
        name: card?.name ?? defId,
        region: card?.region ?? null,
        type: card?.type ?? null,
        rarity: card?.rarity ?? null,
        source,
        impact: directSet.has(defId) ? "direct" : "indirect",
        live,
        releaseState: metadata?.releaseState ?? (source === "base" ? "base" : live ? "live" : "draft"),
        qa: qa ? { passed: qa.passed, createdAt: qa.createdAt.toISOString() } : null,
        lab: lab ? {
          passed: lab.passed,
          failed: lab.failed,
          engineVersion: lab.engineVersion,
          rulesetVersion: lab.rulesetVersion,
          contentVersion: lab.contentVersion,
          createdAt: lab.createdAt.toISOString(),
        } : null,
      };
    });

    const counts = cardsInImpact.reduce((acc, card) => {
      acc.total += 1;
      if (card.impact === "direct") acc.direct += 1; else acc.indirect += 1;
      if (card.source === "base") acc.base += 1; else acc.custom += 1;
      if (card.live) acc.live += 1; else acc.draft += 1;
      return acc;
    }, { total: 0, direct: 0, indirect: 0, live: 0, draft: 0, base: 0, custom: 0 });

    const support = supportFor(kindParam, target);
    const qaFailures = cardsInImpact.filter((card) => card.qa && !card.qa.passed);
    const labRegressions = cardsInImpact.filter((card) => card.lab && card.lab.failed > 0);
    const warnings: Array<{ severity: "attention" | "blocker"; message: string }> = [];
    if (impact.coverage === "untracked" && impact.reason) warnings.push({ severity: "attention", message: impact.reason });
    if (!support.valid) warnings.push({ severity: "blocker", message: support.label });
    if (impact.affectedCycles.length) warnings.push({ severity: "blocker", message: `${impact.affectedCycles.length} dependency cycle(s) intersect the affected card set.` });
    if (qaFailures.length) warnings.push({ severity: "blocker", message: `${qaFailures.length} affected card(s) have a failing latest QA run.` });
    if (labRegressions.length) warnings.push({ severity: "blocker", message: `${labRegressions.length} affected card(s) have a regression in their latest Card Lab run.` });
    if (impact.coverage === "tracked" && counts.live > 0) warnings.push({ severity: "attention", message: `${counts.live} live/base card(s) are inside the blast radius.` });

    const status = warnings.some((warning) => warning.severity === "blocker")
      ? "blocker"
      : warnings.length
        ? "attention"
        : "clear";

    return Response.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      authority: {
        diagnosticOnly: true,
        engineVersion: ENGINE_VERSION,
        rulesetVersion: RULESET_VERSION,
        note: "Publish/QA gates remain authoritative; this endpoint does not mutate content or approve releases.",
      },
      target: {
        id: target.id,
        kind: kindParam,
        key: target.key,
        name: target.name,
        enabled: target.enabled,
        support,
      },
      status,
      tracking: { coverage: impact.coverage, reason: impact.reason },
      counts,
      warnings,
      cards: cardsInImpact,
      directEdges: impact.directEdges,
      indirectLinks: impact.indirectLinks,
      affectedCycles: impact.affectedCycles,
    });
  } catch (error) {
    console.error("[admin/studio/dependencies/impact] diagnostics failed", error);
    return Response.json({ ok: false, error: "Mechanics impact diagnostics unavailable" }, { status: 500 });
  }
}
