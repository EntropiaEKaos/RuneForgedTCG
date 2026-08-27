import { NextRequest } from "next/server";
import crypto from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  adminAuditLogs,
  adminCardTestRuns,
  adminCardTests,
  adminContentReleases,
  adminContentVersions,
  cardCatalogMeta,
  customCards,
} from "@/db/schema";
import { getAdminSessionContext, isAdminAuthorized, adminRoleAllowed, unauthorized } from "@/lib/admin-auth";
import { stableJson } from "@/lib/match-integrity";
import { tableFor, validateContent, validateContentReferences } from "@/lib/content-pipeline";
import {
  assertSnapshotIdentity,
  buildVersionSnapshot,
  restorationPatch,
  unwrapVersionSnapshot,
} from "@/lib/content-version-snapshot";
import { validateAuthorableCard } from "@/game/card-authoring";
import { runCardTest } from "@/lib/card-test-runner";
import { buildCardDependencyGraph } from "@/game/content-dependency-graph";
import { baseCardsOnly } from "@/game/cards";
import { analyzeCandidateCard } from "@/lib/card-balance-analysis";
import { refreshCustomCardCache } from "@/game/catalog";
import { ENGINE_VERSION, RULESET_VERSION } from "@/game/version";

export const dynamic = "force-dynamic";

class RollbackError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

function contentHash(value: unknown): string {
  return crypto.createHash("sha256").update(stableJson(value)).digest("hex");
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthorized(req))) return unauthorized();
  const actor = await getAdminSessionContext(req);
  if (!actor) return unauthorized();
  if (!adminRoleAllowed(actor.role, "publisher")) {
    return Response.json({ ok: false, error: `Role ${actor.role} cannot rollback published content` }, { status: 403 });
  }

  try {
    const body = await req.json();
    const resource = String(body.resource || "");
    const resourceId = Number(body.resourceId);
    const targetVersion = Number(body.version);
    const expectedLatestVersion = Number(body.expectedLatestVersion);
    const table = tableFor(resource);
    if (!table || !Number.isInteger(resourceId) || !Number.isInteger(targetVersion) || !Number.isInteger(expectedLatestVersion)) {
      return Response.json({ ok: false, error: "resource, resourceId, version and expectedLatestVersion are required" }, { status: 400 });
    }

    const [preTarget] = await db.select().from(adminContentVersions).where(and(
      eq(adminContentVersions.resource, resource),
      eq(adminContentVersions.resourceId, resourceId),
      eq(adminContentVersions.version, targetVersion),
    )).limit(1);
    if (!preTarget) return Response.json({ ok: false, error: "Rollback target version was not found" }, { status: 404 });
    if (preTarget.status !== "published") {
      return Response.json({ ok: false, error: "Only previously published versions can be rolled back" }, { status: 409 });
    }

    const preSnapshot = unwrapVersionSnapshot(resource, preTarget.snapshot);
    if (!preSnapshot.complete) {
      return Response.json({
        ok: false,
        error: resource === "cards"
          ? "Legacy card snapshot does not contain coupled catalog metadata and cannot be safely rolled back. Publish the card once under 2.97.7 before using rollback."
          : "Version snapshot is incomplete and cannot be safely rolled back.",
      }, { status: 409 });
    }

    const staticValidation = validateContent(resource, preSnapshot.row);
    if (!staticValidation.passed) {
      return Response.json({ ok: false, error: "Rollback target no longer passes current content validation", validation: staticValidation }, { status: 409 });
    }

    let cardTestResults: Array<{ testId: number; passed: boolean; actual: unknown; errors: string[] }> = [];
    if (resource === "cards") {
      const cardValidation = validateAuthorableCard(preSnapshot.row.data);
      if (!cardValidation.ok) return Response.json({ ok: false, error: cardValidation.error }, { status: 409 });

      const tests = await db.select().from(adminCardTests).where(and(eq(adminCardTests.cardId, resourceId), eq(adminCardTests.enabled, true)));
      if (!tests.length) {
        return Response.json({ ok: false, error: "Card rollback requires at least one enabled automated regression test." }, { status: 409 });
      }
      cardTestResults = tests.map((test) => {
        const result = runCardTest(cardValidation.card, { scenario: test.scenario, expected: test.expected });
        return { testId: test.id, passed: result.passed, actual: result.actual, errors: result.errors };
      });
      if (cardTestResults.some((result) => !result.passed)) {
        return Response.json({ ok: false, error: "Rollback target failed current automated card regression tests", cardTests: cardTestResults }, { status: 409 });
      }

      const currentCustom = await db.select({ id: customCards.id, data: customCards.data }).from(customCards);
      const customSnapshot = currentCustom.map((entry) => entry.id === resourceId ? cardValidation.card : entry.data as any);
      const graph = buildCardDependencyGraph([...baseCardsOnly(), ...customSnapshot]);
      if (graph.cycles.length) {
        return Response.json({ ok: false, error: "Rollback target creates a card dependency cycle", cycles: graph.cycles.slice(0, 10) }, { status: 409 });
      }

      const balance = await analyzeCandidateCard(cardValidation.card, 30, 297700 + resourceId + targetVersion);
      if (balance.severity === "critical") {
        return Response.json({ ok: false, error: "Balance Lab blocked rollback: historical card is outside the current safe simulation envelope.", balance }, { status: 409 });
      }
    }

    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${resource}), ${resourceId})`);
      const [current] = await tx.select().from(table)
        .where(eq((table as any).id, resourceId)).limit(1).for("update");
      if (!current) throw new RollbackError(404, "Rollback target content no longer exists");

      const [latest] = await tx.select().from(adminContentVersions).where(and(
        eq(adminContentVersions.resource, resource),
        eq(adminContentVersions.resourceId, resourceId),
      )).orderBy(desc(adminContentVersions.version)).limit(1);
      if (!latest || latest.version !== expectedLatestVersion) {
        throw new RollbackError(409, "Content history changed since rollback was prepared. Reload versions and try again.", {
          expectedLatestVersion,
          actualLatestVersion: latest?.version ?? null,
        });
      }

      const [target] = await tx.select().from(adminContentVersions).where(and(
        eq(adminContentVersions.resource, resource),
        eq(adminContentVersions.resourceId, resourceId),
        eq(adminContentVersions.version, targetVersion),
        eq(adminContentVersions.status, "published"),
      )).limit(1);
      if (!target) throw new RollbackError(404, "Published rollback target version no longer exists");

      const [latestPublished] = await tx.select().from(adminContentVersions).where(and(
        eq(adminContentVersions.resource, resource),
        eq(adminContentVersions.resourceId, resourceId),
        eq(adminContentVersions.status, "published"),
      )).orderBy(desc(adminContentVersions.version)).limit(1);
      if (latestPublished?.version === targetVersion) {
        throw new RollbackError(409, "Target version is already the latest published version");
      }

      const targetSnapshot = unwrapVersionSnapshot(resource, target.snapshot);
      if (!targetSnapshot.complete) throw new RollbackError(409, "Rollback target snapshot is incomplete");
      const identityError = assertSnapshotIdentity(resource, resourceId, current as any, targetSnapshot.row);
      if (identityError) throw new RollbackError(409, identityError);

      const now = new Date();
      const primaryPatch = restorationPatch(targetSnapshot.row);
      if ((table as any).updatedAt) primaryPatch.updatedAt = now;
      const [restored] = await tx.update(table).set(primaryPatch).where(eq((table as any).id, resourceId)).returning();
      if (!restored) throw new RollbackError(409, "Content changed during rollback");

      let restoredMetadata: any = null;
      if (resource === "cards") {
        const targetMetadata = targetSnapshot.metadata;
        if (!targetMetadata) throw new RollbackError(409, "Card rollback snapshot is missing catalog metadata");
        const defId = String((restored as any).defId || (restored as any).data?.defId || "");
        const [lockedMetadata] = await tx.select().from(cardCatalogMeta)
          .where(eq(cardCatalogMeta.defId, defId)).limit(1).for("update");
        if (!lockedMetadata) throw new RollbackError(409, "Card catalog metadata no longer exists");
        if (Number(targetMetadata.id) !== lockedMetadata.id || String(targetMetadata.defId || "") !== defId) {
          throw new RollbackError(409, "Card metadata snapshot identity does not match the rollback target");
        }
        const metadataPatch = restorationPatch(targetMetadata);
        metadataPatch.updatedAt = now;
        [restoredMetadata] = await tx.update(cardCatalogMeta).set(metadataPatch)
          .where(eq(cardCatalogMeta.id, lockedMetadata.id)).returning();
        if (!restoredMetadata) throw new RollbackError(409, "Card metadata changed during rollback");
      }

      const restoredValidation = validateContent(resource, restored);
      const referenceErrors = await validateContentReferences(resource as any, restored, tx);
      restoredValidation.errors.push(...referenceErrors);
      restoredValidation.checks = restoredValidation.checks.map((check) => check.key === "references"
        ? { ...check, passed: referenceErrors.length === 0 }
        : check);
      restoredValidation.passed = restoredValidation.errors.length === 0;
      if (!restoredValidation.passed) {
        throw new RollbackError(409, "Rollback target is incompatible with current content references", { validation: restoredValidation });
      }

      for (const testResult of cardTestResults) {
        await tx.insert(adminCardTestRuns).values({
          testId: testResult.testId,
          cardId: resourceId,
          passed: testResult.passed,
          actual: testResult.actual as any,
          errors: testResult.errors,
          engineVersion: ENGINE_VERSION,
          rulesetVersion: RULESET_VERSION,
        });
      }

      const newVersion = latest.version + 1;
      const restoredSnapshot = buildVersionSnapshot(resource, restored as any, restoredMetadata ?? null);
      const changeNote = String(body.changeNote || `Rollback to published v${targetVersion}`).slice(0, 1000);
      const [versionRow] = await tx.insert(adminContentVersions).values({
        resource,
        resourceId,
        version: newVersion,
        status: "published",
        snapshot: restoredSnapshot as any,
        changeNote,
        author: actor.actorId,
        engineVersion: ENGINE_VERSION,
        rulesetVersion: RULESET_VERSION,
      }).returning();

      await tx.execute(sql`SELECT pg_advisory_xact_lock(1381320261)`);
      const [latestRelease] = await tx.select({ version: adminContentReleases.version }).from(adminContentReleases)
        .orderBy(desc(adminContentReleases.version)).limit(1);
      const releaseVersion = (latestRelease?.version || 0) + 1;
      const releaseHash = contentHash({ resource, resourceId, version: newVersion, snapshot: restoredSnapshot });
      await tx.update(adminContentReleases).set({ active: false }).where(eq(adminContentReleases.active, true));
      await tx.insert(adminContentReleases).values({
        version: releaseVersion,
        contentHash: releaseHash,
        manifest: {
          resource,
          resourceId,
          resourceVersion: newVersion,
          engineVersion: ENGINE_VERSION,
          rulesetVersion: RULESET_VERSION,
          snapshotFormat: resource === "cards" ? "coupled-v2" : "row-v1",
          rollback: {
            targetVersion,
            targetContentVersionId: target.id,
            targetEngineVersion: target.engineVersion,
            targetRulesetVersion: target.rulesetVersion,
            previousLatestVersion: latest.version,
          },
        },
        actor: actor.actorId,
        active: true,
      });
      await tx.insert(adminAuditLogs).values({
        action: "rollback",
        resource,
        resourceId,
        actor: actor.actorId,
        details: {
          targetVersion,
          previousLatestVersion: latest.version,
          newVersion,
          releaseVersion,
          releaseHash,
          targetEngineVersion: target.engineVersion,
          targetRulesetVersion: target.rulesetVersion,
        },
      });

      return { row: restored, version: versionRow, releaseVersion, releaseHash, validation: restoredValidation };
    });

    if (resource === "cards") await refreshCustomCardCache();
    return Response.json({ ok: true, ...result, rolledBackTo: targetVersion });
  } catch (error) {
    if (error instanceof RollbackError) {
      return Response.json({ ok: false, error: error.message, ...error.details }, { status: error.status });
    }
    console.error("[admin/studio/versions/rollback] failed", error);
    return Response.json({ ok: false, error: "Rollback failed" }, { status: 500 });
  }
}
