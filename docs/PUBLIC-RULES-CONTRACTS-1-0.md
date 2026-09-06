# Public Rules Contracts 1.0

## Purpose

Expose a small, stable, player-facing rules contract from the same engine vocabulary used by Card Studio and gameplay.

The public portal should not hard-code whether a card type uses regular mana, spell mana, the stack, the battlefield, main-only timing or reaction-only timing.

## Endpoint

`GET /api/public/game/rules/contracts`

The endpoint returns two groups:

- six structural engine card types from `CARD_TYPES`;
- three certified semantic gameplay types from `CERTIFIED_SEMANTIC_CARD_TYPES`.

## Public fields

Each contract contains only presentation/rules metadata:

- key and display name;
- structural vs semantic kind;
- structural base type;
- icon;
- zone (`battlefield`, `stack`, `equipment`);
- timing (`battlefield`, `speed-based`, `main-only`, `reaction-only`);
- mana family (`regular`, `spell`);
- persistence;
- whether the play counts as a spell cast;
- player-facing description;
- real public-card count.

## Safety boundary

The endpoint deliberately does **not** expose:

- `CardEffect` or effect contracts;
- target grammar;
- conditions;
- mechanic ASTs;
- authored behavior objects;
- trigger/effect payloads;
- admin or Studio metadata.

The portal can explain a rule without receiving executable engine grammar.

## Semantic authority

Estrutura, Ritual and Armadilha are projected directly from `CERTIFIED_SEMANTIC_CARD_TYPES`.

Their public name, base type, timing, mana and description therefore cannot drift from the gameplay contract without a test/build failure.

Current certified semantics:

- Estrutura — Artifact base, battlefield, regular mana, persistent, does not count as spell cast;
- Ritual — Spell base, main-only, spell mana, counts as spell cast;
- Armadilha — Spell base, reaction-only, spell mana, counts as spell cast.

## Public card counts

Counts use only cards that already pass Public Card Catalog collection/publication projection.

Semantic cards are counted under their semantic display type and do not inflate the plain structural display count. For example, Ritual and Armadilha do not inflate the public `Spell` card count.

## Availability semantics

Success:

`Cache-Control: public, max-age=60, stale-while-revalidate=300`

Runtime failure:

- HTTP 500;
- `ok: false`;
- `Cache-Control: no-store`.

## Portal composition

SiteRuneForged should compose these engine contracts with the existing Portal CMS `rules` editorial resource:

- engine owns structural facts;
- CMS owns tutorials, examples, article ordering and explanatory copy.

This keeps the rules experience administrable without creating a competing gameplay authority.
