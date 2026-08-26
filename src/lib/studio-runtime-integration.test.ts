import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createGame, makeUnit } from "@/game/engine";
import { allCards, getCard } from "@/game/cards";
import { clearRegisteredCustomCards, getRegisteredCustomCard, registerCustomCards, replaceRegisteredCustomCards, withRegisteredCardSnapshot } from "@/game/custom-registry";
import { clearRegisteredCardCollections, getCardCollection, registerCardCollections, replaceRegisteredCardCollections } from "@/game/card-collections";
import { validateAuthorableCard } from "@/game/card-authoring";
import type { CardDef } from "@/game/types";

const studioCard: CardDef = {
  defId: "studio_runtime_probe",
  name: "Sonda do Studio",
  region: "Tidecall",
  type: "Unit",
  cost: 2,
  power: 2,
  health: 3,
  race: "Sprite",
  keywords: ["Elusive"],
  description: "Carta de integração usada para provar Studio → runtime.",
  rarity: "Rare",
  emoji: "🧪",
  collectible: true,
  trigger: { when: "onSummon", effect: { kind: "draw", amount: 1, target: "none" } },
};

const validation = validateAuthorableCard(studioCard);
assert.equal(validation.ok, true, "Studio contract must accept the integration probe card");

// Browser/game registry path: /api/catalog -> replaceRegisteredCustomCards -> getCard/allCards/CardView.
clearRegisteredCustomCards();
replaceRegisteredCustomCards([studioCard]);
assert.equal(getRegisteredCustomCard(studioCard.defId)?.name, studioCard.name);
assert.equal(getCard(studioCard.defId).defId, studioCard.defId, "published custom card must resolve through the normal game catalog");
assert.ok(allCards().some((card) => card.defId === studioCard.defId), "published custom card must join allCards() consumers");

// Archived content must disappear on the next catalog refresh; merge-only behavior was a 2.91 gap.
replaceRegisteredCustomCards([]);
assert.equal(getRegisteredCustomCard(studioCard.defId), undefined, "archived card must not linger in the browser registry");

// Authoritative engine path: DB/cache snapshots resolve the same CardDef without special-case engine code.
withRegisteredCardSnapshot([studioCard], () => {
  const game = createGame(
    "Studio Tester",
    { id: "studio", name: "Studio deck", cards: [studioCard.defId] },
    { id: "ai", name: "AI", cards: ["ember_whelp"] },
    true,
    292,
  );
  const ids = [...game.players.player.hand.map((card) => card.defId), ...game.players.player.deck];
  assert.ok(ids.includes(studioCard.defId), "custom card must survive authoritative game creation");
  const unit = makeUnit(game, studioCard.defId, "player");
  assert.equal(unit.defId, studioCard.defId);
  assert.equal(unit.power, 2);
});

// Collection metadata follows the same hot replacement semantics.
clearRegisteredCardCollections();
registerCardCollections([{ defId: studioCard.defId, id: 1, key: "vanilla", code: "VAN", name: "Vanilla", symbol: "/art/collections/vanilla-symbol.png" }]);
assert.equal(getCardCollection(studioCard.defId)?.code, "VAN");
replaceRegisteredCardCollections([]);
assert.equal(getCardCollection(studioCard.defId), null, "archived custom card collection assignment must disappear on refresh");

// Integration wiring audit. These are structural sentinels complementing the behavioral registry/engine proof above.
const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), "utf8");
const publish = read("src/app/api/admin/studio/pipeline/route.ts");
const catalogApi = read("src/app/api/catalog/route.ts");
const bootstrap = read("src/components/CatalogBootstrap.tsx");
const collectionApi = read("src/app/api/collection/route.ts");
const draftApi = read("src/app/api/draft/route.ts");
const codex = read("src/app/codex/page.tsx");
const deckService = read("src/game/deck-service.ts");
assert.match(publish, /resource === "cards"\) await refreshCustomCardCache\(\)/, "publishing a card must refresh server runtime cache");
assert.match(publish, /releaseState: "published"/, "publishing a card must atomically publish its catalog metadata");
assert.match(publish, /releaseState: "archived"/, "archiving a card must archive its catalog metadata");
assert.match(catalogApi, /ensureCustomCardsLoaded\(\)/);
assert.match(catalogApi, /custom: listCustomCardsCached\(\)/);
assert.match(bootstrap, /replaceRegisteredCustomCards/);
assert.match(bootstrap, /15_000/, "client catalog must periodically discover newly published/archived cards without full reload");
for (const [name, source] of [["collection", collectionApi], ["draft", draftApi], ["codex", codex], ["deck-service", deckService]] as const) {
  assert.match(source, /ensureCustomCardsLoaded\(\)/, `${name} must warm the published custom-card catalog on cold server instances`);
}

clearRegisteredCustomCards();
clearRegisteredCardCollections();
console.log("STUDIO → GAME INTEGRATION: authoring, publish cache, browser hot-refresh, collection, draft, codex and authoritative engine paths verified");
