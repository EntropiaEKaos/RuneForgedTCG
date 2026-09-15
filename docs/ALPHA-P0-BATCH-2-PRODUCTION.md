# Alpha P0 — Physical Masters Batch 2

Production baseline: `0131e763372b4e6587a5e2f5dcf7db62a4be43e2`.

## Scope

This batch materializes the next five physical masters in the certified 21-card Alpha P0 production contract:

1. `ember_sprinter` — Emberhold — Blitzrunner
2. `wood_ward` — Ironwood — Barkskin
3. `ember_face` — Emberhold — Meteor Strike
4. `ember_drake` — Emberhold — Kindle Drake
5. `ember_stun` — Emberhold — Flame Lash

The order follows `ALPHA_P0_ART_TARGETS.slice(5, 10)` and remains independent from runtime activation.

## Delivery contract

- 4:5 master composition;
- 1536 × 1920;
- WebP;
- deterministic generation under `/art/cards/alpha-p0/<region>/<defId>.webp`;
- focal content kept inside the central card-safe area;
- regional visual language inherited from the Flagship/Alpha art bible.

## Certification

`src/game/alpha-p0-batch-2-art.test.ts` must prove that all five targets:

- still belong to the pending P0 queue;
- are not present in `ALPHA_P0_ACTIVE_IDS`;
- remain unresolved by `alphaP0ArtUrl()`;
- are physically materialized as single-frame 1536 × 1920 WebP masters;
- produce `46-alpha-p0-batch-2-contact-sheet.png` for manual visual review.

The CI regenerates the Batch 2 evidence after browser E2E and before the final artifact upload so the evidence cannot be deleted by the visual-journey cleanup.

## Safety boundary

This PR is physical production only. It must not change starter coverage, runtime art resolution, gameplay rules, card stats, effects, costs, deck recipes, IDs, economy, inventory, matchmaking or engine authority.

Runtime activation belongs in a separate PR only after exact-head workflow certification and manual review of the Batch 2 contact sheet.
