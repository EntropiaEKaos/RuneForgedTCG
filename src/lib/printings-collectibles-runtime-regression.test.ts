import assert from "node:assert/strict";
import fs from "node:fs";

function read(path: string) { return fs.readFileSync(path, "utf8"); }

function main() {
  const collectionApi = read("src/app/api/collection/route.ts");
  assert.match(collectionApi, /cardAssets/, "collection API must read per-copy collectible assets");
  assert.match(collectionApi, /playerCardCosmeticPreferences/, "collection API must expose the exact equipped collectible copy");
  assert.match(collectionApi, /specialCopies:/, "collection API must summarize special printings without changing gameplay ownership");
  assert.match(collectionApi, /serializedCopies:/, "collection API must summarize serialized copies");
  assert.match(collectionApi, /variants: Array\.from\(new Set/, "collection API must expose distinct visual printing identities");

  const collectionClient = read("src/app/collection/CollectionClient.tsx");
  assert.match(collectionClient, /label="Printing"/, "collection must allow filtering by printing state");
  assert.match(collectionClient, /Printings especiais/, "collection detail panel must surface special copies");
  assert.match(collectionClient, /href="\/collection\/variants"/, "collection must link to the exact-copy wardrobe");

  const bootstrap = read("src/components/CatalogBootstrap.tsx");
  assert.match(bootstrap, /fetch\("\/api\/player\/cosmetics"/, "global catalog bootstrap must hydrate player printing preferences");
  assert.match(bootstrap, /replacePlayerCardCosmeticPreferences\(data\.preferences\)/, "global presentation registry must receive exact-copy printing preferences");

  const forge = read("src/app/forge/ForgeClient.tsx");
  assert.match(forge, /<CardTip key=\{card\.defId\}/, "Deck Builder must render cards through the shared appearance-aware CardTip/CardView path");
  assert.match(forge, /body: JSON\.stringify\(\{ name, emoji, formatId, cards: list \}\)/, "Deck Builder persistence must remain gameplay-only defId lists");

  const packApi = read("src/app/api/packs/route.ts");
  assert.match(packApi, /createPackCollectibleAsset/, "pack opening must mint one collectible asset per retained card copy");
  assert.match(packApi, /mintedAssets/, "pack response must preserve exact printing identity");

  const studio = read("src/app/admin/studio/cards/CardCosmeticsTab.tsx");
  assert.match(studio, /\/api\/admin\/studio\/cosmetics/, "Studio must author cosmetic printing definitions through the certified API");

  const renderer = read("src/components/CardView.tsx");
  assert.match(renderer, /resolveCardAppearance\(def\.defId\)/, "shared renderer must resolve presentation outside gameplay state");
  assert.match(renderer, /data-card-variant=\{appearance\.variantId\}/, "rendered cards must expose visual printing identity");

  const gameplay = read("src/game/types.ts");
  assert.doesNotMatch(gameplay, /interface CardInstance[\s\S]{0,350}(variantId|frameId|finish|serialNumber|assetId)/, "CardInstance must remain free of collectible presentation identity");

  const market = read("src/db/schema/marketplace.ts");
  assert.match(market, /export const cardAssets/, "collectible ownership must remain per-copy and market-compatible");
  assert.match(market, /ownerPlayerId/, "collectible assets must remain owner-bound");

  console.log("printings & collectibles runtime regression passed");
}

main();
