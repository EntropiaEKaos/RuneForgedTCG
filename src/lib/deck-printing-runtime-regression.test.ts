import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const types = read("src/game/types.ts");
const deckService = read("src/game/deck-service.ts");
const state = read("src/game/engine/state.ts");
const cosmetics = read("src/game/card-cosmetics.ts");
const cardView = read("src/components/CardView.tsx");
const forge = read("src/app/forge/ForgeClient.tsx");
const marketplace = read("src/lib/marketplace-service.ts");

assert.ok(types.includes("interface DeckPrintingSnapshot"), "match types must carry a presentation-only printing snapshot");
assert.ok(types.includes("deckPrintings?: Record<string, DeckPrintingSnapshot>"), "PlayerState must preserve deck printing choices");
assert.ok(!types.match(/interface DeckPrintingSnapshot[\s\S]*?assetId/), "match printing snapshots must not expose database asset ids");

assert.ok(deckService.includes("loadDeckPrintingPreferences"), "authoritative deck resolver must load owned printing preferences");
assert.ok(deckService.includes("serialNumber: printing.serialNumber"), "serial identity must survive the match snapshot");
assert.ok(state.includes("deckPrintings: deck.printings ? structuredClone(deck.printings) : undefined"), "engine player state must capture immutable presentation choices");

assert.ok(cosmetics.includes("explicitSelection?: CardAppearanceSelection | null"), "appearance resolver must accept an immutable match selection");
assert.ok(cardView.includes("runtimePrinting"), "CardView must prefer match/deck presentation when supplied");
assert.ok(cardView.includes("appearance.artUrl || artAssignment?.url"), "cosmetic art must win over base/editorial art for the selected printing");

assert.ok(forge.includes("data-deck-printing-picker"), "Deck Builder must expose printing selection");
assert.ok(forge.includes("printings: Object.entries(printingByDef)"), "Deck Builder must persist selected exact assets");
assert.ok(marketplace.includes("deckCardPrintingPreferences"), "sale/trade must clear deck-scoped exact-asset pointers");

console.log("DECK PRINTING RUNTIME: PASS");
