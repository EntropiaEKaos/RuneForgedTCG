import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { and, desc, eq, gt, inArray, or } from "drizzle-orm";

import { db } from "@/db";
import {
  adminApprovalRequests,
  adminAuditLogs,
  adminCardArchetypes,
  adminCardTestRuns,
  adminCardTests,
  adminClasses,
  adminCollections,
  adminContentReleases,
  adminContentVersions,
  adminEffects,
  adminKeywords,
  adminRaces,
  adminSessions,
  adminUsers,
  cardCatalogMeta,
  customCards,
  customDecks,
  players,
} from "@/db/schema";
import { createAdminSession } from "@/lib/admin-auth";
import { hashAdminPassword } from "@/lib/admin-credentials";
import { POST as createCard } from "@/app/api/admin/cards/route";
import { PUT as updateCard } from "@/app/api/admin/cards/[id]/route";
import { POST as createResource } from "@/app/api/admin/studio/[resource]/route";
import { POST as pipeline } from "@/app/api/admin/studio/pipeline/route";
import { POST as requestApproval, PATCH as decideApproval } from "@/app/api/admin/studio/approvals/route";
import { POST as createCardTest, PATCH as runCardTests } from "@/app/api/admin/studio/card-tests/route";
import { GET as getCatalog } from "@/app/api/catalog/route";
import {
  CARD_REGIONS,
  CARD_TYPES,
  validateAuthorableCard,
} from "@/game/card-authoring";
import { baseCardsOnly } from "@/game/cards";
import {
  ensureCustomCardsLoaded,
  getCustomCard,
  refreshCustomCardCache,
} from "@/game/catalog";
import { createCustomGame } from "@/game/engine";
import { resolveDeck } from "@/game/deck-service";
import { loadGameConfig } from "@/game/settings";
import { sanitizeCompositeEffectDefinition, sanitizeKeywordBehavior } from "@/game/mechanics-authoring";

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

async function createStudioResource(resource: string, token: string, value: Json): Promise<Json> {
  return ok(
    await createResource(req(`/api/admin/studio/${resource}`, "POST", token, value), {
      params: Promise.resolve({ resource }),
    }),
    `create ${resource}`,
  );
}

async function certifyAndPublish(target: Target, requesterToken: string, reviewerToken: string): Promise<Json> {
  await ok(
    await pipeline(req("/api/admin/studio/pipeline", "POST", reviewerToken, {
      resource: target.resource,
      resourceId: target.id,
      action: "qa",
      changeNote: "2.97.6 functional certification QA",
    })),
    `QA ${target.resource}#${target.id}`,
  );

  for (const stage of ["content", "qa"] as const) {
    const requested = await ok(
      await requestApproval(req("/api/admin/studio/approvals", "POST", requesterToken, {
        resource: target.resource,
        resourceId: target.id,
        stage,
        note: "2.97.6 automated four-eyes certification",
      })),
      `request ${stage} approval ${target.resource}#${target.id}`,
    );
    await ok(
      await decideApproval(req("/api/admin/studio/approvals", "PATCH", reviewerToken, {
        id: requested.row.id,
        status: "approved",
        decisionNote: "Independent CI certification actor approved exact content hash",
      })),
      `approve ${stage} ${target.resource}#${target.id}`,
    );
  }

  return ok(
    await pipeline(req("/api/admin/studio/pipeline", "POST", reviewerToken, {
      resource: target.resource,
      resourceId: target.id,
      action: "publish",
      changeNote: "2.97.6 functional certification publish",
    })),
    `publish ${target.resource}#${target.id}`,
  );
}

function basicTypeProbe(type: string, defId: string) {
  const common: Json = {
    defId,
    name: `Certification ${type}`,
    region: "Emberhold",
    type,
    cost: 3,
    rarity: "Common",
    emoji: "🧪",
    description: `2.97.6 ${type} authoring probe`,
  };
  if (type === "Unit") Object.assign(common, { power: 3, health: 3 });
  if (type === "Spell") common.spell = { kind: "draw", amount: 1, target: "none" };
  if (type === "Sentinela") common.sentinela = {
    startingLoyalty: 3,
    abilities: [{ cost: 0, description: "Certification ability", effect: { kind: "draw", amount: 1, target: "none" } }],
  };
  return common;
}

async function main() {
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL is required");
  assert.ok(process.env.ADMIN_SESSION_SECRET, "ADMIN_SESSION_SECRET is required");

  const suffix = `${Date.now().toString(36)}_${process.pid.toString(36)}`;
  const prefix = `cert2976_${suffix}`.slice(0, 38);
  const actorUsernames = [`${prefix}_author`, `${prefix}_reviewer`];
  const actorIds: number[] = [];
  const actorAuditIds: string[] = [];
  const targets: Target[] = [];
  let cardId: number | null = null;
  let playerId: number | null = null;
  let deckId: number | null = null;

  const baselineActiveRelease = (await db.select().from(adminContentReleases)
    .where(eq(adminContentReleases.active, true)).orderBy(desc(adminContentReleases.id)).limit(1))[0] ?? null;
  const baselineLatestRelease = (await db.select({ id: adminContentReleases.id }).from(adminContentReleases)
    .orderBy(desc(adminContentReleases.id)).limit(1))[0]?.id ?? 0;

  try {
    const credentials = hashAdminPassword(`CI-${suffix}-admin-password-42!`);
    const [author, reviewer] = await db.insert(adminUsers).values([
      { username: actorUsernames[0], passwordSalt: credentials.salt, passwordHash: credentials.hash, role: "admin", enabled: true },
      { username: actorUsernames[1], passwordSalt: credentials.salt, passwordHash: credentials.hash, role: "admin", enabled: true },
    ]).returning();
    actorIds.push(author.id, reviewer.id);
    actorAuditIds.push(`admin:${author.id}`, `admin:${reviewer.id}`);
    const authorToken = await createAdminSession({ id: author.id, username: author.username, role: "admin" });
    const reviewerToken = await createAdminSession({ id: reviewer.id, username: reviewer.username, role: "admin" });

    // Canonical authoring surface: every structural type plus mono/dual/triple identities.
    for (const [index, type] of CARD_TYPES.entries()) {
      const validation = validateAuthorableCard(basicTypeProbe(type, `${prefix}_type_${index}`) as any);
      assert.equal(validation.ok, true, `${type} must remain authorable`);
    }
    for (const count of [1, 2, 3]) {
      const validation = validateAuthorableCard({
        ...basicTypeProbe("Unit", `${prefix}_regions_${count}`),
        regions: CARD_REGIONS.slice(0, count),
      } as any);
      assert.equal(validation.ok, true, `${count}-region identity must remain authorable`);
      if (validation.ok) assert.equal(new Set([validation.card.region, ...(validation.card.regions || [])]).size, count);
    }

    const collection = await createStudioResource("collections", authorToken, {
      key: `${prefix}_collection`, name: "Certification Collection", code: "C2976", symbol: "◇",
      description: "Transient production lifecycle collection",
    });
    targets.push({ resource: "collections", id: collection.row.id });
    await certifyAndPublish(targets.at(-1)!, authorToken, reviewerToken);

    const keywordBehavior = {
      version: 1,
      trigger: "onSummon",
      condition: { kind: "always" },
      effect: { kind: "buffSelf", amount: 0, target: "self", buffPower: 0, buffHealth: 0 },
    };
    assert.ok(sanitizeKeywordBehavior(keywordBehavior), "custom keyword behavior must compile");
    const keyword = await createStudioResource("keywords", authorToken, {
      key: `${prefix}_keyword`, name: "Certification Keyword", description: "Compiled custom mechanic",
      behavior: keywordBehavior,
    });
    targets.push({ resource: "keywords", id: keyword.row.id });
    await certifyAndPublish(targets.at(-1)!, authorToken, reviewerToken);

    const effectSchema = { version: 1, effect: { kind: "draw", amount: 1, target: "none" } };
    assert.ok(sanitizeCompositeEffectDefinition(effectSchema), "custom effect macro must compile");
    const effect = await createStudioResource("effects", authorToken, {
      key: `${prefix}_effect`, name: "Certification Effect", description: "Reusable composite macro",
      kind: "composite", schema: effectSchema,
    });
    targets.push({ resource: "effects", id: effect.row.id });
    await certifyAndPublish(targets.at(-1)!, authorToken, reviewerToken);

    const classRow = await createStudioResource("classes", authorToken, {
      key: `${prefix}_class`, name: "Certification Class", description: "Transient class reference",
    });
    targets.push({ resource: "classes", id: classRow.row.id });
    await certifyAndPublish(targets.at(-1)!, authorToken, reviewerToken);

    const raceRow = await createStudioResource("races", authorToken, {
      key: `${prefix}_race`, name: "Certification Race", description: "Transient race reference", region: "Emberhold",
    });
    targets.push({ resource: "races", id: raceRow.row.id });
    await certifyAndPublish(targets.at(-1)!, authorToken, reviewerToken);

    const archetype = await createStudioResource("archetypes", authorToken, {
      key: `${prefix}_archetype`, name: "Certification Vanguard", description: "Custom structural identity", baseType: "Unit", definition: {},
    });
    targets.push({ resource: "archetypes", id: archetype.row.id });
    await certifyAndPublish(targets.at(-1)!, authorToken, reviewerToken);

    const simpleUnit = baseCardsOnly().find((card) => card.type === "Unit" && card.collectible !== false && !card.levelUp && !card.mechanics);
    assert.ok(simpleUnit, "A simple base Unit fixture is required");
    const otherRegions = CARD_REGIONS.filter((region) => region !== simpleUnit.region).slice(0, 2);
    const allowedRegions = [simpleUnit.region, ...otherRegions];
    const cardDefId = `${prefix}_card`;
    const cardPayload: Json = {
      ...simpleUnit,
      defId: cardDefId,
      name: "Certification Triad Vanguard",
      description: "Published from Studio, resolved by catalog/deck-service and instantiated by engine.",
      regions: allowedRegions,
      regionalPerk: "convergence",
      art: "/certification/studio-2976-probe.webp",
      flavor: "A transient card that proves the production content path.",
      classes: [classRow.row.key],
      archetypeKey: archetype.row.key,
      archetypeName: archetype.row.name,
      customKeywords: [keyword.row.key],
      mechanics: [{
        key: keyword.row.key,
        name: keyword.row.name,
        trigger: keywordBehavior.trigger,
        condition: keywordBehavior.condition,
        effect: keywordBehavior.effect,
      }],
    };
    const preflight = validateAuthorableCard(cardPayload as any);
    assert.equal(preflight.ok, true, preflight.ok ? "" : preflight.error);

    const createdCard = await ok(await createCard(req("/api/admin/cards", "POST", authorToken, {
      card: cardPayload,
      metadata: {
        collectionId: collection.row.id,
        tags: ["certification", "studio-2976"],
        classKeys: [classRow.row.key],
        raceKeys: [raceRow.row.key],
        notes: "2.97.6 Studio functional certification fixture",
      },
    })), "create card");
    cardId = createdCard.card.dbId;
    targets.push({ resource: "cards", id: cardId! });

    const baseUnits = baseCardsOnly().filter((card) => card.type === "Unit");
    assert.ok(baseUnits.length >= 2, "Two base units are required for card regression fixture");
    await ok(await createCardTest(req("/api/admin/studio/card-tests", "POST", authorToken, {
      cardId,
      name: "2.97.6 deterministic engine smoke",
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
    })), "create card regression test");
    const testRun = await ok(await runCardTests(req("/api/admin/studio/card-tests", "PATCH", reviewerToken, { cardId })), "run card regression test");
    assert.equal(testRun.passed, true, "Card Studio regression case must execute successfully");

    await certifyAndPublish({ resource: "cards", id: cardId! }, authorToken, reviewerToken);
    await refreshCustomCardCache();
    await ensureCustomCardsLoaded();
    const published = getCustomCard(cardDefId);
    assert.ok(published, "published custom card must enter server catalog");
    assert.deepEqual(new Set([published!.region, ...(published!.regions || [])]), new Set(allowedRegions), "tri-region identity must survive persistence/publish");
    assert.equal(published!.art, cardPayload.art, "card art reference must survive publish");
    assert.deepEqual(published!.customKeywords, [keyword.row.key], "compiled custom keyword must survive publish");

    const catalogResponse = await getCatalog();
    const catalog = await ok(catalogResponse, "public catalog");
    assert.ok(catalog.custom.some((card: any) => card.defId === cardDefId), "public catalog must expose published custom card");
    const assignment = catalog.cardCollections.find((entry: any) => entry.defId === cardDefId);
    assert.equal(assignment?.id, collection.row.id, "public catalog must expose published launch collection assignment");

    const config = await loadGameConfig();
    const [player] = await db.insert(players).values({ name: `${prefix}_player` }).returning();
    playerId = player.id;
    const eligible = baseCardsOnly().filter((card) => {
      if (card.collectible === false) return false;
      const regions = new Set([card.region, ...(card.regions || [])]);
      return [...regions].every((region) => allowedRegions.includes(region));
    });
    const minDeck = config.deckMin;
    const maxCopies = config.maxCopies;
    const deckCards: string[] = [cardDefId];
    for (const candidate of eligible) {
      for (let copy = 0; copy < maxCopies && deckCards.length < minDeck; copy += 1) deckCards.push(candidate.defId);
      if (deckCards.length >= minDeck) break;
    }
    assert.equal(deckCards.length, minDeck, `Need enough compatible base cards to build ${minDeck}-card certification deck`);
    const [deck] = await db.insert(customDecks).values({
      ownerName: player.name,
      ownerPlayerId: player.id,
      name: "Studio Certification Deck",
      formatId: "eternal",
      cards: JSON.stringify(deckCards),
    }).returning();
    deckId = deck.id;

    const resolved = await resolveDeck(db, player.id, `custom_${deck.id}`);
    assert.ok(resolved, "authoritative deck-service must resolve persisted deck containing Studio card");
    assert.ok(resolved!.cards.includes(cardDefId), "resolved deck must retain Studio card");
    const game = createCustomGame("Studio Certification", resolved!, resolved!, {
      seed: 2976001,
      playerGoesFirst: true,
      skipMulligan: true,
      playerStartingHand: 0,
      aiStartingHand: 0,
      playerBench: [cardDefId],
    });
    assert.equal(game.players.player.bench[0]?.defId, cardDefId, "published Studio card must instantiate inside authoritative engine state");

    const blockedArchive = await rejected(await pipeline(req("/api/admin/studio/pipeline", "POST", reviewerToken, {
      resource: "cards", resourceId: cardId, action: "archive",
    })), 409, "archive with referenced deck must require impact acknowledgement");
    assert.ok(blockedArchive.requiredArchiveAcknowledgement, "archive impact gate must return exact acknowledgement");
    await ok(await pipeline(req("/api/admin/studio/pipeline", "POST", reviewerToken, {
      resource: "cards", resourceId: cardId, action: "archive",
      impactAcknowledgement: blockedArchive.requiredArchiveAcknowledgement,
    })), "archive card with explicit impact acknowledgement");
    await refreshCustomCardCache();
    assert.equal(getCustomCard(cardDefId), undefined, "archived card must leave live catalog");
    const [storedDeckAfterArchive] = await db.select().from(customDecks).where(eq(customDecks.id, deck.id)).limit(1);
    assert.ok(storedDeckAfterArchive, "archiving a card must not delete an existing player deck");
    assert.deepEqual(JSON.parse(storedDeckAfterArchive.cards), deckCards, "archive must not mutate stored deck contents");

    const editedDescription = `${cardPayload.description} Edited after archive.`;
    const edited = await ok(await updateCard(req(`/api/admin/cards/${cardId}`, "PUT", authorToken, {
      card: { description: editedDescription, flavor: "Edited, re-approved and republished by 2.97.6 certification." },
      metadata: {
        collectionId: collection.row.id,
        tags: ["certification", "studio-2976", "edited"],
        classKeys: [classRow.row.key],
        raceKeys: [raceRow.row.key],
        notes: "Edited archived card before republish",
      },
    }), { params: Promise.resolve({ id: String(cardId) }) }), "edit archived card");
    assert.equal(edited.card.description, editedDescription, "archived card must be editable");

    await certifyAndPublish({ resource: "cards", id: cardId! }, authorToken, reviewerToken);
    await refreshCustomCardCache();
    assert.equal(getCustomCard(cardDefId)?.description, editedDescription, "republished card must expose edited content");
    const resolvedAfterRepublish = await resolveDeck(db, player.id, `custom_${deck.id}`);
    assert.ok(resolvedAfterRepublish?.cards.includes(cardDefId), "stored deck must become valid again after approved republish without reconstruction");

    // Vanilla remains independently certified by its existing dedicated suites; assert its production identity still exists in the source/runtime catalog.
    assert.ok(baseCardsOnly().length >= 400, "base/Vanilla-scale catalog unexpectedly shrank");

    console.log("STUDIO FUNCTIONAL CERTIFICATION 2.97.6: PASS");
    console.log(`  pipeline resources: collection, keyword, composite effect, class, race, archetype, card`);
    console.log(`  authoring surface: ${CARD_TYPES.length} structural types + mono/dual/triple regions`);
    console.log("  lifecycle: create → QA → four-eyes approvals → publish → catalog → deck-service → engine → archive → edit → republish");
    console.log("  archive safety: referenced stored deck preserved and requires explicit impact acknowledgement");
  } finally {
    if (deckId !== null) await db.delete(customDecks).where(eq(customDecks.id, deckId));
    if (playerId !== null) await db.delete(players).where(eq(players.id, playerId));
    if (cardId !== null) {
      await db.delete(adminCardTestRuns).where(eq(adminCardTestRuns.cardId, cardId));
      await db.delete(adminCardTests).where(eq(adminCardTests.cardId, cardId));
      await db.delete(cardCatalogMeta).where(eq(cardCatalogMeta.defId, `${prefix}_card`));
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

    await db.delete(adminContentReleases).where(gt(adminContentReleases.id, baselineLatestRelease));
    await db.update(adminContentReleases).set({ active: false }).where(eq(adminContentReleases.active, true));
    if (baselineActiveRelease) await db.update(adminContentReleases).set({ active: true }).where(eq(adminContentReleases.id, baselineActiveRelease.id));

    const targetIds = new Map<string, number[]>();
    for (const target of targets) targetIds.set(target.resource, [...(targetIds.get(target.resource) || []), target.id]);
    const deleteIds = async (resource: string, table: any) => {
      const ids = targetIds.get(resource) || [];
      if (ids.length) await db.delete(table).where(inArray(table.id, ids));
    };
    await deleteIds("archetypes", adminCardArchetypes);
    await deleteIds("classes", adminClasses);
    await deleteIds("races", adminRaces);
    await deleteIds("effects", adminEffects);
    await deleteIds("keywords", adminKeywords);
    await deleteIds("collections", adminCollections);

    if (actorIds.length) {
      await db.delete(adminSessions).where(inArray(adminSessions.actorId, actorIds.map(String)));
      await db.delete(adminUsers).where(inArray(adminUsers.id, actorIds));
    }
    await refreshCustomCardCache().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error("STUDIO FUNCTIONAL CERTIFICATION 2.97.6: FAIL", error);
  process.exitCode = 1;
});
