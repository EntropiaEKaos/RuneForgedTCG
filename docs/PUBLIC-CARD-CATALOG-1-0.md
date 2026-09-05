# Public Card Catalog API 1.0

## Purpose

SiteRuneForged is deployed separately from the RuneForgedTCG runtime and must not import game source files or query the game database directly.

Public Card Catalog 1.0 provides a stable, read-only card projection for portal/catalog experiences without exposing internal engine contracts.

## Endpoint

`GET /api/public/game/cards`

Optional query parameters:

- `q` — text search across public card presentation fields;
- `region` — matches any region in the card identity;
- `type` — semantic display type or structural type;
- `rarity`;
- `collection` — collection key or code;
- `page` — one-based page;
- `pageSize` — 1..100, default 48.

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
- public collection identity.

The DTO intentionally does **not** expose authoritative execution objects such as:

- spell effect graphs;
- trigger contracts;
- mechanics ASTs;
- Sentinela ability objects;
- equipment/aura runtime definitions;
- admin metadata or audit state.

## Search and pagination

Results are sorted deterministically by display name then defId.

Page size is bounded to 100.

The response includes:

- `total`;
- `page`;
- `pageSize`;
- `totalPages`;
- `items`;
- facets for region, type, rarity and collection;
- a `catalogRevision` identifier.

## Caching

Successful responses use:

`Cache-Control: public, max-age=60, stale-while-revalidate=300`

Failures are `no-store`.

## Certification

The branch adds:

- behavioral DTO/filter/facet/pagination tests;
- fail-closed collection identity coverage;
- source-boundary tests preventing engine/admin projection;
- central API contract coverage;
- full repository CI as the merge gate.
