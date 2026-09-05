# Public Collection Count Consistency

## Problem

The public `/api/collections` endpoint historically counted rows in `card_catalog_meta`.

That was sufficient through the 2.96 Vanilla migration floor (429 cards), but later code-authored waves are still public base cards and resolve to the canonical Vanilla identity through `getCardCollection`.

The public card catalog therefore could contain more Vanilla cards than the collection endpoint reported.

Current post-2.96 code-authored waves include at least:

- 18 Semantic Alpha cards;
- 10 Ecos do Abismo cards.

This creates a current public base floor of at least 457 collectible definitions.

## Fix

`/api/collections` now:

1. warms the authoritative enabled custom-card cache;
2. reads `collectibleCards()`;
3. resolves every card through `getCardCollection`;
4. applies the same fail-closed public identity projection used by Public Card Catalog 1.0;
5. counts by public collection key.

This keeps collection card counts consistent with `/api/public/game/cards?collection={key}`.

## Regression

Behavioral coverage verifies:

- cards without public collection identity are not counted;
- current code-authored base cards remain included in canonical Vanilla;
- the current public base floor does not regress below 457.

Source-contract coverage prevents `/api/collections` from returning to a metadata-only `card_catalog_meta count(*)` implementation.


## Availability semantics

A successful query with zero published collections remains an authoritative `200` with `collections: []`.

A database/runtime failure is **not** converted into an empty public archive. It returns:

- HTTP 500;
- `ok: false`;
- `Cache-Control: no-store`.

Successful collection responses use `public, max-age=60, stale-while-revalidate=300`.

This allows SiteRuneForged to distinguish “nothing is published” from “the source of truth is temporarily unavailable”.
