# Alpha P0 Batch 2 Runtime Activation

Production baseline: `5bbf3e2e0b3d74fd2c56cc5cf3a494e3fd23f60c`

## Scope

This change promotes the five physically certified Alpha P0 Batch 2 masters into runtime resolution:

- `ember_sprinter` — Blitzrunner
- `wood_ward` — Barkskin
- `ember_face` — Meteor Strike
- `ember_drake` — Kindle Drake
- `ember_stun` — Flame Lash

The masters were produced and certified separately before activation. Batch 2 therefore changes only the explicit active-art registry and the contracts/evidence derived from that registry.

## Runtime contract

`ALPHA_P0_ACTIVE_IDS` expands from the first five P0 production targets to the first ten targets in deterministic exposure order. `getCardArt()` already consumes `alphaP0ArtUrl()`, so only allowlisted masters resolve at runtime. Cosmetic and Admin/editorial art remain higher priority than built-in P0 masters.

The remaining eleven P0 production targets stay fail-closed and do not resolve a built-in P0 art URL.

## Coverage movement

The six teaching starters remain unchanged at 240 total slots and 140 unique cards.

- dedicated starter art: **35 → 40**
- starter cards without dedicated art: **105 → 100**
- P0 pending queue: **16 → 11**
- P1 pending: **46**
- P2 pending: **43**

No deck recipe, card ID, gameplay rule, stat, cost, effect, economy, inventory, matchmaking or engine authority changes.

## Certification

The activation is acceptable only when the exact PR head satisfies all normal workflows plus these Batch 2-specific contracts:

1. `alpha-p0-art.test.ts` proves exactly ten active masters, 40 covered starter cards, 100 missing and 11 P0 pending.
2. `alpha-p0-batch-1-art.test.ts` proves Batch 1 remains the first active slice and its physical masters remain valid.
3. `alpha-p0-batch-2-art.test.ts` proves Batch 2 exactly matches active positions 6–10, each target resolves its certified master, each leaves the P0 queue, and all physical files remain 1536×1920 WebP.
4. `flagship-art.test.ts` locks the deterministic production baseline at 40 covered / 100 backlog and verifies the next P0 queue starts with Florestia targets.
5. `alpha-p0-batch-2-browser-cert.mjs` requires all ten active P0 paths to be served as WebP by the built application and opens the real Codex art viewer for Blitzrunner.
6. Visual evidence `47-alpha-p0-ember-sprinter-art-viewer.png` must be manually inspected before merge.
7. Studio evidence must report 40 with art, 100 starter cards without art and 11 P0 pending.

Do not merge an activation head that has not passed exact-head workflow certification and manual browser-evidence review.
