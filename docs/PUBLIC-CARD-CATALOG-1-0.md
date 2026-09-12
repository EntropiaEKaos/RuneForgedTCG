# Public Card Catalog API 1.2 — Sentinela Public Abilities

## Purpose

SiteRuneForged is deployed separately from the RuneForgedTCG runtime and must not import game source files or query the game database directly.

Public Card Catalog 1.2 keeps the stable, read-only public projection from 1.1 and adds a safe presentation projection for Sentinelas. The endpoint still exposes presentation data only; no engine execution graph or admin state crosses the boundary.

## Endpoint

`GET /api/public/game/cards`

`GET /api/public/game/cards/{defId}` returns one public collectible card or 404.

Optional query parameters:

- `q` — text search across public card presentation fields, including public Sentinela ability descriptions;
- `region` — matches any region in the card identity;
- `type` — semantic display type or structural type;
- `rarity`;
- `collection` — collection key or code;
- `keyword` — built-in or custom public keyword;
- `race` — matches any public race identity;
- `class` — matches any public class identity;
- `minCost` — inclusive lower mana-cost boundary;
- `maxCost` — inclusive upper mana-cost boundary;
- `sort` — `name-asc` (default), `name-desc`, `cost-asc`, `cost-desc` or `power-desc`;
- `page` — one-based page;
- `pageSize` — 1..100, default 48.

Unknown sort values fail safe to deterministic name/defId ordering.

## Publication boundary

The endpoint:

1. loads the authoritative enabled custom-card cache;
2. reads collectible runtime cards;
3. resolves each card through the public collection identity;
4. excludes cards with no public collection identity;
5. projects a dedicated public DTO.

Base/code-authored cards resolve to their canonical collection identity. Enabled custom cards only obtain a collection identity when the cached assignment belongs to a published collection, so a custom card without a public launch collection fails closed.

## Public DTO

The portal may receive:

- defId;
- name;
- primary + multi-region identity;
- semantic display type + structural type;
- cost / power / health when applicable;
- keyword names;
- public rules description and flavor;
- rarity;
- races / classes;
- legend/champion flags;
- public art URL and emoji;
- strategic role / doctrine affinities;
- public collection identity;
- for Sentinelas only: starting loyalty plus a list of `{ cost, description }` ability summaries.

The DTO intentionally does **not** expose authoritative execution objects such as:

- spell effect graphs;
- trigger contracts;
- mechanics ASTs;
- Sentinela ability `effect` payloads or other executable ability state;
- equipment/aura runtime definitions;
- admin metadata or audit state.

This distinction is deliberate: players can read exactly what a Sentinela does, while the engine remains the only authority for how that text executes.

## Search, filters, facets and pagination

Results are filtered before pagination and then sorted deterministically according to the requested public sort mode.

Page size is bounded to 100.

The response includes:

- `total`;
- `page`;
- `pageSize`;
- `totalPages`;
- `items`;
- facets for region, type, rarity, collection, keyword, race, class and mana cost;
- a `catalogRevision` identifier.

Facets are calculated from the complete public catalog, not from one page, so the portal can build stable shareable filters.

## Caching

Successful responses use:

`Cache-Control: public, max-age=60, stale-while-revalidate=300`

Failures are `no-store`.

## Certification

Catalog 1.2 adds coverage for:

- starting loyalty and readable Sentinela ability summaries;
- explicit proof that Sentinela executable `effect` payloads remain private;
- text search across public Sentinela ability descriptions;
- race/class filters;
- inclusive min/max cost filters;
- deterministic sorting;
- race/class/cost facets;
- existing keyword, region, type, rarity and collection behavior;
- fail-closed public collection identity;
- bounded pagination;
- source-contract checks preventing internal engine/admin projection.
