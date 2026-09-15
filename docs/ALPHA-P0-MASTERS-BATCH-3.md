# Alpha P0 Masters — Batch 3

Production baseline: `66154b952a6f7f4f6090a082f3f54f58197d18ab`.

## Scope

This slice physically produces the next five pending Alpha P0 masters from the certified 21-card production contract, without activating them in runtime:

1. `forest_canopy_warden` — Florestia
2. `forest_cub` — Florestia
3. `storm_dashbolt` — Tempestade
4. `storm_eye` — Tempestade
5. `storm_herald` — Tempestade

They are positions 11–15 of `ALPHA_P0_ART_TARGETS`. The existing first ten active P0 masters remain the complete `ALPHA_P0_ACTIVE_IDS` allowlist in this PR.

## Delivery contract

- authored deterministic vector compositions;
- 4:5 master composition;
- 1536×1920 pixels;
- WebP delivery;
- regional Alpha/Flagship art direction;
- assets materialized under `/art/cards/alpha-p0/<region>/<defId>.webp` before Next resolves `/public`.

Generation is owned by `scripts/generate-alpha-p0-batch-3-art.mjs` and is deterministic so CI, development and production builds derive the same physical masters.

## Certification

`src/game/alpha-p0-batch-3-art.test.ts` must:

- bind the batch exactly to production-contract positions 11–15;
- prove all five targets remain outside `ALPHA_P0_ACTIVE_IDS`;
- prove `alphaP0ArtUrl()` remains fail-closed for all five;
- prove each target remains an uncovered live P0 item;
- execute the real generator;
- verify 1536×1920 single-frame WebP output through Sharp;
- emit `artifacts/alpha-visual/48-alpha-p0-batch-3-contact-sheet.png`.

CI regenerates this physical evidence after the browser E2E block and before artifact upload so the reviewed contact sheet belongs to the exact certified PR head.

## Safety boundary

This PR does **not** change:

- `ALPHA_P0_ACTIVE_IDS`;
- runtime card-art resolution;
- starter art coverage accounting;
- gameplay rules, stats, effects or costs;
- deck recipes or IDs;
- economy, inventory or matchmaking;
- authoritative engine behavior.

The live baseline must therefore remain **40/140 starter cards covered, 100 missing and 11 P0 pending**. These five masters may only become dedicated runtime art in a separate activation PR after the physical files and contact sheet have been certified and manually reviewed.

## Visual review gate

Do not merge this physical-production slice until the exact PR head has all required workflows green and `48-alpha-p0-batch-3-contact-sheet.png` has been manually inspected for rendering integrity, crop safety, target/region labels, distinct compositions and Florestia/Tempestade regional coherence.
