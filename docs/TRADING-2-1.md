# RuneForge Trading 2.1 — Operations & Trust

Trading 2.1 hardens the certified Trading 2.0 authority instead of creating a parallel exchange system.

## Adds

- durable lifecycle events for created, accepted, declined, cancelled and expired offers;
- exact collectible snapshots preserved in event payloads, including serialized copies;
- automatic expiry events emitted by marketplace cleanup;
- status, direction and free-text filters across players, cards, printings and serials;
- player-facing activity timeline per trade;
- operational metrics: active, accepted, declined, cancelled, expired, acceptance rate and average resolution time;
- the existing escrow lock remains the double-spend barrier and the existing idempotency key remains the replay barrier.

## Authority boundary

No Gold is added to direct trades. Trading remains card-for-card. Gameplay card identity, deck legality, combat and pack gameplay selection remain unchanged.

## Migration

`drizzle/0048_trading_2_1.sql` creates `trade_offer_events`, backfills one lifecycle event for historical offers and records schema provenance as `2.97-trading-2.1`.

## Certification

Promotion requires the existing Marketplace PostgreSQL certification, full behavioral suite, build/browser E2E and Trading visual certification. Source-contract regression additionally requires the event table, filters, metrics and UI activity surface.
