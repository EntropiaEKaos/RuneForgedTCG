import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { validateAuthorableCard } from "@/game/card-authoring";
import { strategicRoleForCard } from "@/game/card-role";
import { archetypeForCards, isArchetypeSignature } from "@/game/archetypes";
import { clearRegisteredCustomCards, registerCustomCards } from "@/game/custom-registry";
import { clearRegisteredCardCollections, CORE_COLLECTION, getCardCollection, registerCardCollections } from "@/game/card-collections";
import type { CardDef } from "@/game/types";

const root = process.cwd();
const source = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const authored = validateAuthorableCard({
  defId: "studio_41_test",
  name: "Studio 4.1 Test",
  region: "Voidborn",
  type: "Unit",
  rarity: "Epic",
  cost: 4,
  power: 4,
  health: 4,
  emoji: "◆",
  description: "Test card",
  trigger: { when: "onSummon", effect: { kind: "damageUnit", amount: 2, target: "enemyUnit" } },
  strategicRole: "defense",
  doctrineAffinities: ["void_shadow", "void_shadow", "unknown"],
});
assert.equal(authored.ok, true);
if (!authored.ok) throw new Error("authoring validation failed");
assert.equal(authored.card.strategicRole, "defense");
assert.deepEqual(authored.card.doctrineAffinities, ["void_shadow"]);
assert.equal(strategicRoleForCard(authored.card).id, "defense", "explicit role must override inference");

const inferred: CardDef = { ...authored.card, strategicRole: undefined };
assert.equal(strategicRoleForCard(inferred).id, "removal", "trigger removal must match Forge and CardView");

clearRegisteredCustomCards();
registerCustomCards([authored.card]);
const doctrine = archetypeForCards([authored.card.defId]);
assert.equal(doctrine?.deckId, "void_shadow");
assert.equal(Boolean(doctrine && isArchetypeSignature(authored.card.defId, doctrine)), true);
clearRegisteredCustomCards();

clearRegisteredCardCollections();
assert.equal(getCardCollection("ember_whelp")?.code, CORE_COLLECTION.code, "base cards need a core collection identity");
assert.equal(getCardCollection(authored.card.defId), null, "unassigned custom cards must not be mislabeled as core");
registerCardCollections([{ defId: authored.card.defId, id: 9, key: "eclipse", code: "ECL", name: "Eclipse", symbol: "☾" }]);
assert.equal(getCardCollection(authored.card.defId)?.name, "Eclipse");
clearRegisteredCardCollections();

const studio = source("src/app/admin/studio/cards/CardAuthoringStudio.tsx") + source("src/app/admin/studio/cards/CardAuthoringFields.tsx") + source("src/app/admin/studio/cards/useCardAuthoringModel.ts");
assert.match(studio, /Card Authoring Studio <span className="text-amber-300">4\.2/);
assert.match(studio, /<CardView defId=\{definition\.defId\} definition=\{definition\} collection=\{collection\}/);
assert.match(studio, /COLEÇÃO DE LANÇAMENTO/);
assert.match(studio, /Deck doctrine affinity/);

const catalog = source("src/app/api/catalog/route.ts");
assert.match(catalog, /cardCollections/);
assert.match(catalog, /innerJoin\(adminCollections/);
assert.match(catalog, /adminCollections\.status, "published"/);

const pipeline = source("src/lib/content-pipeline.ts");
assert.match(pipeline, /Card must be assigned to a published launch collection/);
assert.match(pipeline, /approvalSnapshot/);
const pipelineRoute = source("src/app/api/admin/studio/pipeline/route.ts");
assert.match(pipelineRoute, /if \(action === "qa"\)/);
assert.match(pipelineRoute, /contentHash\(approvalTarget\)/);
const metadataRoute = source("src/app/api/admin/studio/[resource]/[id]/route.ts");
assert.match(metadataRoute, /launch collection of a live card is immutable/);

console.log("CARD AUTHORING STUDIO 4.1 / COLLECTION IDENTITY 2.75: PASS");
