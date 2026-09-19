import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const migration = read("drizzle/0048_collectibles_four_player_runtime.sql");
const multiplayerSchema = read("src/db/schema/multiplayer.ts");
const fourPlayerSchema = read("src/db/schema/four-player.ts");
const rules = read("src/game/four-player-rules.ts");
const mode = read("src/game/four-player-mode.ts");
const deckRoute = read("src/app/api/decks/route.ts");
const deckIdRoute = read("src/app/api/decks/[id]/route.ts");
const marketplaceService = read("src/lib/marketplace-service.ts");
const campaignService = read("src/lib/collectible-campaign-service.ts");
const fourPlayerRoute = read("src/app/api/four-player/route.ts");
const fourPlayerRoomRoute = read("src/app/api/four-player/[code]/route.ts");
const feature = read("src/lib/four-player-feature.ts");
const fourPlayerUi = read("src/app/four-player/FourPlayerClient.tsx");

for (const table of [
  "deck_card_printing_preferences",
  "collectible_campaign_claims",
  "four_player_decks",
  "four_player_rooms",
  "four_player_seats",
  "four_player_action_receipts",
]) {
  assert.ok(migration.includes(`CREATE TABLE IF NOT EXISTS "${table}"`), `0048 must create ${table}`);
}

assert.ok(!multiplayerSchema.includes("fourPlayer"), "certified 1v1 multiplayer schema must not absorb 4P state");
assert.ok(fourPlayerSchema.includes('pgTable("four_player_rooms"'), "4P rooms must live in an isolated schema");
assert.ok(fourPlayerSchema.includes('pgTable("four_player_decks"'), "80+1 decks need dedicated persistence");
assert.ok(fourPlayerSchema.includes('jsonb("runtime_state")'), "authoritative 4P runtime state must stay server-side in the isolated room");

assert.ok(rules.includes("mainDeckCards: 80"), "4P v0 must keep 80 main-deck cards");
assert.ok(rules.includes("maxCopies: 2"), "4P v0 must keep the 2-copy cap");
assert.ok(rules.includes("startingLifeMultiplier: 1.5"), "4P v0 must use 150% starting life");
assert.ok(rules.includes("generalRecastTax: 2"), "General recast tax must remain +2");
assert.ok(rules.includes("firstPlayerSkipsFirstDraw: true"), "P1 must skip the first normal draw");
assert.ok(mode.includes("defenderSeat"), "multi-target combat must explicitly bind each attacker to a defender seat");
assert.ok(mode.includes("projectFourPlayerState"), "4P must project per-viewer hidden information");
assert.ok(mode.includes("opponent") === false || mode.includes("handCount"), "opponent secret identities must not be required by public projection");

assert.ok(deckRoute.includes("loadDeckPrintingPreferences"), "deck GET must hydrate exact printing preferences");
assert.ok(deckRoute.includes("replaceDeckPrintingPreferences"), "deck create must persist exact printing preferences");
assert.ok(deckIdRoute.includes("replaceDeckPrintingPreferences"), "deck update must persist exact printing preferences");
assert.ok(marketplaceService.includes("deckCardPrintingPreferences"), "asset transfer must clear deck-scoped printing pointers");

assert.ok(campaignService.includes("upgradeStandardAssetToCampaignVariant"), "campaign collectible claims must upgrade an owned Standard copy");
assert.ok(!campaignService.includes("insert(cardAssets)"), "campaign collectible claims must not mint extra gameplay copies");

assert.ok(feature.includes('process.env.FOUR_PLAYER_GENERAL_ENABLED === "true"'), "4P public runtime must fail closed behind an explicit feature flag");
assert.ok(!fourPlayerRoute.includes("pvpRooms"), "4P lobby must not reuse certified 1v1 pvp_rooms");
assert.ok(!fourPlayerRoomRoute.includes("pvpRooms"), "4P room lifecycle must not reuse certified 1v1 pvp_rooms");
assert.ok(fourPlayerRoomRoute.includes("fourPlayerActionReceipts"), "live 4P mutations must have idempotency receipts");
assert.ok(fourPlayerRoomRoute.includes('action === "start"'), "4P lobby must have an authoritative start transition");
assert.ok(fourPlayerUi.includes("Conselho dos Quatro"), "dedicated 4P player surface must exist");
assert.ok(fourPlayerUi.includes("relative(seat.seat)"), "4P table must rotate seats so the viewer is always presented from the bottom");

console.log("COLLECTIBLES + FOUR PLAYER RUNTIME CONTRACT: PASS");
