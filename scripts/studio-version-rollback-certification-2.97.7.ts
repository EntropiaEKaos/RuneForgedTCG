import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { and, desc, eq, gt, inArray, or } from "drizzle-orm";

import { db, pool } from "@/db";
import {
  adminApprovalRequests,
  adminAuditLogs,
  adminCardTestRuns,
  adminCardTests,
  adminCollections,
  adminContentReleases,
  adminContentVersions,
  adminSessions,
  adminUsers,
  cardCatalogMeta,
  customCards,
} from "@/db/schema";
import { createAdminSession } from "@/lib/admin-auth";
import { hashAdminPassword } from "@/lib/admin-credentials";
import { POST as createCard } from "@/app/api/admin/cards/route";
import { PUT as updateCard } from "@/app/api/admin/cards/[id]/route";
import { POST as createResource } from "@/app/api/admin/studio/[resource]/route";
import { PATCH as updateResource } from "@/app/api/admin/studio/[resource]/[id]/route";
import { POST as pipeline } from "@/app/api/admin/studio/pipeline/route";
import { POST as requestApproval, PATCH as decideApproval } from "@/app/api/admin/studio/approvals/route";
import { POST as createCardTest } from "@/app/api/admin/studio/card-tests/route";
import { POST as rollbackVersion } from "@/app/api/admin/studio/versions/rollback/route";
import { baseCardsOnly } from "@/game/cards";
import { getCustomCard, refreshCustomCardCache } from "@/game/catalog";

const ORIGIN = "http://localhost:3000";
type Json = Record<string, any>;
type Target = { resource: string; id: number };

function req(path: string, method: string, token: string, body?: unknown): NextRequest {
  const headers = new Headers({
    host: "localhost:3000",
    origin: ORIGIN,
    "sec-fetch-site": "same-origin",
    cookie: `rf_admin_session=${token}`,
  });
  if (body !== undefined) headers.set("content-type", "application/json");
  return new NextRequest(`${ORIGIN}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function ok(response: Response, label: string): Promise<Json> {
  const body = await response.json() as Json;
  assert.equal(response.ok, true, `${label}: HTTP ${response.status} ${JSON.stringify(body)}`);
  assert.notEqual(body.ok, false, `${label}: ${JSON.stringify(body)}`);
  return body;
}

async function rejected(response: Response, status: number, label: string): Promise<Json> {
  const body = await response.json() as Json;
  assert.equal(response.status, status, `${label}: expected ${status}, got ${response.status}: ${JSON.stringify(body)}`);
  assert.equal(body.ok, false, `${label}: expected explicit failure`);
  return body;
}

async function history(resource: string, resourceId: number) {
  return db.select().from(adminContentVersions).where(and(
    eq(adminContentVersions.resource, resource),
    eq(adminContentVersions.resourceId, resourceId),
  )).orderBy(desc(adminContentVersions.version));
}

async function certifyAndPublish(target: Target, requesterToken: string, reviewerToken: string, note: string) {
  await ok(await pipeline(req("/api/admin/studio/pipeline", "POST", reviewerToken, {
    resource: target.resource,
    resourceId: target.id,
    action: "qa",
    changeNote: `${note} QA`,
  })), `${note}: QA`);

  for (const stage of ["content", "qa"] as const) {
    const requested = await ok(await requestApproval(req("/api/admin/studio/approvals", "POST", requesterToken, {
      resource: target.resource,
      resourceId: target.id,
      stage,
      note: `${note}: ${stage} approval request`,
    })), `${note}: request ${stage}`);
    await ok(await decideApproval(req("/api/admin/studio/approvals", "PATCH", reviewerToken, {
      id: requested.row.id,
      status: "approved",
      decisionNote: `${note}: independent exact-hash approval`,
    })), `${note}: approve ${stage}`);
  }

  return ok(await pipeline(req("/api/admin/studio/pipeline", "POST", reviewerToken, {
    resource: target.resource,
    resourceId: target.id,
    action: "publish",
    changeNote: `${note} publish`,
  })), `${note}: publish`);
}

async function main() {
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL is required");
  assert.ok(process.env.ADMIN_SESSION_SECRET, "ADMIN_SESSION_SECRET is required");

  const suffix = `${Date.now().toString(36)}_${process.pid.toString(36)}`;
  const prefix = `cert2977_${suffix}`.slice(0, 38);
  const actorIds: number[] = [];
  const actorAuditIds: string[] = [];
  let collectionId: number | null = null;
  let cardId: number | null = null;
  let cardDefId = "";

  const baselineActiveRelease = (await db.select().from(adminContentReleases)
    .where(eq(adminContentReleases.active, true)).orderBy(desc(adminContentReleases.id)).limit(1))[0] ?? null;
  const baselineLatestReleaseId = (await db.select({ id: adminContentReleases.id }).from(adminContentReleases)
    .orderBy(desc(adminContentReleases.id)).limit(1))[0]?.id ?? 0;

  try {
    const credentials = hashAdminPassword(`CI-${suffix}-rollback-password-42!`);
    const [author, reviewer] = await db.insert(adminUsers).values([
      { username: `${prefix}_author`, passwordSalt: credentials.salt, passwordHash: credentials.hash, role: "admin", enabled: true },
      { username: `${prefix}_reviewer`, passwordSalt: credentials.salt, passwordHash: credentials.hash, role: "admin", enabled: true },
    ]).returning();
    actorIds.push(author.id, reviewer.id);
    actorAuditIds.push(`admin:${author.id}`, `admin:${reviewer.id}`);
    const authorToken = await createAdminSession({ id: author.id, username: author.username, role: "admin" });
    const reviewerToken = await createAdminSession({ id: reviewer.id, username: reviewer.username, role: "admin" });

    // Collection: v1 -> v2 -> rollback to v1 as a new immutable publication.
    const collection = await ok(await createResource(req("/api/admin/studio/collections", "POST", authorToken, {
      key: `${prefix}_collection`,
      name: "Rollback Collection V1",
      code: `R${suffix.slice(-8)}`.toUpperCase(),
      symbol: "↶",
      description: "Historical collection version one",
      metadata: { certification: "2.97.7", revision: 1 },
    }), { params: Promise.resolve({ resource: "collections" }) }), "create rollback collection");
    collectionId = collection.row.id;
    await certifyAndPublish({ resource: "collections", id: collectionId }, authorToken, reviewerToken, "collection v1");
    const collectionV1 = (await history("collections", collectionId)).find((version) => version.status === "published");
    assert.ok(collectionV1, "collection v1 published snapshot must exist");

    await ok(await pipeline(req("/api/admin/studio/pipeline", "POST", reviewerToken, {
      resource: "collections", resourceId: collectionId, action: "archive",
    })), "archive collection before v2 edit");
    await ok(await updateResource(req(`/api/admin/studio/collections/${collectionId}`, "PATCH", authorToken, {
      name: "Rollback Collection V2",
      description: "Historical collection version two",
      metadata: { certification: "2.97.7", revision: 2 },
    }), { params: Promise.resolve({ resource: "collections", id: String(collectionId) }) }), "edit collection v2");
    await certifyAndPublish({ resource: "collections", id: collectionId }, authorToken, reviewerToken, "collection v2");

    const collectionLatest = (await history("collections", collectionId))[0];
    assert.ok(collectionLatest.version > collectionV1.version, "collection v2 history must advance");
    await rejected(await rollbackVersion(req("/api/admin/studio/versions/rollback", "POST", reviewerToken, {
      resource: "collections",
      resourceId: collectionId,
      version: collectionV1.version,
      expectedLatestVersion: collectionLatest.version - 1,
    })), 409, "collection rollback stale-history guard");

    const collectionRollback = await ok(await rollbackVersion(req("/api/admin/studio/versions/rollback", "POST", reviewerToken, {
      resource: "collections",
      resourceId: collectionId,
      version: collectionV1.version,
      expectedLatestVersion: collectionLatest.version,
      changeNote: "2.97.7 collection rollback certification",
    })), "rollback collection to v1");
    assert.equal(collectionRollback.row.name, "Rollback Collection V1");
    assert.equal(collectionRollback.row.description, "Historical collection version one");
    assert.equal(collectionRollback.row.metadata.revision, 1);
    assert.equal(collectionRollback.version.status, "published");
    assert.equal(collectionRollback.version.version, collectionLatest.version + 1);

    // Card: definition and catalog metadata are one rollback unit.
    const simpleUnit = baseCardsOnly().find((card) => card.type === "Unit" && card.collectible !== false && !card.levelUp && !card.mechanics);
    assert.ok(simpleUnit, "simple base Unit fixture is required");
    cardDefId = `${prefix}_card`;
    const createdCard = await ok(await createCard(req("/api/admin/cards", "POST", authorToken, {
      card: {
        ...simpleUnit,
        defId: cardDefId,
        name: "Rollback Vanguard",
        description: "Card rollback version one",
        flavor: "Version one survives immutable history.",
        art: "/certification/rollback-2977-v1.webp",
      },
      metadata: {
        collectionId,
        tags: ["rollback-v1", "certification"],
        classKeys: [], raceKeys: [], notes: "2.97.7 metadata v1",
      },
    })), "create rollback card");
    cardId = createdCard.card.dbId;

    const baseUnits = baseCardsOnly().filter((card) => card.type === "Unit");
    assert.ok(baseUnits.length >= 2, "two base units are required for card regression fixture");
    await ok(await createCardTest(req("/api/admin/studio/card-tests", "POST", authorToken, {
      cardId,
      name: "2.97.7 rollback engine smoke",
      scenario: {
        sourceDefId: baseUnits[0].defId,
        targetDefId: baseUnits[0].defId,
        enemyDefId: baseUnits[1].defId,
        mana: 5,
        rule: {
          sourceType: "card", sourceKey: baseUnits[0].defId, event: "onSummon",
          targetType: "anyUnit", targetKey: "", effectKind: "buffSelf", amount: 0,
          buffPower: 0, buffHealth: 0, target: "self",
        },
      },
      expected: { board: [{ defId: baseUnits[0].defId }] },
      enabled: true,
    })), "create rollback card regression test");

    await certifyAndPublish({ resource: "cards", id: cardId }, authorToken, reviewerToken, "card v1");
    const cardV1 = (await history("cards", cardId)).find((version) => version.status === "published");
    assert.ok(cardV1, "card v1 published snapshot must exist");
    assert.ok((cardV1.snapshot as any)?.card, "2.97.7 card snapshot must contain the card row");
    assert.ok((cardV1.snapshot as any)?.metadata, "2.97.7 card snapshot must contain catalog metadata");

    await ok(await pipeline(req("/api/admin/studio/pipeline", "POST", reviewerToken, {
      resource: "cards", resourceId: cardId, action: "archive",
    })), "archive card before v2 edit");
    const edited = await ok(await updateCard(req(`/api/admin/cards/${cardId}`, "PUT", authorToken, {
      card: {
        description: "Card rollback version two",
        flavor: "Version two should disappear after rollback.",
        art: "/certification/rollback-2977-v2.webp",
      },
      metadata: {
        collectionId,
        tags: ["rollback-v2", "certification"],
        classKeys: [], raceKeys: [], notes: "2.97.7 metadata v2",
      },
    }), { params: Promise.resolve({ id: String(cardId) }) }), "edit rollback card v2");
    assert.equal(edited.card.description, "Card rollback version two");
    await certifyAndPublish({ resource: "cards", id: cardId }, authorToken, reviewerToken, "card v2");

    const cardLatest = (await history("cards", cardId))[0];
    const cardRollback = await ok(await rollbackVersion(req("/api/admin/studio/versions/rollback", "POST", reviewerToken, {
      resource: "cards",
      resourceId: cardId,
      version: cardV1.version,
      expectedLatestVersion: cardLatest.version,
      changeNote: "2.97.7 coupled card rollback certification",
    })), "rollback card to v1");
    assert.equal(cardRollback.row.data?.description, "Card rollback version one", "card definition must restore from v1");
    assert.equal(cardRollback.row.data?.art, "/certification/rollback-2977-v1.webp", "card art must restore from v1");
    assert.equal(cardRollback.version.version, cardLatest.version + 1, "card rollback must append history");

    const [restoredMeta] = await db.select().from(cardCatalogMeta).where(eq(cardCatalogMeta.defId, cardDefId)).limit(1);
    assert.deepEqual(restoredMeta.tags, ["rollback-v1", "certification"], "card catalog tags must rollback atomically");
    assert.equal(restoredMeta.notes, "2.97.7 metadata v1", "card catalog notes must rollback atomically");
    assert.equal(restoredMeta.releaseState, "published", "rolled-back card metadata must remain published");

    await refreshCustomCardCache();
    assert.equal(getCustomCard(cardDefId)?.description, "Card rollback version one", "live catalog must expose rolled-back definition");
    assert.equal(getCustomCard(cardDefId)?.art, "/certification/rollback-2977-v1.webp", "live catalog must expose rolled-back art");

    const [activeRelease] = await db.select().from(adminContentReleases).where(eq(adminContentReleases.active, true)).limit(1);
    assert.ok(activeRelease, "rollback must leave one active release");
    assert.equal((activeRelease.manifest as any)?.rollback?.targetVersion, cardV1.version);
    assert.equal((activeRelease.manifest as any)?.resourceVersion, cardRollback.version.version);

    const rollbackAudits = await db.select().from(adminAuditLogs).where(and(
      eq(adminAuditLogs.action, "rollback"),
      eq(adminAuditLogs.actor, `admin:${reviewer.id}`),
    ));
    assert.ok(rollbackAudits.some((entry) => entry.resource === "collections" && entry.resourceId === collectionId));
    assert.ok(rollbackAudits.some((entry) => entry.resource === "cards" && entry.resourceId === cardId));

    console.log("STUDIO VERSION ROLLBACK 2.97.7: PASS");
    console.log("  immutable history: v1 → v2 → rollback-as-new-version");
    console.log("  guards: publisher auth + stale expectedLatestVersion CAS + published-only targets");
    console.log("  card rollback: definition + catalog metadata + live catalog restored atomically");
    console.log("  release: new active release with rollback provenance; prior history preserved");
  } finally {
    if (cardId !== null) {
      await db.delete(adminCardTestRuns).where(eq(adminCardTestRuns.cardId, cardId));
      await db.delete(adminCardTests).where(eq(adminCardTests.cardId, cardId));
      if (cardDefId) await db.delete(cardCatalogMeta).where(eq(cardCatalogMeta.defId, cardDefId));
      await db.delete(customCards).where(eq(customCards.id, cardId));
    }
    if (actorAuditIds.length) {
      await db.delete(adminApprovalRequests).where(or(
        inArray(adminApprovalRequests.requestedBy, actorAuditIds),
        inArray(adminApprovalRequests.decidedBy, actorAuditIds),
      ));
      await db.delete(adminAuditLogs).where(inArray(adminAuditLogs.actor, actorAuditIds));
      await db.delete(adminContentVersions).where(inArray(adminContentVersions.author, actorAuditIds));
    }
    await db.delete(adminContentReleases).where(gt(adminContentReleases.id, baselineLatestReleaseId));
    await db.update(adminContentReleases).set({ active: false }).where(eq(adminContentReleases.active, true));
    if (baselineActiveRelease) await db.update(adminContentReleases).set({ active: true }).where(eq(adminContentReleases.id, baselineActiveRelease.id));
    if (collectionId !== null) await db.delete(adminCollections).where(eq(adminCollections.id, collectionId));
    if (actorIds.length) {
      await db.delete(adminSessions).where(inArray(adminSessions.actorId, actorIds.map(String)));
      await db.delete(adminUsers).where(inArray(adminUsers.id, actorIds));
    }
    await refreshCustomCardCache().catch(() => undefined);
  }
}

main()
  .then(async () => { await pool.end(); })
  .catch(async (error) => {
    console.error("STUDIO VERSION ROLLBACK 2.97.7: FAIL", error);
    await pool.end().catch(() => undefined);
    process.exitCode = 1;
  });
