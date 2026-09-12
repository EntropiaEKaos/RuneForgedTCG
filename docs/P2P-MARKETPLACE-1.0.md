# RuneForge P2P Marketplace 1.0

## Scope

Marketplace 1.0 adds two server-authoritative ways for players to exchange collectible cards:

1. **Gold marketplace** — a player lists one collectible copy for a whole-number Gold price and another player buys it instantly.
2. **Direct card trade** — a player escrows one or more collectible copies and requests one or more collectible card specifications from another player. The recipient accepts, declines, or lets the offer expire.

Gold is the only transferable currency in Marketplace 1.0. **Dust is never transferable.** Direct trades are card-for-card only. The system does not provide cash-out or any conversion from player-earned Gold to real money.

## Collectible ownership model

Gameplay ownership remains represented by `player_cards` so deck legality and existing collection flows stay compatible.

Marketplace ownership is represented by one `card_assets` row per collectible copy:

- `owner_player_id`
- `def_id`
- `variant_id`
- `frame_id`
- `finish`
- `tradable`
- acquisition source/time

This lets two copies with the same gameplay `def_id` have different collectible identities. Future alternate frames, foil finishes and premium variants can therefore trade at different prices without changing card rules.

Migration `drizzle/0043_p2p_marketplace.sql` materializes the legacy aggregate inventory into per-copy assets. The backfill is count-difference based and safe to replay after a partial upgrade.

## Escrow and anti-duplication

`card_asset_locks.asset_id` is the primary key. A collectible copy can therefore have only one escrow lock at a time across the entire P2P economy.

A locked asset cannot simultaneously be:

- listed twice;
- listed and offered in a direct trade;
- offered in two direct trades;
- disenchanted while a listing/trade is live.

Locks have an expiry timestamp. Expired listings/trades are finalized opportunistically by mutation paths and stale locks are removed before new operations.

`market_listings` also has a partial unique index preventing more than one active listing for the same asset.

## Atomic Gold sale

A purchase is one PostgreSQL transaction:

1. lock the listing;
2. reject expired/non-active/self purchases;
3. lock buyer and seller deterministically;
4. lock and verify the collectible owner;
5. verify the buyer will not exceed the collection duplicate cap;
6. debit the buyer only when sufficient Gold exists;
7. credit the seller with `price - fee`;
8. transfer the per-copy asset;
9. update aggregate `player_cards` ownership;
10. mark the listing sold and release escrow;
11. append buyer `market_purchase` and seller `market_sale` ledger rows.

The marketplace fee is a Gold sink. The default is 500 basis points (5%), calculated with deterministic floor rounding and snapshotted into the listing at creation time.

All economy mutations require `X-Operation-Id` and use the existing idempotent economy-action receipt system. Retrying an accepted request returns the stored result instead of duplicating the economic mutation.

## Direct card trades

The proposer identifies exact offered asset IDs. Those copies enter escrow at offer creation. Requested cards are stored as collectible specifications (`defId` plus optional variant/frame/finish constraints).

On acceptance the server:

- locks both players in deterministic order;
- verifies all offered copies still belong to the proposer and still have the expected escrow;
- chooses distinct, unlocked recipient assets satisfying each request;
- simulates aggregate count deltas for both players and rejects a trade that would exceed the duplicate cap;
- transfers every asset and every aggregate count inside one transaction;
- marks the offer accepted and releases escrow.

Only the recipient can accept/decline. Only the proposer can cancel.

## Pack and crafting integration

New retained copies from pack opening create a standard `card_assets` row in the same database transaction as `player_cards`.

Crafting also creates per-copy standard assets in the same transaction.

Disenchanting removes only unlocked assets. A player cannot obtain Dust from a copy that is currently in market/trade escrow.

## Player UI

`/market` exposes:

- public active listings;
- search by card/seller/variant/frame/finish;
- the player's collectible assets and escrow state;
- listing creation and cancellation;
- instant Gold purchase;
- the player's listing history;
- direct incoming/outgoing trades with accept/decline/cancel.

The global Forja navigation links to Mercado.

## Studio controls

`/admin/studio/marketplace` exposes marketplace telemetry and configurable policy:

- enable/disable marketplace;
- fee basis points;
- min/max Gold price;
- max active listings;
- listing/trade expiry windows;
- max cards per trade side;
- minimum player level;
- minimum account age.

Reads follow existing Studio RBAC. Economic policy changes require the full Admin role plus password/TOTP step-up and write a before/after `admin_audit_logs` entry.

## Database upgrade

Fresh database:

```bash
npm run db:bootstrap
```

Existing certified RuneForge database:

```bash
npm run db:upgrade
```

`db:upgrade` runs the canonical 2.31→2.97 upgrade path and then the idempotent Marketplace 1.0 migration under the shared schema advisory lock.

Do not enable a deployment against a database that has not applied `0043_p2p_marketplace.sql`.

## Certification

Marketplace is wired into the normal RuneForge release gates.

Static/behavior gates:

```bash
npm run audit:schema-static
npm run audit:source-contracts
npm run test:behavior
```

PostgreSQL integrity/concurrency gate:

```bash
npm run test:marketplace:postgres
```

HTTP/browser gate against a built running server:

```bash
npm run test:e2e:marketplace
```

The browser certification creates real player sessions, lists a card, launches two concurrent purchases of the same listing and requires **exactly one buyer** to win. It then verifies asset ownership, Gold balances, buyer/seller ledger rows, creates a direct card-for-card trade, verifies escrow, accepts it, and verifies both collectible owners were swapped atomically.

`npm run production:verify` includes the Marketplace PostgreSQL integrity check. Pull-request CI also runs the Marketplace browser certification in the same built-server E2E stage as the Alpha journey.

## Release boundary

Marketplace trades only RuneForge-internal collectible assets and RuneForge Gold. It is intentionally separate from Mercado Pago and does not make player Gold redeemable for money.

Live real-money commerce remains subject to its own release boundary and provider certification. Marketplace 1.0 must not be described or implemented as a real-money secondary market.

## Rollback

Application rollback is safe only if no Marketplace 1.0 transactions have been accepted after the rollback point. Once live players have sold or traded per-copy assets, deleting the marketplace schema would destroy provenance and is not a supported rollback.

Operational rollback after activation should therefore be:

1. set `marketplace_settings.enabled=false`;
2. deploy the previous compatible application only if it tolerates the added tables;
3. preserve all marketplace tables and ledger history;
4. repair forward with a new migration.

Never restore an old database snapshot independently of the economy ledger/ownership tables after P2P trading has started.
