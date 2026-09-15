# Studio Visual Authoring 1.0

Status: candidate release bundled with **FORGED: THE CONVERGENCE** rebrand. The commercial name remains a candidate until legal/name clearance is complete.

## Goal

Let authorized Studio operators author card artwork and reusable card frames without editing gameplay code or rebuilding the application.

The system deliberately separates three concerns:

1. **Standard card art** — the canonical editorial art for a `defId`, published through Art Pipeline.
2. **Cosmetic printings** — optional alternate appearances for the same `defId` (full art, premium frame, foil, animated or serialized).
3. **Frame presets** — reusable presentation-only frame definitions referenced by cosmetic `frameId`.

No Visual Authoring payload may change cost, power, health, rules, keywords, region, gameplay rarity or any other authoritative gameplay field.

## Standard art workflow

Route: `/admin/studio/art`

- Designer/Admin may upload a validated image into Asset Library.
- Uploads are content-addressed by SHA-256 and validated by magic bytes rather than browser-provided MIME alone.
- Maximum upload size is 12 MB.
- Safe static images generate WebP and AVIF derivatives through Sharp; the original remains available as fallback.
- Art Pipeline exposes card-art coverage, asset selection, focus X/Y and zoom.
- Publishing the Standard runtime override requires Publisher/Admin.
- Published art is stored in card catalog metadata and reaches clients through `/api/catalog`; no rebuild is required.
- Clearing a Standard art override falls back to definition art, configured fallback or regional fallback according to the existing CardView chain.

## Cosmetic printing workflow

Route: `/admin/studio/cards` → **Cosmetics**

Each cosmetic printing keeps the same gameplay `defId` and can author:

- art URL or Asset Library image;
- direct image upload;
- focus X/Y and zoom (`artCrop`);
- frame preset (`frameId`);
- finish;
- animation URL where supported;
- edition and optional serialization;
- acquisition source and pack probability.

Draft creation is separate from publishing. Existing cosmetic APIs reject gameplay fields.

## Frame Builder

Route: `/admin/studio/frames`

Frame presets are stored in the generic Studio control plane (`admin_game_definitions`, domain `card-frame-presets`) rather than introducing a gameplay schema.

Editable presentation fields:

- primary, secondary and accent colors;
- border width;
- corner radius;
- glow intensity;
- inner-line opacity;
- art inset;
- nameplate opacity;
- foil/sheen intensity;
- gradient angle;
- material: Obsidian, Forged, Silver, Gold, Arcane, Organic;
- corner language: Round, Cut, Notch, Crown, Claw, Storm;
- ornament: None, Runes, Rivets, Roots, Waves, Lightning, Eclipse.

All values are normalized against finite whitelists/ranges. Color input is restricted to six-digit hex. Frame configuration does not accept arbitrary URLs or raw CSS.

### Lifecycle

`Draft → Published → Enabled`

- Designer may create and edit Draft presets.
- Publisher/Admin is required to change a live/published preset.
- Only Published presets may be Enabled.
- A preset referenced by a cosmetic printing is archived/disabled instead of being physically deleted.
- Every create/update/archive/delete transition is audit-logged and revisions are incremented.

## Runtime delivery

`/api/catalog` includes only frame presets that are both `published` and `enabled`.

`CatalogBootstrap`:

1. hydrates the safe frame preset registry;
2. compiles preset configuration to scoped `.card-shell.card-frame-<id>` rules;
3. mounts the generated rules in `#studio-card-frame-presets`;
4. bumps the catalog revision when frame definitions change.

`CardView` remains structurally decoupled from Frame Builder. It already consumes cosmetic classes through `cosmeticClassNames(appearance)`, including `card-frame-<frameId>`.

This means a Studio operator can change a published frame without a product rebuild while gameplay authority remains unchanged.

## Roles

| Operation | Designer | Publisher | Admin |
| --- | ---: | ---: | ---: |
| Upload validated image | Yes | Yes | Yes |
| Create/edit Draft frame | Yes | Yes | Yes |
| Create/edit Draft cosmetic | Existing Studio permission | Existing Studio permission | Yes |
| Publish Standard card art | No | Yes | Yes |
| Publish/enable frame | No | Yes | Yes |
| Publish/enable cosmetic printing | No | Yes | Yes |
| Archive live frame | No | Yes | Yes |

## Storage

Asset Library continues to use the existing storage abstraction:

- local development storage when configured;
- S3-compatible storage in production (`ASSET_STORAGE_MODE=s3`);
- hash-based object names;
- public asset base URL/CDN according to deployment configuration.

The database stores metadata/references, not image bytes.

## Regression and release evidence

Studio Visual Authoring 1.0 is protected by:

- `src/game/card-frame-presets.test.ts` — normalization, clamps, registry and safe CSS generation;
- `src/lib/studio-visual-authoring-regression.test.ts` — static API/UI/runtime/RBAC boundaries;
- `scripts/studio-visual-authoring-browser-cert.mjs` — real-browser evidence for Frame Builder, Card Visual Authoring and Art Pipeline;
- the normal source-contract, typecheck, lint, behavioral, build and browser E2E gates.

Expected browser artifacts:

- `41-studio-frame-builder.png`
- `42-studio-card-visual-authoring.png`
- `43-studio-art-pipeline.png`
- `studio-visual-authoring-manifest.json`

## Rollback boundary

No card/deck ID, engine rule, database gameplay schema or match record is renamed by this feature.

If the candidate commercial name changes before release, Studio Visual Authoring remains usable: its technical domains and data contracts are brand-neutral. Existing RuneForge technical identifiers may remain where changing them would create migration risk.
