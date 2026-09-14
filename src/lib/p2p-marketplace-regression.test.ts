import assert from "node:assert/strict";
import fs from "node:fs";

function read(path: string) { return fs.readFileSync(path, "utf8"); }

function main() {
  const migration = read("drizzle/0043_p2p_marketplace.sql");
  for (const table of ["card_assets", "card_asset_locks", "market_listings", "marketplace_settings", "trade_offers"]) {
    assert.ok(migration.includes(`CREATE TABLE IF NOT EXISTS "${table}"`), `${table} must be part of the certified migration`);
  }
  assert.match(migration, /PRIMARY KEY REFERENCES "card_assets"\("id"\)/, "one escrow row per collectible asset must be enforced in PostgreSQL");
  assert.match(migration, /market_listings_active_asset_uidx/, "one active sale per collectible must be enforced in PostgreSQL");
  assert.match(migration, /"min_player_level" integer NOT NULL DEFAULT 2/, "fresh marketplace must not allow brand-new level-1 accounts to trade");
  assert.match(migration, /"min_account_age_hours" integer NOT NULL DEFAULT 24/, "fresh marketplace must impose an account-age barrier against disposable-account Gold funneling");
  assert.match(migration, /2\.97-market-1\.0/, "marketplace schema provenance must be recorded");

  const cosmeticsMigration = read("drizzle/0044_card_cosmetics.sql");
  for (const table of ["card_cosmetic_variants", "player_card_cosmetic_preferences"]) {
    assert.ok(cosmeticsMigration.includes(`CREATE TABLE IF NOT EXISTS "${table}"`), `${table} must be part of the cosmetic migration`);
  }
  assert.match(cosmeticsMigration, /ADD COLUMN IF NOT EXISTS "serial_number" integer/, "collectible assets must support exact serialized copy identity");
  assert.match(cosmeticsMigration, /card_assets_serial_uidx/, "serialized copies must be globally unique inside one printing");
  assert.match(cosmeticsMigration, /player_card_cosmetic_preferences_player_def_uidx/, "one equipped appearance per gameplay defId must be enforced");

  const marketSchema = read("src/db/schema/marketplace.ts");
  assert.match(marketSchema, /serialNumber: integer\("serial_number"\)/, "Drizzle collectible identity must include serial numbers");
  assert.match(marketSchema, /minPlayerLevel: integer\("min_player_level"\)\.notNull\(\)\.default\(2\)/, "Drizzle schema must preserve the conservative marketplace level default");
  assert.match(marketSchema, /minAccountAgeHours: integer\("min_account_age_hours"\)\.notNull\(\)\.default\(24\)/, "Drizzle schema must preserve the conservative marketplace account-age default");
  const cosmeticSchema = read("src/db/schema/cosmetics.ts");
  assert.match(cosmeticSchema, /cardCosmeticVariants/, "Drizzle schema must own cosmetic definitions separately from gameplay definitions");
  assert.match(cosmeticSchema, /playerCardCosmeticPreferences/, "Drizzle schema must persist exact-copy appearance preferences");

  const market = read("src/app/api/market/route.ts");
  assert.match(market, /playerCanUseMarketplace\(player, settings, now\)/, "marketplace reads must enforce the same level/account-age eligibility gate as mutations");
  assert.match(market, /runIdempotentEconomyAction/, "market mutations must be idempotent");
  assert.match(market, /FOR UPDATE|\.for\("update"\)/, "market purchase must serialize ownership");
  assert.match(market, /market_purchase/, "buyer Gold movement must be written to the economy ledger");
  assert.match(market, /market_sale/, "seller Gold movement must be written to the economy ledger");
  assert.match(market, /serialNumber: cardAssets\.serialNumber/, "marketplace DTOs must preserve serialized collectible identity");
  assert.match(market, /row\.serialNumber \?\? ""/, "market search must allow players to locate a known serial number");
  assert.doesNotMatch(market, /currency:\s*["']dust["']/, "Dust must not be transferable through P2P sales");

  const marketService = read("src/lib/marketplace-service.ts");
  assert.match(marketService, /playerCardCosmeticPreferences/, "asset transfer must know about exact-copy cosmetic preferences");
  assert.match(marketService, /eq\(playerCardCosmeticPreferences\.assetId, assetId\)/, "selling/trading an equipped asset must clear the previous owner's appearance preference");

  const trades = read("src/app/api/trades/route.ts");
  assert.match(trades, /playerCanUseMarketplace\(player, settings, now\)/, "trade reads must enforce the same level/account-age eligibility gate as trade mutations");
  assert.match(trades, /cardAssetLocks/, "direct trades must escrow offered collectible copies");
  assert.match(trades, /duplicateCap/, "direct trades must preserve the collection copy cap");
  assert.match(trades, /serialNumber: asset\.serialNumber/, "direct trade snapshots must preserve the exact offered serial number");
  assert.doesNotMatch(trades, /proposerGold|recipientGold/, "Marketplace 1.0 direct trades are card-for-card only; Gold moves through sales");

  const marketClient = read("src/app/market/MarketClient.tsx");
  assert.match(marketClient, /\/api\/public\/game\/cards/, "direct trades must resolve requested cards from the safe public catalog");
  assert.match(marketClient, /Carta que você deseja receber/, "direct trade UI must expose a player-facing card picker");
  assert.match(marketClient, /getCardCosmetic/, "marketplace labels must resolve player-facing cosmetic names instead of exposing only internal variant ids");
  assert.match(marketClient, /serialNumber/, "marketplace UI must surface serialized copy identity");
  assert.match(marketClient, /useCatalogRevision/, "marketplace cosmetic labels must refresh when the public cosmetic catalog hydrates");
  assert.doesNotMatch(marketClient, /placeholder=["']defId da carta desejada["']/, "players must never be asked for an internal card defId");

  const collection = read("src/app/api/collection/route.ts");
  assert.match(collection, /deleteUnlockedAssets/, "disenchant must refuse escrowed collectible copies");
  const packs = read("src/app/api/packs/route.ts");
  assert.match(packs, /createPackCollectibleAsset/, "pack openings must materialize a gameplay-equivalent collectible copy with an optional cosmetic printing");
  assert.match(packs, /const received: string\[\] = \[\]/, "pack gameplay card identities must still be selected independently of cosmetic minting");
  assert.match(packs, /cosmetics: result\.mintedAssets/, "pack response must expose pulled collectible appearances to the client without altering card rules");
  const storeClient = read("src/app/store/StoreClient.tsx");
  assert.match(storeClient, /setCosmeticPulls\(Array\.isArray\(data\.cosmetics\)/, "pack reveal must consume the authoritative cosmetic mint result");
  assert.match(storeClient, /PackCosmeticHighlights/, "pack reveal must visibly celebrate special cosmetic pulls");
  const packHighlights = read("src/app/store/PackCosmeticHighlights.tsx");
  assert.match(packHighlights, /variantId !== "standard"/, "pack reveal must celebrate only non-standard appearances");
  assert.match(packHighlights, /serialLimit/, "serialized pack reveals must show number and print-run limit when available");
  assert.match(packHighlights, /100% COSMÉTICO/, "pack reveal must communicate that rarity cosmetics do not change gameplay");
  const cosmeticService = read("src/lib/card-cosmetic-service.ts");
  assert.match(cosmeticService, /dropWeight is parts-per-million/, "cosmetic pack odds must have an explicit deterministic unit");
  assert.match(cosmeticService, /fall back to a normal gameplay copy/, "exhausted serialized runs must preserve the rolled gameplay card as Standard");

  const cosmeticRuntime = read("src/game/card-cosmetics.ts");
  for (const gameplayKey of ["cost", "power", "health", "keywords", "rarity", "mechanics"]) {
    assert.match(cosmeticRuntime, new RegExp(`\\"${gameplayKey}\\"`), `${gameplayKey} must be explicitly forbidden in cosmetic payloads`);
  }
  assert.match(cosmeticRuntime, /variantId: "standard"/, "runtime must fail closed to the implicit Standard appearance");

  const cardView = read("src/components/CardView.tsx");
  assert.match(cardView, /resolveCardAppearance\(def\.defId\)/, "shared CardView must resolve player appearance outside authoritative engine state");
  assert.match(cardView, /data-card-variant=\{appearance\.variantId\}/, "renderer must expose printing identity for visual/browser certification");
  assert.match(cardView, /appearance\.serialNumber/, "renderer must surface exact serialized copy identity");
  assert.doesNotMatch(read("src/game/types.ts"), /interface CardInstance[\s\S]{0,300}(variantId|frameId|finish|serialNumber)/, "authoritative CardInstance must remain cosmetic-free");

  const studioApi = read("src/app/api/admin/studio/cosmetics/route.ts");
  assert.match(studioApi, /Publisher role required to change a live cosmetic/, "live cosmetic publication must remain publisher-gated");
  assert.match(studioApi, /exceed 1,000,000 PPM/, "Studio must reject cosmetic pack pools above 100%");
  assert.match(studioApi, /cardExistsForCosmeticAuthoring/, "cosmetic drafts must validate persisted authoring identity separately from runtime publication");
  assert.match(studioApi, /baseCardsOnly\(\)/, "base cards must remain valid cosmetic authoring targets");
  assert.match(studioApi, /customCards\.defId/, "saved custom-card drafts must be valid cosmetic authoring targets before gameplay publication");
  assert.doesNotMatch(studioApi, /allCards\(\)/, "cosmetic draft authoring must not require a card to be runtime-enabled");
  const studio = read("src/app/admin/studio/cards/CardAuthoringStudio.tsx");
  assert.match(studio, /CardCosmeticsTab/, "Card Studio must own cosmetic authoring as an extension, not a parallel admin tool");
  const wardrobe = read("src/app/collection/variants/CosmeticWardrobeClient.tsx");
  assert.match(wardrobe, /USAR ESTA VERSÃO/, "player collection must expose owned cosmetic selection");
  assert.match(wardrobe, /100% cosmético/, "player UI must communicate gameplay neutrality");

  const admin = read("src/app/api/admin/marketplace/route.ts");
  assert.match(admin, /verifyAdminStepUp/, "economy configuration changes require admin step-up");
  assert.match(admin, /adminAuditLogs/, "economy configuration changes must be audited");

  const nav = read("src/components/SiteNav.tsx");
  assert.match(nav, /href:\s*["']\/market["']/, "player navigation must expose the market");

  console.log("P2P MARKETPLACE + COSMETICS SOURCE CONTRACT: PASS");
}

main();