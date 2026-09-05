# Portal CMS Control Plane 2.0

## Purpose

RuneForgedTCG is the authoritative administrative control plane for public SiteRuneForged content.

The portal must not maintain a second administrator database, a second role model, or a second publication workflow. Site content uses the existing RuneForge admin session, MFA, RBAC and audit infrastructure.

## Managed resources

The control plane currently exposes 16 resource families:

- `home`
- `navigation`
- `pages`
- `cards`
- `collections`
- `regions`
- `keywords`
- `rules`
- `lore`
- `news`
- `media`
- `seo`
- `alpha`
- `events`
- `promotions`
- `roadmap`

Each content identity is unique by `resource + slug + locale`.

## Lifecycle

Allowed states are:

`draft -> review -> published -> archived`

Edits never publish implicitly. A PUT can only save `draft` or `review`.
Publishing, archiving and rollback use dedicated actions.

Rollback creates a **new draft version** from an immutable historical snapshot. It never rewrites history.

## Optimistic concurrency

Every mutation requires `expectedVersion`.

- first creation requires `expectedVersion: 0`;
- subsequent edits/actions require the current positive version;
- a stale client receives HTTP `409` with `currentVersion`;
- the server also takes a PostgreSQL advisory transaction lock for the logical content identity;
- existing rows are additionally selected `FOR UPDATE`.

This protects both initial concurrent creation and later concurrent edits across application replicas.

## JSON bounds

- payload: object, maximum 256 KiB serialized UTF-8;
- SEO: object, maximum 64 KiB serialized UTF-8;
- locale: strict `xx` or `xx-YY`;
- default locale: `pt-BR`;
- slug: deterministic lowercase URL-safe normalized path, maximum 160 characters.

## RBAC

### admin

Full read/edit/publish/archive/rollback across all resources.

### publisher

Full read/edit/publish/archive/rollback across all resources.

### designer

Can author visual/editorial resources:

`home, navigation, pages, cards, collections, regions, keywords, rules, lore, media`

Cannot publish.

### qa

Can edit/read:

`cards, keywords, rules`

Cannot publish.

### liveops

Can edit/read:

`news, alpha, events, promotions, roadmap`

Can publish:

`news, alpha, events, promotions`

Roadmap publication remains publisher/admin controlled.

## Admin API

All admin routes require the existing RuneForge authorized admin session.

### List

`GET /api/admin/site/{resource}?locale=pt-BR`

Returns administrative rows for the selected resource/locale subject to RBAC.

### Read item + history

`GET /api/admin/site/{resource}/{slug}?locale=pt-BR`

Returns the current item and immutable version history.

### Create/update draft

`PUT /api/admin/site/{resource}/{slug}`

Example:

```json
{
  "locale": "pt-BR",
  "expectedVersion": 0,
  "status": "draft",
  "payload": {
    "title": "RuneForged Alpha",
    "body": "..."
  },
  "seo": {
    "title": "RuneForged",
    "description": "..."
  },
  "changeNote": "Initial portal draft"
}
```

For later edits, replace `expectedVersion: 0` with the latest version.

### Publish

`POST /api/admin/site/{resource}/{slug}/publish`

```json
{
  "locale": "pt-BR",
  "expectedVersion": 3,
  "changeNote": "Approved for public portal"
}
```

### Archive

`POST /api/admin/site/{resource}/{slug}/archive`

Uses the same `locale + expectedVersion + changeNote` contract.

### Rollback

`POST /api/admin/site/{resource}/{slug}/rollback/{historicalVersion}`

Rollback requires the current `expectedVersion`, restores the selected snapshot and creates a new draft version.

## Public API

Public routes expose **published content only** and never expose administrative history, actor identity, draft/review/archived rows or audit data.

### Public list

`GET /api/public/site/{resource}?locale=pt-BR`

### Public item

`GET /api/public/site/{resource}/{slug}?locale=pt-BR`

Returned fields are intentionally restricted to:

- slug
- locale
- payload
- seo
- version
- publishedAt

## Version and audit guarantees

Every create/update/publish/archive/rollback mutation:

1. runs in a database transaction;
2. obtains the logical advisory lock;
3. checks `expectedVersion`;
4. mutates the current row;
5. appends an immutable `site_content_versions` snapshot;
6. writes an `adminAuditLogs` entry.

## Database rollout

Migration:

`drizzle/0042_site_portal_cms.sql`

Fresh databases receive 0042 through `db:bootstrap`.

Existing supported databases receive 0042 through the canonical `db:upgrade` path, under the existing `runeforge-schema-upgrade` PostgreSQL advisory lock.

0042 is repair-safe for an earlier prototype deployment: tables/indexes use idempotent creation and the required CHECK/FK constraints are added if missing.

There is no parallel CMS migration system.

## SiteRuneForged integration

Recommended portal architecture:

1. the SiteRuneForged server/BFF authenticates administrative users against the existing RuneForge admin session flow;
2. the portal admin UI calls the RuneForge `/api/admin/site/...` endpoints server-side;
3. public pages consume `/api/public/site/...`;
4. public rendering falls back only according to an explicit portal policy — never to draft/admin data;
5. editors retain the current version returned by the server and send it back as `expectedVersion` on every mutation;
6. HTTP 409 triggers a refresh/conflict UI rather than silently overwriting another editor.

## CI contracts

The branch adds:

- behavioral policy coverage in `src/lib/site-content.test.ts`;
- source/authority coverage in `src/lib/site-content-api-regression.test.ts`;
- central API contract coverage;
- PostgreSQL runtime certification after an idempotent `db:upgrade`;
- fresh schema parity;
- semantic schema parity;
- bootstrap/upgrade inclusion.

The PostgreSQL runtime cert verifies the required CHECK/FK constraints, all CMS indexes, advisory-lock serialization, UNIQUE/CHECK enforcement and history cascade on a real PostgreSQL 17 service.

The CMS is not considered integrated until the full RuneForge CI and post-merge certification are green.
