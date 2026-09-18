# FORGED — Pack Economy + Events

## Goal

Connect published Live Ops events and promotions to the existing authoritative pack economy without creating a second store, a second pack endpoint, or a client-side pricing rule.

## Authority flow

```
Control Plane pack definition
  -> getRuntimePacks()
  -> active published events/promotions
  -> effective PackDef
  -> GET /api/packs (display)
  -> POST /api/packs (buy/open)
```

The existing Visual 5.7 `StoreClient.tsx` and `/api/packs` authority remain byte-for-byte frozen. Both already consume `getRuntimePacks()`, so Live Ops is applied upstream.

## Event contract

An event may declare `rules.packEconomy` as one rule or a list of rules:

```json
{
  "packEconomy": [
    {
      "packIds": ["basic", "epic"],
      "discountPercent": 20,
      "bonusCards": 1,
      "guaranteedRarity": "Rare",
      "label": "Festival da Forja"
    }
  ]
}
```

## Promotion contract

A promotion may include a `pack_modifier` offer:

```json
{
  "type": "pack_modifier",
  "packIds": ["*"],
  "discountPercent": 15,
  "bonusCards": 1,
  "guaranteedRarity": "Epic"
}
```

## Safety limits

- `packIds`: 1–50 canonical IDs, or `"*"`.
- discount: integer 0–75%.
- bonus cards: integer 0–2.
- guarantee: Common / Rare / Epic / Legend.
- multiple active modifiers do **not** add together:
  - strongest discount wins;
  - highest bonus-card count wins;
  - highest rarity guarantee wins.
- a Live Ops guarantee can never downgrade the pack's native guarantee.
- drop-rate weights are never rewritten.
- collection identity is never rewritten.
- invalid modifiers are rejected by the Content Pipeline before publication and ignored by the runtime parser if malformed data somehow exists.

## Timing

Only content with `status=published` and inside its `startsAt/endsAt` window is applied. If Live Ops storage is unavailable, packs fail safe to their certified Control Plane definitions.

## Economy semantics

Discount applies when the pack is purchased. Bonus-card and guarantee modifiers apply when a pack is opened during the active window. Existing economy idempotency remains authoritative; retries with the same operation ID recover the already-settled result rather than purchasing/opening twice.

## Certification

- behavioral: `src/lib/pack-live-ops.test.ts`
- source authority: `src/lib/pack-live-ops-runtime-regression.test.ts`
- Visual 5.7 continues to enforce the frozen Store and pack-route blobs.
- normal CI / browser / RC gates remain required before promotion.
