import { NextRequest } from "next/server";
import { db } from "@/db";
import {
  adminApprovalRequests,
  adminCardLabRuns,
  adminContentReleases,
  adminContentVersions,
  adminQaRuns,
} from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import {
  adminRoleAllowed,
  getAdminSessionContext,
  isAdminAuthorized,
  unauthorized,
} from "@/lib/admin-auth";
import { CONTENT_RESOURCES, tableFor, type ContentResource } from "@/lib/content-pipeline";
import { ENGINE_VERSION, RULESET_VERSION } from "@/game/version";

export const dynamic = "force-dynamic";

type Lifecycle = "draft" | "qa" | "published" | "archived" | "unversioned-live";

type VersionMeta = {
  resource: string;
  resourceId: number;
  version: number;
  status: string;
  author: string;
  engineVersion: string | null;
  rulesetVersion: string | null;
  createdAt: Date;
};

function runtimeState(resource: ContentResource, row: Record<string, unknown>): string {
  if (resource === "card-meta") return String(row.releaseState || "draft");
  if (["collections", "events", "promotions"].includes(resource)) return String(row.status || "draft");
  if (typeof row.enabled === "boolean") return row.enabled ? "enabled" : "disabled";
  return "unknown";
}

function lifecycleFor(runtime: string, version?: VersionMeta): Lifecycle {
  if (version?.status === "qa") return "qa";
  if (version?.status === "draft") return "draft";
  if (version?.status === "published") {
    if (["archived", "disabled"].includes(runtime)) return "archived";
    return "published";
  }
  if (["published", "enabled"].includes(runtime)) return "unversioned-live";
  if (runtime === "archived") return "archived";
  return "draft";
}

function displayName(row: Record<string, any>): string {
  return String(row.name || row.key || row.defId || row.data?.name || `#${row.id ?? "?"}`);
}

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthorized(req))) return unauthorized();
  const actor = await getAdminSessionContext(req);
  if (!actor) return unauthorized();
  if (!adminRoleAllowed(actor.role, ["designer", "qa", "publisher"])) {
    return Response.json({ ok: false, error: `Role ${actor.role} cannot access release readiness` }, { status: 403 });
  }

  try {
    const [versionRows, activeReleaseRows, pendingApprovals, qaRuns, labRuns, resourceSets] = await Promise.all([
      db.select({
        resource: adminContentVersions.resource,
        resourceId: adminContentVersions.resourceId,
        version: adminContentVersions.version,
        status: adminContentVersions.status,
        author: adminContentVersions.author,
        engineVersion: adminContentVersions.engineVersion,
        rulesetVersion: adminContentVersions.rulesetVersion,
        createdAt: adminContentVersions.createdAt,
      }).from(adminContentVersions).orderBy(desc(adminContentVersions.createdAt)).limit(1000),
      db.select({
        version: adminContentReleases.version,
        contentHash: adminContentReleases.contentHash,
        manifest: adminContentReleases.manifest,
        actor: adminContentReleases.actor,
        createdAt: adminContentReleases.createdAt,
      }).from(adminContentReleases).where(eq(adminContentReleases.active, true)).orderBy(desc(adminContentReleases.version)).limit(1),
      db.select({
        id: adminApprovalRequests.id,
        resource: adminApprovalRequests.resource,
        resourceId: adminApprovalRequests.resourceId,
        stage: adminApprovalRequests.stage,
        requestedBy: adminApprovalRequests.requestedBy,
        createdAt: adminApprovalRequests.createdAt,
      }).from(adminApprovalRequests).where(eq(adminApprovalRequests.status, "pending")).orderBy(desc(adminApprovalRequests.createdAt)).limit(100),
      db.select({
        resource: adminQaRuns.resource,
        resourceId: adminQaRuns.resourceId,
        passed: adminQaRuns.passed,
        createdAt: adminQaRuns.createdAt,
      }).from(adminQaRuns).orderBy(desc(adminQaRuns.createdAt)).limit(50),
      db.select({
        defId: adminCardLabRuns.defId,
        iterations: adminCardLabRuns.iterations,
        passed: adminCardLabRuns.passed,
        failed: adminCardLabRuns.failed,
        engineVersion: adminCardLabRuns.engineVersion,
        rulesetVersion: adminCardLabRuns.rulesetVersion,
        contentVersion: adminCardLabRuns.contentVersion,
        createdAt: adminCardLabRuns.createdAt,
      }).from(adminCardLabRuns).orderBy(desc(adminCardLabRuns.createdAt)).limit(120),
      Promise.all(CONTENT_RESOURCES.map(async (resource) => ({
        resource,
        rows: await db.select().from(tableFor(resource)),
      }))),
    ]);

    const latestVersions = new Map<string, VersionMeta>();
    for (const version of versionRows) {
      const key = `${version.resource}:${version.resourceId}`;
      if (!latestVersions.has(key)) latestVersions.set(key, version);
    }

    const resources = resourceSets.map(({ resource, rows }) => {
      const counts: Record<Lifecycle, number> = {
        draft: 0,
        qa: 0,
        published: 0,
        archived: 0,
        "unversioned-live": 0,
      };
      const unversionedLive: Array<{ id: number; name: string }> = [];

      for (const raw of rows as Array<Record<string, any>>) {
        const id = Number(raw.id);
        const latest = Number.isInteger(id) ? latestVersions.get(`${resource}:${id}`) : undefined;
        const lifecycle = lifecycleFor(runtimeState(resource, raw), latest);
        counts[lifecycle] += 1;
        if (lifecycle === "unversioned-live" && unversionedLive.length < 5) {
          unversionedLive.push({ id, name: displayName(raw) });
        }
      }

      return { resource, total: rows.length, ...counts, unversionedLive };
    });

    const latestLabByCard = new Map<string, (typeof labRuns)[number]>();
    for (const run of labRuns) if (!latestLabByCard.has(run.defId)) latestLabByCard.set(run.defId, run);
    const labRegressions = [...latestLabByCard.values()]
      .filter((run) => run.failed > 0)
      .slice(0, 8)
      .map((run) => ({
        defId: run.defId,
        iterations: run.iterations,
        passed: run.passed,
        failed: run.failed,
        engineVersion: run.engineVersion,
        rulesetVersion: run.rulesetVersion,
        contentVersion: run.contentVersion,
        createdAt: run.createdAt.toISOString(),
      }));

    const recentQaFailures = qaRuns
      .filter((run) => !run.passed)
      .slice(0, 8)
      .map((run) => ({
        resource: run.resource,
        resourceId: run.resourceId,
        createdAt: run.createdAt.toISOString(),
      }));

    const activeRelease = activeReleaseRows[0];
    const manifest = activeRelease?.manifest && typeof activeRelease.manifest === "object"
      ? activeRelease.manifest as Record<string, unknown>
      : null;

    const totals = resources.reduce((acc, resource) => {
      acc.total += resource.total;
      acc.draft += resource.draft;
      acc.qa += resource.qa;
      acc.published += resource.published;
      acc.archived += resource.archived;
      acc.unversionedLive += resource["unversioned-live"];
      return acc;
    }, { total: 0, draft: 0, qa: 0, published: 0, archived: 0, unversionedLive: 0 });

    return Response.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      authority: {
        diagnosticOnly: true,
        engineVersion: ENGINE_VERSION,
        rulesetVersion: RULESET_VERSION,
      },
      totals: {
        ...totals,
        pendingApprovals: pendingApprovals.length,
        recentQaFailures: recentQaFailures.length,
        labRegressions: labRegressions.length,
      },
      resources,
      activeRelease: activeRelease ? {
        version: activeRelease.version,
        contentHash: activeRelease.contentHash,
        actor: activeRelease.actor,
        createdAt: activeRelease.createdAt.toISOString(),
        resource: typeof manifest?.resource === "string" ? manifest.resource : null,
        resourceId: typeof manifest?.resourceId === "number" ? manifest.resourceId : null,
        resourceVersion: typeof manifest?.resourceVersion === "number" ? manifest.resourceVersion : null,
        engineVersion: typeof manifest?.engineVersion === "string" ? manifest.engineVersion : null,
        rulesetVersion: typeof manifest?.rulesetVersion === "string" ? manifest.rulesetVersion : null,
      } : null,
      pendingApprovals: pendingApprovals.slice(0, 8).map((approval) => ({
        id: approval.id,
        resource: approval.resource,
        resourceId: approval.resourceId,
        stage: approval.stage,
        requestedBy: approval.requestedBy,
        createdAt: approval.createdAt.toISOString(),
      })),
      recentQaFailures,
      labRegressions,
      recentVersions: versionRows.slice(0, 10).map((version) => ({
        resource: version.resource,
        resourceId: version.resourceId,
        version: version.version,
        status: version.status,
        author: version.author,
        engineVersion: version.engineVersion,
        rulesetVersion: version.rulesetVersion,
        createdAt: version.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("[admin/studio/readiness] diagnostics failed", error);
    return Response.json({ ok: false, error: "Release readiness diagnostics unavailable" }, { status: 500 });
  }
}
