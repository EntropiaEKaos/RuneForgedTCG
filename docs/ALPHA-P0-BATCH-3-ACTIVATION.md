# Alpha P0 Batch 3 Runtime Activation

Production baseline: `326726d7e2189d5a186975a533bc6e22d2caec3d`

## Scope

This change promotes the five physically certified Alpha P0 Batch 3 masters into runtime resolution:

- `forest_canopy_warden` — Guardião da Copa
- `forest_cub` — Filhote Feroz
- `storm_dashbolt` — Dashbolt
- `storm_eye` — Olho da Tempestade
- `storm_herald` — Arauto da Tempestade

The masters were produced, exact-head certified and manually reviewed in the separate physical Batch 3 PR before activation. This change therefore only expands the explicit active-art registry and updates the contracts/evidence derived from that registry.

## Runtime contract

`ALPHA_P0_ACTIVE_IDS` expands from the first ten P0 production targets to the first fifteen targets in deterministic exposure order. `getCardArt()` continues to consume `alphaP0ArtUrl()`, so only allowlisted masters resolve at runtime. Cosmetic and Admin/editorial art remain higher priority than built-in P0 masters.

The remaining six P0 production targets stay fail-closed:

- `storm_lightning`
- `storm_sky_sentinel`
- `storm_strikecaller`
- `tide_sprite`
- `void_drain`
- `wood_cub`

## Coverage movement

The six teaching starters remain unchanged at 240 total slots and 140 unique cards.

- dedicated starter art: **40 → 45**
- starter cards without dedicated art: **100 → 95**
- P0 pending queue: **11 → 6**
- P1 pending: **46**
- P2 pending: **43**

No deck recipe, card ID, gameplay rule, stat, cost, effect, economy, inventory, matchmaking or engine authority changes.

## Certification

The activation is acceptable only when the exact PR head satisfies all normal workflows plus these Batch 3-specific contracts:

1. `alpha-p0-art.test.ts` proves exactly fifteen active masters, 45 covered starter cards, 95 missing and six P0 pending.
2. `alpha-p0-batch-1-art.test.ts` and `alpha-p0-batch-2-art.test.ts` prove their earlier active slices remain unchanged and physically valid.
3. `alpha-p0-batch-3-art.test.ts` proves Batch 3 exactly matches active positions 11–15, each target resolves its certified master, each leaves the P0 queue, and all five physical files remain 1536×1920 WebP.
4. `flagship-art.test.ts` locks the deterministic production baseline at 45 covered / 95 backlog and verifies the pending P0 queue is exactly the six remaining production targets.
5. `alpha-p0-batch-3-browser-cert.mjs` requires all fifteen active P0 paths to be served as WebP by the built application and opens the real Codex art viewer for Guardião da Copa.
6. Visual evidence `49-alpha-p0-forest-canopy-warden-art-viewer.png` must be manually inspected before merge.
7. Studio evidence from the same exact-head run must report **45 with art, 95 starter cards without art and 6 P0 pending**.
8. The shared Chrome bootstrap contract must report 26 certified headless browser scripts.

Do not merge an activation head that has not passed exact-head workflow certification, artifact digest verification and manual review of both the Batch 3 runtime viewer and Studio coverage evidence.
