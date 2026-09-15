# Alpha Art P0 Production Sprint

## Baseline

This sprint starts from promoted production `3a530bf383e284b570cac1d71bf9fb4e73c2bac5`, after Alpha Art Coverage Sprint 1 was certified 8/8 and merged.

The Studio production queue reports:

- 140 unique cards across the six teaching starters;
- 30 already covered by dedicated Flagship masters;
- 110 still without dedicated art;
- 21 highest-exposure cards in P0.

## Goal

Prepare the 21-card P0 batch as a deterministic production contract before any new art is activated in runtime.

This phase intentionally separates **production intent** from **installed art**. Merely reserving a path or writing a brief must never make Studio coverage increase.

## Master format

The P0 batch inherits the certified Flagship master contract:

- aspect ratio: 4:5;
- master size: 1536 × 1920;
- delivery: WebP;
- composition safe zone: keep faces, focal silhouettes and critical props inside the central 70%;
- visual language: use each region's existing Flagship style bible.

Target root:

`/art/cards/alpha-p0/<region>/<defId>.webp`

## Production order

1. `ember_bolt`
2. `wood_webweaver`
3. `tide_guard`
4. `wood_growth`
5. `wood_mend`
6. `ember_sprinter`
7. `wood_ward`
8. `ember_face`
9. `ember_drake`
10. `ember_stun`
11. `forest_canopy_warden`
12. `forest_cub`
13. `storm_dashbolt`
14. `storm_eye`
15. `storm_herald`
16. `storm_lightning`
17. `storm_sky_sentinel`
18. `storm_strikecaller`
19. `tide_sprite`
20. `void_drain`
21. `wood_cub`

The order mirrors the deterministic exposure score: shared starter cards first, then repeated single-starter cards.

## Runtime activation rule

`src/game/alpha-p0-art.ts` is a production manifest only.

Do **not** wire its target paths into `getCardArt()` until the corresponding files are physically present and certified. Activation must happen in a separate certified change that verifies file existence, dimensions, format and browser rendering.

This prevents false coverage and preserves the current fallback chain throughout production.

## Certification contract

`src/game/alpha-p0-art.test.ts` must prove:

- exactly 21 target IDs;
- no duplicates;
- exact set equality with the live deterministic P0 queue;
- every target still resolves to P0 and `knownDedicatedArt=false` before activation;
- target paths are deterministic and regional;
- master format stays aligned with the certified Flagship format;
- every target carries a non-trivial production brief.

## Safety boundary

This sprint does not change gameplay, deck recipes, IDs, economy, matchmaking, rules, card stats, effects, fallback behavior or reported art coverage.

The next phase is the actual master-art delivery and visual review, followed by a separate activation PR only after all 21 files pass asset and browser certification.
