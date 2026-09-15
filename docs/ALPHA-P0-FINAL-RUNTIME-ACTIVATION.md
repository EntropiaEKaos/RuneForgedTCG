# Alpha P0 Final Runtime Activation

Production baseline: `66ad3f8b8323f664c99f3c4c06302ba05e07f733`

## Scope

This change promotes the six remaining physically certified Alpha P0 masters into runtime resolution:

- `storm_lightning` — Tempestade
- `storm_sky_sentinel` — Tempestade
- `storm_strikecaller` — Tempestade
- `tide_sprite` — Tidecall
- `void_drain` — Voidborn
- `wood_cub` — Ironwood

Batches 4 and 5 were produced, exact-head certified and manually reviewed in separate physical-production pull requests before activation. `wood_cub` also received a manual art-direction correction before physical promotion so its Ironwood guardian identity remains distinct from Florestia `forest_cub`.

This activation does not create or replace physical masters. It expands the explicit runtime allowlist and updates the deterministic coverage, physical and browser contracts derived from that allowlist.

## Runtime contract

`ALPHA_P0_ACTIVE_IDS` expands from 15 to all 21 certified P0 production targets, preserving exact production order.

`getCardArt()` continues to consume `alphaP0ArtUrl()`, so the existing resolver precedence remains unchanged:

1. cosmetics;
2. Admin/editorial registered art;
3. certified Alpha P0 masters;
4. Flagship Champion;
5. Structure;
6. Ritual;
7. Trap;
8. starter signature;
9. regional fallback when no dedicated art resolves.

After this change no target in `ALPHA_P0_ART_TARGETS` remains fail-closed or pending P0.

## Coverage movement

The six teaching starters remain unchanged at 240 total slots and 140 unique cards.

- active P0 masters: **15 → 21**
- dedicated starter art: **45 → 51**
- starter cards without dedicated art: **95 → 89**
- P0 pending queue: **6 → 0**
- P1 pending: **46**
- P2 pending: **43**

No deck recipe, card ID, gameplay rule, stat, cost, effect, economy, inventory, matchmaking or engine authority changes.

## Certification

The activation is acceptable only when the exact PR head satisfies all normal workflows plus these final-P0 contracts:

1. `alpha-p0-art.test.ts` proves all 21 targets are active in exact production order, all resolve through runtime art, coverage is 51/140 and the P0 queue is empty.
2. Batch 1–3 physical tests continue proving their already-active slices and 1536×1920 WebP masters.
3. `alpha-p0-batch-4-art.test.ts` proves positions 16–20 are active, covered and still physically valid.
4. `alpha-p0-batch-5-art.test.ts` proves final target `wood_cub` is active, covered and still physically valid.
5. `flagship-art.test.ts` locks the deterministic production baseline at 51 covered / 89 backlog / 0 P0 pending, while P1 and P2 remain 46 and 43.
6. `alpha-p0-final-browser-cert.mjs` requires all 21 active P0 paths to be served as WebP by the built application and opens the real Codex art viewer for Thornback Cub.
7. Visual evidence `52-alpha-p0-wood-cub-art-viewer.png` must be manually inspected before merge for the corrected Ironwood master, correct title, no fallback and no overflow.
8. Studio evidence from the same exact-head run must report **51 with art, 89 starter cards without art and 0 P0 pending**.
9. The shared Chrome bootstrap contract must report 27 certified headless browser scripts.
10. Uploaded artifact digest must be verified byte-for-byte before promotion.

Do not merge an activation head that has not passed exact-head workflow certification, artifact digest verification and manual review of the runtime viewer and Studio coverage evidence.
