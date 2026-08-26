import { NextRequest } from "next/server";
import crypto from "node:crypto";
import { stableJson } from "@/lib/match-integrity";
import { db } from "@/db";
import { adminAuditLogs, adminContentVersions, adminContentReleases, adminApprovalRequests, adminCardTests, adminCardTestRuns, matchTokens, modeAttempts, pvpRooms, customCards, cardCatalogMeta } from "@/db/schema";
import { eq, and, desc, isNull, or, sql } from "drizzle-orm";
import { getAdminSessionContext, isAdminAuthorized, adminRoleAllowed, unauthorized } from "@/lib/admin-auth";
import { approvalSnapshot, fetchContent, validateContent, validateContentReferences, tableFor, requiredApprovalStages } from "@/lib/content-pipeline";
import { ENGINE_VERSION, RULESET_VERSION } from "@/game/version";
import { runCardTest } from "@/lib/card-test-runner";
import { ensureCustomCardsLoaded, refreshCustomCardCache } from "@/game/catalog";
import { validateAuthorableCard as validateCard } from "@/game/card-authoring";
import { buildCardDependencyGraph } from "@/game/content-dependency-graph";
import { baseCardsOnly } from "@/game/cards";
import { analyzeCandidateCard } from "@/lib/card-balance-analysis";
import { analyzeCardImpact, cardArchiveAcknowledgement } from "@/lib/card-impact";
import { analyzeContentReverseDependencies } from "@/lib/content-impact";

export const dynamic = "force-dynamic";

function contentHash(value: unknown): string {
  return crypto.createHash("sha256").update(stableJson(value)).digest("hex");
}

async function approvedStages(resource: string, id: number, current: unknown) {
  const required = requiredApprovalStages(resource);
  const hash = contentHash(current);
  const approvals = await db.select().from(adminApprovalRequests).where(and(eq(adminApprovalRequests.resource, resource), eq(adminApprovalRequests.resourceId, id), eq(adminApprovalRequests.status, "approved"), eq(adminApprovalRequests.contentHash, hash)));
  const stages = new Set(approvals.map((a) => a.stage));
  return { required, missing: required.filter((stage) => !stages.has(stage)), contentHash: hash };
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthorized(req))) return unauthorized();
  const actor = await getAdminSessionContext(req);
  if (!actor) return unauthorized();
  try {
    const b = await req.json();
    const resource = String(b.resource || "");
    const id = Number(b.resourceId);
    const action = String(b.action || "");
    const table = tableFor(resource);
    if (!table || !Number.isInteger(id)) return Response.json({ ok: false, error: "Invalid content target" }, { status: 400 });
    const row = await fetchContent(resource as any, id);
    if (!row) return Response.json({ ok: false, error: "Content not found" }, { status: 404 });

    const approvalTarget = await approvalSnapshot(resource, row);
    const validation = validateContent(resource, row);
    const refErrors = await validateContentReferences(resource as any, row);
    validation.errors.push(...refErrors);
    validation.checks = validation.checks.map((check) => check.key === "references" ? { ...check, passed: refErrors.length === 0 } : check);
    validation.passed = validation.errors.length === 0;
    if (["publish", "qa"].includes(action) && !validation.passed) return Response.json({ ok: false, error: "Validation failed", validation }, { status: 400 });

    if (resource === "cards" && ["publish", "qa"].includes(action)) {
      await ensureCustomCardsLoaded();
      const tests = await db.select().from(adminCardTests).where(eq(adminCardTests.cardId, id));
      const cardValidation = validateCard((row as any).data);
      if (!cardValidation.ok) return Response.json({ ok: false, error: cardValidation.error }, { status: 400 });
      const results = [];
      for (const test of tests.filter((x) => x.enabled)) {
        const result = runCardTest(cardValidation.card, { scenario: test.scenario, expected: test.expected });
        await db.insert(adminCardTestRuns).values({ testId: test.id, cardId: id, passed: result.passed, actual: result.actual, errors: result.errors, engineVersion: ENGINE_VERSION, rulesetVersion: RULESET_VERSION });
        results.push({ id: test.id, passed: result.passed, errors: result.errors });
      }
      if (results.some((x) => !x.passed)) return Response.json({ ok: false, error: "Automated card regression tests failed", validation, cardTests: results }, { status: 400 });
      if (!tests.some((x) => x.enabled)) return Response.json({ ok: false, error: "Card publish/QA requires at least one enabled automated regression test." }, { status: 400 });
      const customRows = await db.select({ data: customCards.data }).from(customCards);
      const graph = buildCardDependencyGraph([...baseCardsOnly(), ...customRows.map((x: any) => x.data as any)]);
      if (graph.cycles.length) return Response.json({ ok:false, error:"Card dependency cycle detected", cycles: graph.cycles.slice(0,10) }, { status:409 });
      const balance = await analyzeCandidateCard(cardValidation.card, action === "publish" ? 30 : 20, 293000 + id);
      if (balance.severity === "critical") return Response.json({ ok:false, error:"Balance Lab blocked QA/Publish: candidate is outside the safe simulation envelope.", balance }, { status:409 });
    }

    if (action === "qa") {
      if (!adminRoleAllowed(actor.role, "qa")) return Response.json({ ok: false, error: `Role ${actor.role} cannot certify QA` }, { status: 403 });
      const last = await db.select().from(adminContentVersions).where(and(eq(adminContentVersions.resource, resource), eq(adminContentVersions.resourceId, id))).orderBy(desc(adminContentVersions.version)).limit(1);
      const version = (last[0]?.version || 0) + 1;
      await db.insert(adminContentVersions).values({ resource, resourceId: id, version, status: "qa", snapshot: row as any, changeNote: String(b.changeNote || "QA certified from Content Studio"), author: actor.actorId, engineVersion: ENGINE_VERSION, rulesetVersion: RULESET_VERSION });
      await db.insert(adminAuditLogs).values({ action: "qa", resource, resourceId: id, actor: actor.actorId, details: { version, contentHash: contentHash(approvalTarget) } });
      return Response.json({ ok: true, row, validation, version });
    }

    if (action === "publish") {
      if (!adminRoleAllowed(actor.role, "publisher")) return Response.json({ ok: false, error: `Role ${actor.role} cannot publish content` }, { status: 403 });
      const approvals = await approvedStages(resource, id, approvalTarget);
      if (approvals.missing.length) return Response.json({ ok: false, error: "Required approvals are missing", missingApprovals: approvals.missing, requiredApprovals: approvals.required }, { status: 409 });
      // Publish must be compare-and-swap against the exact approved content hash.
      // Otherwise an editor could modify the row after approval but before this update.
      const currentRow = await fetchContent(resource as any, id);
      const currentHash = contentHash(await approvalSnapshot(resource, currentRow));
      if (currentHash !== approvals.contentHash) return Response.json({ ok: false, error: "Content changed after approval; new validation/approval is required." }, { status: 409 });
      const patch: any = resource === "card-meta" ? { releaseState: "published", updatedAt: new Date() } : ["collections", "events", "promotions"].includes(resource) ? { status: "published", updatedAt: new Date() } : { enabled: true, updatedAt: new Date() };
      const updatedAtColumn = (table as any).updatedAt;
      const publishWhere = updatedAtColumn && row.updatedAt
        ? and(eq((table as any).id, id), eq(updatedAtColumn, row.updatedAt))
        : eq((table as any).id, id);

      // Content state, immutable version, active release and audit record are a
      // single atomic publication. Any failure rolls every write back.
      const published = await db.transaction(async (tx) => {
        // Serialize publishing of this resource row and lock the approved snapshot.
        // The card metadata row is part of a card approval hash, so it must be
        // locked too; otherwise collection metadata could change in the small
        // window between approval verification and commit.
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${resource}), ${id})`);
        const [lockedCurrent] = await tx.select().from(table)
          .where(eq((table as any).id, id)).limit(1).for("update");
        if (!lockedCurrent) return null;

        let lockedMetadata: any = null;
        let lockedApprovalSnapshot: unknown = lockedCurrent;
        if (resource === "cards") {
          const defId = String((lockedCurrent as any)?.defId || (lockedCurrent as any)?.data?.defId || "");
          if (defId) {
            [lockedMetadata] = await tx.select().from(cardCatalogMeta)
              .where(eq(cardCatalogMeta.defId, defId)).limit(1).for("update");
          }
          lockedApprovalSnapshot = { card: lockedCurrent, metadata: lockedMetadata ?? null };
        }
        if (contentHash(lockedApprovalSnapshot) !== approvals.contentHash) return null;

        const [updated] = await tx.update(table).set(patch).where(publishWhere).returning();
        if (!updated) return null;
        if (resource === "cards" && lockedMetadata) {
          const [publishedMeta] = await tx.update(cardCatalogMeta)
            .set({ releaseState: "published", updatedAt: new Date() })
            .where(eq(cardCatalogMeta.id, lockedMetadata.id))
            .returning();
          lockedMetadata = publishedMeta ?? { ...lockedMetadata, releaseState: "published" };
        }

        const last = await tx.select().from(adminContentVersions)
          .where(and(eq(adminContentVersions.resource, resource), eq(adminContentVersions.resourceId, id)))
          .orderBy(desc(adminContentVersions.version)).limit(1);
        const version = (last[0]?.version || 0) + 1;
        await tx.insert(adminContentVersions).values({ resource, resourceId: id, version, status: "published", snapshot: updated as any, changeNote: String(b.changeNote || "Published from Content Studio"), author: actor.actorId, engineVersion: ENGINE_VERSION, rulesetVersion: RULESET_VERSION });

        // Release numbers are global, so serialize this tiny critical section
        // across concurrent publications of different resources.
        await tx.execute(sql`SELECT pg_advisory_xact_lock(1381320261)`);
        const latestRelease = await tx.select({ version: adminContentReleases.version }).from(adminContentReleases).orderBy(desc(adminContentReleases.version)).limit(1);
        const releaseVersion = (latestRelease[0]?.version || 0) + 1;
        const releaseSnapshot = resource === "cards" ? { card: updated, metadata: lockedMetadata ?? null } : updated;
        const releaseHash = contentHash({ resource, resourceId: id, version, snapshot: releaseSnapshot });
        await tx.update(adminContentReleases).set({ active: false }).where(eq(adminContentReleases.active, true));
        await tx.insert(adminContentReleases).values({ version: releaseVersion, contentHash: releaseHash, manifest: { resource, resourceId: id, resourceVersion: version, engineVersion: ENGINE_VERSION, rulesetVersion: RULESET_VERSION }, actor: actor.actorId, active: true });
        await tx.insert(adminAuditLogs).values({ action: "publish", resource, resourceId: id, actor: actor.actorId, details: { version, releaseVersion, releaseHash, approvals } });
        return { updated, version, releaseVersion, releaseHash };
      });
      if (!published) return Response.json({ ok: false, error: "Content changed during publish; approval is stale. Re-run validation and approvals." }, { status: 409 });
      if (resource === "cards") await refreshCustomCardCache();
      return Response.json({ ok: true, row: published.updated, validation, version: published.version, releaseVersion: published.releaseVersion, releaseHash: published.releaseHash });
    }

    if (action === "archive") {
      if (!adminRoleAllowed(actor.role, "publisher")) return Response.json({ ok: false, error: `Role ${actor.role} cannot archive content` }, { status: 403 });
      if (resource === "cards") {
        const defId = String((row as any).defId || (row as any).data?.defId || "");
        if (defId) {
          const [activeToken] = await db.select({ id: matchTokens.id }).from(matchTokens).where(and(isNull(matchTokens.usedAt), sql`${matchTokens.expiresAt} > NOW()`, or(sql`${matchTokens.deckSnapshot}->'cards' ? ${defId}`, sql`${matchTokens.opponentSnapshot}->'cards' ? ${defId}`))).limit(1);
          const [activeAttempt] = await db.select({ id: modeAttempts.id }).from(modeAttempts).where(and(isNull(modeAttempts.usedAt), sql`${modeAttempts.expiresAt} > NOW()`, or(sql`${modeAttempts.playerDeckSnapshot}->'cards' ? ${defId}`, sql`${modeAttempts.opponentDeckSnapshot}->'cards' ? ${defId}`))).limit(1);
          const [activeRoom] = await db.select({ id: pvpRooms.id }).from(pvpRooms).where(and(eq(pvpRooms.state, "playing"), or(sql`${pvpRooms.hostDeckSnapshot}->'cards' ? ${defId}`, sql`${pvpRooms.guestDeckSnapshot}->'cards' ? ${defId}`))).limit(1);
          if (activeToken || activeAttempt || activeRoom) return Response.json({ ok: false, error: "Card is used by an active match/attempt and cannot be archived until those sessions finish." }, { status: 409 });
          const impact = await analyzeCardImpact(defId);
          if (impact.totalActiveReferences > 0) {
            const required = cardArchiveAcknowledgement(defId, impact.totalActiveReferences);
            if (String(b.impactAcknowledgement || "") !== required) return Response.json({ ok:false, error:"Archive has active references and requires an exact impact acknowledgement.", impact, requiredArchiveAcknowledgement: required }, { status:409 });
          }
        }
      } else if (resource !== "card-meta") {
        const impact = await analyzeContentReverseDependencies(resource, row);
        if (impact.totalActiveReferences > 0) return Response.json({ ok: false, error: "Content has active reverse dependencies and cannot be archived until dependents are changed or archived.", impact }, { status: 409 });
      }
      const patch: any = resource === "card-meta" ? { releaseState: "archived", updatedAt: new Date() } : ["collections", "events", "promotions"].includes(resource) ? { status: "archived", updatedAt: new Date() } : { enabled: false, updatedAt: new Date() };
      const archived = await db.transaction(async (tx) => {
        const [updated] = await tx.update(table).set(patch).where(eq((table as any).id, id)).returning();
        if (!updated) return null;
        if (resource === "cards") {
          const defId = String((updated as any).defId || (updated as any).data?.defId || "");
          if (defId) await tx.update(cardCatalogMeta).set({ releaseState: "archived", updatedAt: new Date() }).where(eq(cardCatalogMeta.defId, defId));
        }
        await tx.insert(adminAuditLogs).values({ action: "archive", resource, resourceId: id, actor: actor.actorId, details: { role: actor.role } });
        return updated;
      });
      if (!archived) return Response.json({ ok: false, error: "Content not found" }, { status: 404 });
      if (resource === "cards") await refreshCustomCardCache();
      return Response.json({ ok: true, row: archived });
    }
    return Response.json({ ok: false, error: "Unsupported pipeline action" }, { status: 400 });
  } catch (error) {
    console.error("[admin/studio/pipeline] operation failed", error);
    return Response.json({ ok: false, error: "Pipeline operation failed" }, { status: 500 });
  }
}
