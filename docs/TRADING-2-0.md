# RuneForge Trading 2.0

## Scope

Trading 2.0 deepens the existing server-authoritative P2P marketplace without creating a second economy or changing gameplay card identity.

The release extends direct card-for-card trades from a single-card client flow to a real multi-card collectible composer while preserving Marketplace 1.0 authority:

- up to `marketplace_settings.max_trade_cards_per_side` exact offered collectible copies;
- multiple requested collectible specifications;
- optional requested `variantId`, `frameId` and `finish`;
- exact serialized-copy requests through `serialNumber`;
- explicit no-Gold direct-trade boundary;
- listing fee/net preview using the current server policy;
- real browser evidence for the multi-card composer.

## Authority boundary

Trading 2.0 does **not** change card rules, deck legality, combat state, match state, card power, pack card-def selection or player Gold transfer semantics.

Gameplay ownership remains aggregate:

```
player_cards
  -> playerId + defId + count
```

Collectible identity remains per-copy:

```
card_assets
  -> exact owned copy
  -> variantId / frameId / finish / serialNumber
```

Direct-trade escrow remains:

```
card_asset_locks
  -> one lock per exact collectible asset
  -> kind = trade
  -> referenceId = trade_offers.id
```

The authoritative transaction remains inside `/api/trades`. The client only composes a request.

## Multi-card composer

The player-facing `/market` trade tab now allows both sides of an offer to be built explicitly.

### Offered side

Players select exact unlocked, tradable `card_assets` copies. The UI enforces the current server-provided `maxTradeCardsPerSide` limit before submission.

Every offered copy still enters escrow at offer creation. The server revalidates ownership and locks before accepting the offer.

### Requested side

Each requested slot starts with a gameplay `defId` selected from the public card catalog.

The player may then keep the request broad:

```
{ defId }
```

or constrain it to a collectible printing:

```
{ defId, variantId, frameId, finish }
```

For serialized printings, the player may additionally request one exact serial:

```
{ defId, variantId, frameId, finish, serialNumber }
```

A serial request is invalid unless an exact `variantId` is also supplied. This prevents an ambiguous serial number from being interpreted across different printings.

## Exact serial matching

`normalizeRequestedCollectibles` validates that requested serial numbers are positive safe integers and require a printing variant.

`collectibleMatches` now includes the serial constraint when one is present.

Acceptance still:

1. locks both players deterministically;
2. revalidates every offered copy and escrow row;
3. scans the recipient's unlocked tradable collectible copies;
4. chooses distinct copies satisfying each requested specification;
5. verifies duplicate-cap deltas;
6. transfers all assets and aggregate gameplay ownership atomically;
7. releases escrow only after the accepted transaction completes.

## No Gold in direct trades

Trading 2.0 deliberately preserves the Marketplace 1.0 boundary:

- Marketplace listings use RuneForge Gold.
- Direct trades are card-for-card.
- Dust is never transferable.
- No direct trade carries proposer Gold or recipient Gold.
- No player currency is redeemable for money through this system.

The player UI explicitly labels direct trades as **Sem Gold · carta por carta**.

## Listing economics preview

The inventory listing flow now reads the current marketplace policy returned by the server and previews:

- listing price;
- current sale fee;
- estimated seller net.

This is a presentation preview only. The authoritative fee remains calculated and snapshotted by the server when the listing is created.

## Certification

Trading 2.0 is protected at four layers.

### Policy/unit

`src/lib/p2p-marketplace.test.ts`

Certifies:

- serial request validation;
- variant requirement for serials;
- exact serial matching.

### Source authority

`src/lib/p2p-marketplace-regression.test.ts`

Certifies:

- multi-card composer state;
- server cards-per-side policy usage;
- printing/serial selectors;
- no-Gold direct-trade copy;
- listing fee/net preview;
- exact-serial backend matching;
- browser-cert wiring.

### Real transaction E2E

`scripts/p2p-marketplace-browser-cert.ts`

The certification creates a real 2×2 trade:

- proposer offers two exact collectible copies;
- recipient side must satisfy two requested cards;
- one requested card requires a specific variant/frame/finish and serial `#7`;
- both offered copies must enter escrow;
- all four assets must transfer to the correct owners;
- escrow must be empty after acceptance.

### Real browser visual evidence

`scripts/alpha-trading-2-visual-cert.mjs`

The browser certification opens `/market`, enters the direct-trade composer and proves:

- two exact offered copies remain selected;
- two requested cards remain composed;
- a published serialized printing can be selected;
- serial `#7` remains visible in the composer;
- the no-Gold boundary is visible;
- the page has no horizontal overflow or severe browser runtime errors.

Evidence:

```
61-trading-2-multicard-composer.png
trading-2-visual-manifest.json
```

The visual certification is part of the full CI browser gate and its evidence is uploaded inside the normal Alpha visual artifact.

## Release discipline

Trading 2.0 must be certified on its exact PR HEAD.

Required before merge:

1. source/schema audits;
2. behavior and coverage;
3. PostgreSQL marketplace/concurrency probes;
4. production build;
5. Marketplace browser E2E;
6. Trading 2.0 visual certification;
7. complete Alpha browser/E2E gate;
8. artifact digest/provenance verification;
9. manual inspection of the Trading 2.0 screenshot;
10. successful relevant PR workflow matrix.

After merge, the resulting `main` SHA must receive the normal full post-merge certification before it becomes the next development base.
