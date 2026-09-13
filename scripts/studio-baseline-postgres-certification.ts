import assert from "node:assert/strict";
import { db } from "@/db";
import {
  adminClasses,
  adminCollections,
  adminEffects,
  adminKeywords,
  adminRaces,
  cardCatalogMeta,
} from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { buildStudioBaseline, syncStudioBaseline } from "@/lib/studio-baseline-sync";

async function main() {
  const baseline = buildStudioBaseline();

  const before = {
    keywords: (await db.select({ id: adminKeywords.id }).from(adminKeywords).where(inArray(adminKeywords.key, baseline.keywords.map((row) => row.key)))).length,
    effects: (await db.select({ id: adminEffects.id }).from(adminEffects).where(inArray(adminEffects.key, baseline.effects.map((row) => row.key)))).length,
    races: (await db.select({ id: adminRaces.id }).from(adminRaces).where(inArray(adminRaces.key, baseline.races.map((row) => row.key)))).length,
    classes: baseline.classes.length ? (await db.select({ id: adminClasses.id }).from(adminClasses).where(inArray(adminClasses.key, baseline.classes.map((row) => row.key)))).length : 0,
    cardMeta: (await db.select({ defId: cardCatalogMeta.defId }).from(cardCatalogMeta).where(inArray(cardCatalogMeta.defId, baseline.cards.map((card) => card.defId)))).length,
  };

  await syncStudioBaseline();
  const second = await syncStudioBaseline();

  const [vanilla] = await db.select().from(adminCollections).where(eq(adminCollections.key, "vanilla")).limit(1);
  assert.ok(vanilla, "Vanilla collection must exist after baseline sync");
  assert.equal(vanilla.status, "published", "Vanilla collection must be published");

  const after = {
    keywords: (await db.select({ id: adminKeywords.id }).from(adminKeywords).where(inArray(adminKeywords.key, baseline.keywords.map((row) => row.key)))).length,
    effects: (await db.select({ id: adminEffects.id }).from(adminEffects).where(inArray(adminEffects.key, baseline.effects.map((row) => row.key)))).length,
    races: (await db.select({ id: adminRaces.id }).from(adminRaces).where(inArray(adminRaces.key, baseline.races.map((row) => row.key)))).length,
    classes: baseline.classes.length ? (await db.select({ id: adminClasses.id }).from(adminClasses).where(inArray(adminClasses.key, baseline.classes.map((row) => row.key)))).length : 0,
    cardMeta: (await db.select({ defId: cardCatalogMeta.defId }).from(cardCatalogMeta).where(inArray(cardCatalogMeta.defId, baseline.cards.map((card) => card.defId)))).length,
  };

  assert.equal(after.keywords, baseline.keywords.length, "all canonical keywords must be visible in Studio");
  assert.equal(after.effects, baseline.effects.length, "all canonical effect primitives must be visible in Studio");
  assert.equal(after.races, baseline.races.length, "all canonical races must be visible in Studio");
  assert.equal(after.classes, baseline.classes.length, "all code-authored classes must be visible in Studio");
  assert.equal(after.cardMeta, baseline.cards.length, "all base cards must have Studio catalog metadata");
  assert.deepEqual(second.inserted, { keywords: 0, effects: 0, races: 0, classes: 0, collections: 0, cardMeta: 0 }, "second sync must be idempotent");

  for (const key of Object.keys(before) as (keyof typeof before)[]) {
    assert.ok(after[key] >= before[key], `${key} sync must never delete baseline content`);
  }

  console.log(`STUDIO BASELINE POSTGRES: PASS — ${after.keywords} keywords · ${after.effects} effects · ${after.races} races · ${after.classes} classes · ${after.cardMeta} base card metadata rows`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
