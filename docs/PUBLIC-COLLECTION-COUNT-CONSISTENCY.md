# Public Collection Count Consistency

## Problem

The public `/api/collections` endpoint historically counted rows in `card_catalog_meta`.

That was sufficient through the 2.96 Vanilla migration floor (429 cards), but later code-authored waves are still public base cards and resolve to the canonical Vanilla identity through `getCardCollection`.

The public card catalog therefore could contain more Vanilla cards than the collection endpoint reported.

Current post-2.96 code-authored waves include at least:

- 18 Semantic Alpha cards;
- 10 Ecos do Abismo cards.

This brings the current code-authored base-definition floor to at least 457. Some historical base definitions are intentionally `collectible: false`, so the public collectible total is lower; the endpoint must count the actual collectible projection rather than either raw definition count or metadata rows.

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
- all 18 Semantic Alpha and 10 Ecos do Abismo cards remain collectible and flow into the public collection projection;
- the complete code-authored definition floor remains at least 457, while noncollectible definitions are correctly excluded from public counts.

Source-contract coverage prevents `/api/collections` from returning to a metadata-only `card_catalog_meta count(*)` implementation.


## Availability semantics

A successful query with zero published collections remains an authoritative `200` with `collections: []`.

A database/runtime failure is **not** converted into an empty public archive. It returns:

- HTTP 500;
- `ok: false`;
- `Cache-Control: no-store`.

Successful collection responses use `public, max-age=60, stale-while-revalidate=300`.

This allows SiteRuneForged to distinguish “nothing is published” from “the source of truth is temporarily unavailable”.


## Public metadata allowlist

`adminCollections.metadata` is an authoring/control-plane JSON object and is not returned wholesale by the public endpoint.

The only currently supported public metadata field is:

- `accentColor` — accepted only as a six-digit hex color (`#RRGGBB`).

This preserves the existing public Collections showcase styling without exposing arbitrary future Studio metadata fields.
