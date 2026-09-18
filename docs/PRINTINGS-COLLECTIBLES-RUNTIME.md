# FORGED Cards — Printings & Collectibles Runtime

## Goal

Close the collectible presentation loop without creating a second gameplay identity for cards.

A gameplay card continues to be identified by `defId`. A collectible copy is identified by a `card_assets.id` and may carry a published `variantId`, `frameId`, `finish`, optional serial number and acquisition provenance.

## Runtime model

```
CardDef (defId)
  -> gameplay / rules / legality

card_assets (assetId)
  -> exact owned collectible copy
  -> variantId / frameId / finish / serialNumber / source

player_card_cosmetic_preferences
  -> exact owned asset selected for a defId

CardView
  -> resolves the selected appearance
  -> never mutates CardInstance
```

## Player flow

### Collection

`/api/collection` now returns a presentation-only `printings` summary for each gameplay definition:

- total per-copy assets;
- special copies;
- serialized copies;
- distinct variants;
- distinct frames;
- distinct finishes;
- exact equipped asset, when one exists.

`/collection` exposes filters for special, serialized and equipped printings and links directly to the Ateliê de Variantes.

### Ateliê de Variantes

`/collection/variants` remains the authority for selecting the exact owned visual copy. Equipping a variant persists an `assetId`, not a gameplay mutation.

### Deck Builder

Visual 5.8 keeps `ForgeClient.tsx` byte-for-byte frozen. The Deck Builder therefore inherits the selected collectible appearance through the already-certified global `CatalogBootstrap -> CardTip -> CardView` path instead of introducing a second Forge-specific preference loader.

Cards shown in the Forge resolve the same selected appearance as every other shared card surface, while deck persistence, validation, format legality, sharing and gameplay continue to use only `defId`. Printing selection remains centralized in the Ateliê de Variantes.

### Pack Opening

Pack card-definition selection remains independent from cosmetic minting. After a retained gameplay copy is selected, `createPackCollectibleAsset` mints the exact per-copy collectible asset and returns its presentation identity to the reveal UI.

### Studio

Card Studio continues to own creation and publication of cosmetic variants, frame assignment, finish, art, edition, serial limits, acquisition mode, pack eligibility and PPM drop weight. Gameplay fields remain forbidden in cosmetic payloads.

### Marketplace

The same `card_assets` rows are already the unit of listing, escrow and direct trade. No duplicate ownership model is introduced by this runtime pass.

## Authority boundary

The following remain invariant:

- `CardInstance` has no `assetId`, `variantId`, `frameId`, `finish` or `serialNumber`;
- deck validation receives arrays of `defId`;
- format legality remains definition-based;
- engine, reducer, replay and PvP authority do not consume collectible presentation identity;
- cosmetic rarity/prestige never changes gameplay rarity.

## Certification

The source-contract regression `src/lib/printings-collectibles-runtime-regression.test.ts` verifies the full cross-surface wiring and the authority boundary.

Promotion still requires the normal FORGED CI, browser E2E and visual certification gates for the exact PR head.
