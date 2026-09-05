# Portal CMS Studio 2.1

## Goal

Portal CMS Studio 2.1 turns the Portal CMS 2.0 authority layer into an operator-facing workspace inside the existing RuneForge Studio.

The public portal remains a separate application in `EntropiaEKaos/SiteRuneForged`. RuneForgedTCG remains the only administrative authority for portal content, sessions, MFA, RBAC, version history and publication.

## Workspace

Route:

`/admin/studio/site`

The workspace exposes all 16 Portal CMS resources subject to the existing server-side role policy:

- home
- navigation
- pages
- cards
- collections
- regions
- keywords
- rules
- lore
- news
- media
- seo
- alpha
- events
- promotions
- roadmap

The Studio command palette exposes the workspace through a dedicated `site` UI capability. This capability only controls navigation visibility; the existing `/api/admin/site/...` routes remain authoritative for every read and mutation.

## Authoring lifecycle

Editors can:

1. select resource and locale;
2. create a draft with immutable slug identity;
3. edit payload and SEO JSON;
4. save as draft or review;
5. inspect immutable version history;
6. publish or archive when their role permits;
7. restore any historical version as a new draft when their role permits.

Every mutation sends the current `expectedVersion`.

A stale editor receives HTTP 409. The UI preserves the local JSON, displays the server version and requires an explicit reload instead of silently overwriting another editor.

## Published continuity

Portal CMS 2.0 originally stored the working draft and published state in the same current row. Saving a revision of a published item changed that row to `draft` or `review`, which meant the public API could temporarily stop returning the content.

2.1 closes that gap without adding a second mutable publication table.

Public reads now follow this contract:

- current `published` rows are returned directly;
- when the current row is `draft` or `review`, the latest immutable published snapshot remains public;
- an `archived` snapshot acts as a public tombstone;
- later draft or rollback work after an archive does not resurrect old content;
- content that has never been published remains private;
- a new explicit publish replaces the public snapshot.

The public projection reads only payload, SEO, version and publication timestamp from history. Administrative actor and change-note metadata are not selected by the public continuity helper.

## Rollback semantics

Rollback still creates a new draft version and never rewrites history.

If the item was live before the rollback, the last published snapshot remains live until the restored draft is explicitly republished.

If the item was archived before the rollback, the archive tombstone remains effective until an explicit new publish.

## SiteRuneForged integration

SiteRuneForged should consume only:

- `GET /api/public/site/{resource}`
- `GET /api/public/site/{resource}/{slug}`

The portal does not need an administrator database, a parallel publication model or direct database access.

## Certification

The 2.1 branch adds source contracts for:

- Studio route and command navigation;
- 16-resource workspace coverage;
- existing-role capability exposure;
- expected-version writes and 409 conflict handling;
- publish/archive/rollback actions;
- immutable version history;
- continuous public publication;
- archive tombstone behavior;
- public-history metadata minimization.

The full repository CI remains the merge gate.
