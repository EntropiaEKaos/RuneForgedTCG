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
  assert.match(migration, /2\.97-market-1\.0/, "marketplace schema provenance must be recorded");

  const market = read("src/app/api/market/route.ts");
  assert.match(market, /runIdempotentEconomyAction/, "market mutations must be idempotent");
  assert.match(market, /FOR UPDATE|\.for\("update"\)/, "market purchase must serialize ownership");
  assert.match(market, /market_purchase/, "buyer Gold movement must be written to the economy ledger");
  assert.match(market, /market_sale/, "seller Gold movement must be written to the economy ledger");
  assert.doesNotMatch(market, /currency:\s*["']dust["']/, "Dust must not be transferable through P2P sales");

  const trades = read("src/app/api/trades/route.ts");
  assert.match(trades, /cardAssetLocks/, "direct trades must escrow offered collectible copies");
  assert.match(trades, /duplicateCap/, "direct trades must preserve the collection copy cap");
  assert.doesNotMatch(trades, /proposerGold|recipientGold/, "Marketplace 1.0 direct trades are card-for-card only; Gold moves through sales");

  const marketClient = read("src/app/market/MarketClient.tsx");
  assert.match(marketClient, /\/api\/public\/game\/cards/, "direct trades must resolve requested cards from the safe public catalog");
  assert.match(marketClient, /Carta que você deseja receber/, "direct trade UI must expose a player-facing card picker");
  assert.doesNotMatch(marketClient, /placeholder=["']defId da carta desejada["']/, "players must never be asked for an internal card defId");

  const collection = read("src/app/api/collection/route.ts");
  assert.match(collection, /deleteUnlockedAssets/, "disenchant must refuse escrowed collectible copies");
  const packs = read("src/app/api/packs/route.ts");
  assert.match(packs, /createStandardAssets/, "pack openings must materialize per-copy collectible ownership");

  const admin = read("src/app/api/admin/marketplace/route.ts");
  assert.match(admin, /verifyAdminStepUp/, "economy configuration changes require admin step-up");
  assert.match(admin, /adminAuditLogs/, "economy configuration changes must be audited");

  const nav = read("src/components/SiteNav.tsx");
  assert.match(nav, /href:\s*["']\/market["']/, "player navigation must expose the market");

  console.log("P2P MARKETPLACE SOURCE CONTRACT: PASS");
}

main();
