# Brand Identity 1.0 — candidate foundation

## Status

This branch prepares a reversible product-brand transition while the commercial name is still undergoing legal clearance.

Current candidate presentation:

- primary display name: `FORGED`
- subtitle: `THE CONVERGENCE`
- full display name: `FORGED: THE CONVERGENCE`
- legacy product name: `RuneForge`

The candidate name is **not** treated as legally cleared by this document.

## Non-destructive migration rules

The rebrand must not alter gameplay authority or persistent game identity merely to match the public name.

Do not rename solely for branding:

- card definition IDs;
- deck IDs;
- match/replay identities;
- marketplace/order identities;
- player/account identifiers;
- database migration history;
- `runeforge_schema_meta` or historical schema artifacts;
- historical certification reports tied to older SHAs.

Legacy internal identifiers may remain indefinitely when renaming them adds migration risk without player-facing value.

## Public brand migration

Public-facing surfaces may transition to the candidate identity behind the isolated brand branch:

1. application metadata and browser title;
2. navigation/header wordmarks;
3. loading/splash/result screens;
4. card back and promotional surfaces;
5. collection/deck builder labels;
6. package-opening presentation;
7. public docs created after the commercial identity is approved.

`src/lib/product-brand.ts` is the canonical source for candidate display strings so the commercial identity can still be replaced without a repository-wide string rewrite.

## Player preference compatibility

Browser preferences written under the legacy `runeforge_*` prefix must not disappear after the rebrand.

The migration strategy is lazy and reversible:

- read the new branded key first;
- if absent, read the legacy key;
- copy a found legacy value into the new key;
- never delete the legacy key during Brand Identity 1.0.

Audio preferences are the first migrated settings in this foundation slice.

## Deployment compatibility

Deployment/runtime environment variables such as `RUNEFORGE_RELEASE`, `RUNEFORGE_DEPLOY_SHA`, `RUNEFORGE_DEPLOY_ENV`, `RUNEFORGE_BUILD_SHA` and `RUNEFORGE_BUILD_ENV` are operational contracts, not public branding.

They remain unchanged in Brand Identity 1.0. A later compatibility phase may introduce neutral aliases only if it can preserve existing Vercel/GitHub certification behavior exactly.

## Region Identity priority

Brand Identity 1.0 also reserves the next visual slice for the regional identity work already approved in product discussion:

- replace generic emoji-like region marks with proprietary official crests;
- the crest must remain recognizable at 16–24 px and scale to large promotional use;
- remove written region names from the compact card frame only after the new crests are legible enough to carry that information;
- keep full region names in tooltips, detail views, collection/deck builder filters and accessibility labels;
- let frame geometry/material reinforce the region independently of color.

Initial design direction:

- Emberhold: forged flame / split forge;
- Tidecall: tide spiral around a core;
- Ironwood: monumental trunk/root shield;
- Voidborn: broken eclipse / vertical void fissure;
- Florestia: claw/predator-moon language;
- Tempestade: storm spear / lightning crest.

## Convergence identity

Multiregion cards should not display unrelated region icons side by side as the final identity.

They should use a fused **Convergence crest**:

- dual-region cards fuse both regional geometries inside a convergence ring;
- tri-region cards use a three-arm convergence construction around a shared core;
- the full region names remain available in detail/hover surfaces;
- the compact card face may communicate multiregion identity through the fused crest alone once accessibility/legibility checks pass.

The first concept direction is Emberhold + Tempestade: forged flame/metal crossed by storm lightning inside a runic convergence ring.

## Brand Identity 1.3 — semantic/public surface audit

Brand Identity 1.3 extends the candidate identity across player-facing semantic surfaces while deliberately preserving technical and historical compatibility contracts.

The public-surface audit routes visible product naming through `PRODUCT_BRAND` for:

- PvP, Codex, Forge, Store and Modes metadata;
- Album, Draft, Ranked, Market and Profile metadata;
- Friends, Leaderboard, Collection, Collections calendar and Community metadata;
- replay and public-replay metadata;
- Admin and Super Admin Studio metadata;
- recovery-key explanatory copy and downloaded recovery-file branding.

The source contract rejects a regression that reintroduces `RuneForge` or `Runeforge` into this audited player-facing surface set. This does **not** authorize renaming deployment variables, schema history, repository paths, old certification documents or other technical compatibility identifiers.

### Battlefield card-art audit

A manual inspection of the notebook-density evidence initially made some injected rectangles look like production cards without artwork. They are not real cards.

`alpha-battlefield-notebook-stress-cert.mjs` intentionally creates synthetic `rf-v4-density-probe` elements to force local horizontal density in:

- the rival battlefield row;
- the player battlefield row;
- the player hand.

The fixture installs at least 38 synthetic nodes. They have no card definition, no `CardView`, no artwork and no rules content by design.

Brand Identity 1.3 marks those nodes visibly as `STRESS` probes in certification screenshots so they cannot be mistaken for broken game cards.

Real game cards remain protected by the `CardView` art contract:

- every real card exposes `data-card-art-source`;
- `.card-art` retains `backgroundImage: artBackground`;
- configured/editorial/definition/cosmetic art continues to resolve before fallback;
- the regional fallback remains available when dedicated art is absent.

The regression suite now asserts both the real-card art contract and the synthetic density-probe distinction.

## Related gameplay presentation priorities

This rebrand should align with, but not block, the future RuneForge/next-brand presentation work already identified:

- VFX profile system using S3/CDN assets;
- regional audiovisual signatures;
- faster action-flow presentation without delaying engine resolution;
- smart targeting and reduced dead time;
- premium hero moments reserved for high-value actions instead of every interaction.

These are separate implementation slices and should not be mixed into the first brand-foundation PR unless required for a shared contract.

## Merge boundary

This branch may be certified while Vercel production is rate-limited, but it must not be merged into `main` merely to trigger another deploy.

Before promotion:

1. legal/commercial naming direction is confirmed;
2. exact branch head passes repository CI;
3. visual branding changes receive manual screenshot review;
4. legacy preference compatibility is verified;
5. deployment contracts remain unchanged unless separately certified.
