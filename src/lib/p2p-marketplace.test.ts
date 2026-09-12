import assert from "node:assert/strict";
import { collectibleMatches, marketplaceFee, marketplaceNet, normalizeRequestedCollectibles, playerCanUseMarketplace, validateMarketPrice } from "./marketplace-policy";

function main() {
  assert.equal(marketplaceFee(100, 500), 5);
  assert.equal(marketplaceFee(99, 500), 4, "fees use deterministic floor rounding");
  assert.equal(marketplaceNet(100, 500), 95);
  assert.equal(marketplaceFee(100, -1), 0);
  assert.equal(marketplaceFee(100, 99_999), 50, "fee is defensively capped at 50%");

  assert.equal(validateMarketPrice(1, { minPriceGold: 1, maxPriceGold: 1000 }), true);
  assert.equal(validateMarketPrice(1000, { minPriceGold: 1, maxPriceGold: 1000 }), true);
  assert.equal(validateMarketPrice(0, { minPriceGold: 1, maxPriceGold: 1000 }), false);
  assert.equal(validateMarketPrice(1001, { minPriceGold: 1, maxPriceGold: 1000 }), false);
  assert.equal(validateMarketPrice(2.5, { minPriceGold: 1, maxPriceGold: 1000 }), true, "prices are integer Gold and normalize by truncation");

  const now = new Date("2026-09-12T12:00:00Z");
  const settings = { enabled: true, minPlayerLevel: 2, minAccountAgeHours: 24 };
  assert.equal(playerCanUseMarketplace({ level: 2, createdAt: new Date("2026-09-10T12:00:00Z") }, settings, now).ok, true);
  assert.equal(playerCanUseMarketplace({ level: 1, createdAt: new Date("2026-09-10T12:00:00Z") }, settings, now).ok, false);
  assert.equal(playerCanUseMarketplace({ level: 2, createdAt: new Date("2026-09-12T00:00:00Z") }, settings, now).ok, false);
  assert.equal(playerCanUseMarketplace({ level: 99, createdAt: new Date("2020-01-01T00:00:00Z") }, { ...settings, enabled: false }, now).ok, false);

  const requests = normalizeRequestedCollectibles([
    { defId: "void_imp" },
    { defId: "void_hexer", variantId: "eclipse", frameId: "obsidian", finish: "foil" },
  ], 5);
  assert.ok(requests);
  assert.equal(requests?.length, 2);
  assert.equal(normalizeRequestedCollectibles([], 5), null);
  assert.equal(normalizeRequestedCollectibles([{ defId: "a" }, { defId: "b" }], 1), null);
  assert.equal(normalizeRequestedCollectibles([{ nope: true }], 5), null);

  const asset = { defId: "void_hexer", variantId: "eclipse", frameId: "obsidian", finish: "foil" };
  assert.equal(collectibleMatches(asset, { defId: "void_hexer" }), true, "request may accept any cosmetic variant");
  assert.equal(collectibleMatches(asset, { defId: "void_hexer", finish: "foil" }), true);
  assert.equal(collectibleMatches(asset, { defId: "void_hexer", finish: "normal" }), false);
  assert.equal(collectibleMatches(asset, { defId: "void_imp" }), false);

  console.log("P2P MARKETPLACE POLICY: PASS");
}

main();
