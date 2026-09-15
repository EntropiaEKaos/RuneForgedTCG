# Alpha P0 Masters — Batch 1

## Production baseline

This batch starts from promoted production commit:

`d054b77c85420ba89da0a6b7495faacbed175df6`

The P0 production contract already certifies 21 missing high-exposure starter targets. This batch materializes only the first five masters so visual production can be reviewed in small, auditable increments.

## Batch 1

The five highest-exposure targets are:

1. `ember_bolt` — Emberhold — 5 starter slots / 2 starters
2. `wood_webweaver` — Ironwood — 5 starter slots / 2 starters
3. `tide_guard` — Tidecall — 4 starter slots / 2 starters
4. `wood_growth` — Ironwood — 4 starter slots / 2 starters
5. `wood_mend` — Ironwood — 4 starter slots / 2 starters

All masters inherit the certified Alpha art delivery contract:

- 4:5 aspect ratio;
- 1536×1920 master dimensions;
- WebP delivery;
- central focal-safe composition;
- regional palette and motif continuity with the Flagship art bible.

## Deterministic materialization

`scripts/generate-alpha-p0-batch-1-art.mjs` owns the authored vector compositions and deterministically materializes:

- `/art/cards/alpha-p0/emberhold/ember_bolt.webp`
- `/art/cards/alpha-p0/ironwood/wood_webweaver.webp`
- `/art/cards/alpha-p0/tidecall/tide_guard.webp`
- `/art/cards/alpha-p0/ironwood/wood_growth.webp`
- `/art/cards/alpha-p0/ironwood/wood_mend.webp`

`next.config.ts` runs the generator before Next resolves the public asset tree, matching the existing Flagship delivery architecture without committing generated binary masters to Git.

## Certification

`src/game/alpha-p0-batch-1-art.test.ts`:

- proves the batch is still the first five targets in certified P0 production order;
- executes the real generator;
- inspects each generated file through Sharp;
- requires WebP / 1536×1920 / single-frame output;
- creates `artifacts/alpha-visual/44-alpha-p0-batch-1-contact-sheet.png` for manual visual review.

The contact sheet is uploaded by the existing CI visual artifact step, so the five physical masters can be inspected before any runtime activation.

## Safety boundary

This batch **does not** wire Alpha P0 paths into `getCardArt()` and **does not** add the five IDs to the dedicated-art coverage set.

Therefore production coverage intentionally remains at the certified pre-activation baseline until a separate activation PR proves that the physical masters render correctly on real cards and updates coverage atomically.

No gameplay rules, card stats/effects, deck recipes, engine authority, IDs, economy, matchmaking, inventory or fallback behavior change in this batch.
