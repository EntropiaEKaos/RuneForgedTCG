# Public Keyword Codex 1.0

## Purpose

Expose RuneForge keyword rules to public consumers from the same sources that define gameplay.

The portal must not maintain a second hand-written keyword glossary that can drift from the engine.

## Endpoint

`GET /api/public/game/keywords`

The response combines:

1. the 20 canonical keywords from `CANONICAL_KEYWORDS` / `KEYWORD_INFO`;
2. enabled custom keywords from the Content Pipeline.

## Canonical public fields

Each public keyword contains:

- `key`;
- display `name`;
- public `description`;
- `icon`;
- `source` — `canonical` or `custom`;
- optional mapped `engineKeyword`;
- public runtime-domain labels for canonical/native-backed keywords;
- `grantable`;
- optional required trigger/timing;
- real `cardCount` based on the public collectible card projection.

## Custom keyword boundary

Only `admin_keywords.enabled = true` rows are considered published.

A custom keyword is public only when it either:

- maps to a canonical engine keyword; or
- compiles through `sanitizeKeywordBehavior`.

The implementation may inspect the authored behavior to validate it, but the public DTO never returns:

- behavior objects;
- conditions;
- effect graphs;
- arbitrary Studio/admin metadata.

For compiled custom keywords, only the public authored description and high-level trigger/timing are exposed.

## Card catalog integration

Public Card Catalog 1.0 gains:

- `keyword={key}` exact filter;
- keyword facets across canonical and custom keyword names.

Exact keyword filtering matches either `card.keywords` or `card.customKeywords`, case-insensitively.

This enables public routes such as:

`/cards?keyword=Flying`

without relying on fuzzy text search.

## Publication consistency

Keyword usage counts only include cards that pass the same public collection identity boundary as the public card catalog.

Therefore:

- private/unassigned custom cards do not inflate keyword counts;
- noncollectible runtime definitions do not appear;
- published custom cards with public collection identity do count.

## Cache / failure semantics

Success:

`Cache-Control: public, max-age=60, stale-while-revalidate=300`

Database/runtime failure:

- HTTP 500;
- `ok: false`;
- `Cache-Control: no-store`.

The endpoint does not silently drop all custom keywords and pretend the canonical-only response is complete during a database outage.

## Certification

The branch adds behavioral and source-contract coverage for:

- all 20 canonical keywords;
- runtime-domain/grantability contracts;
- Last Breath trigger contract;
- native-backed custom aliases;
- compiled custom keywords;
- invalid/disabled custom fail-closed behavior;
- real public card usage counts;
- exact keyword filtering/facets;
- no public projection of behavior/condition/effect internals.
