# Alpha P1 Masters Batch 1

Production baseline: `65e9c33dcc902dfd48fca1a1a27cb6f82ef8e34d`

## Baseline

Alpha P0 is complete in production:

- 21/21 physical P0 masters active;
- 51 of 140 unique starter cards covered by dedicated art;
- 89 starter cards still without dedicated art;
- P0 pending: 0;
- P1 pending: 46;
- P2 pending: 43.

## Scope

This physical-only batch materializes the first five cards shown in the deterministic Studio P1 production queue. All five have two starter slots in one teaching deck and remain runtime-inactive in this PR.

1. `ember_duelist` — Ash Duelist — Emberhold
2. `ember_raider` — Ashfront Raider — Emberhold
3. `ember_herald` — Cinder Herald — Emberhold
4. `ember_whelp` — Cinder Whelp — Emberhold
5. `ember_zealot` — Emberfang Zealot — Emberhold

The Studio endpoint orders equal-exposure cards by score, region and player-facing card name. The physical contract reproduces that ordering instead of relying on the lower-level `defId` tie-break used by `alphaArtPriorityQueue()`.

## Physical master contract

Each master is generated deterministically as authored vector composition and delivered as:

- 4:5 master;
- 1536×1920;
- single-frame WebP;
- quality 88;
- path `/art/cards/alpha-p1/emberhold/<defId>.webp`.

The five compositions must remain visibly distinct:

- Ash Duelist — precise twin-blade single-combat stance;
- Ashfront Raider — diagonal low-camera charge with long polearm;
- Cinder Herald — upright standard/battlefield signal silhouette;
- Cinder Whelp — compact low forge-drake, dangerous juvenile rather than pet;
- Emberfang Zealot — broad frontal armored devotee with fang-shaped armor and ritual weapon.

Shared Emberhold direction remains obsidian, furnace orange, ember red, forged gold, basalt, sparks and forge smoke.

## Fail-closed runtime boundary

`ALPHA_P1_ACTIVE_IDS` remains empty in this PR.

The physical masters are generated before Next resolves `/public`, but they are **not** added to runtime art resolution or to `alpha-art-priority.ts`. Therefore this PR must leave the live Studio metrics unchanged:

- covered: 51;
- missing: 89;
- P0 pending: 0;
- P1 pending: 46;
- P2 pending: 43.

All five targets must still report `P1`, `knownDedicatedArt=false`, and `alphaP1ArtUrl(...) === undefined`. A separate activation PR is required before they can affect runtime resolution or coverage.

## Certification

`src/game/alpha-p1-batch-1-art.test.ts` must:

1. prove the live coverage snapshot remains 51 / 89 / 0 P0 / 46 P1 / 43 P2;
2. reproduce the Studio production ordering and prove these are its first five P1 cards;
3. prove the new P1 registry is inactive/fail-closed;
4. execute the real generator;
5. validate all five files as 1536×1920 single-frame WebP;
6. emit `artifacts/alpha-visual/53-alpha-p1-batch-1-contact-sheet.png`.

CI also reruns the physical contract after browser E2E so the contact sheet survives cleanup and enters the final artifact.

Do not merge until the exact PR head has all eight workflows green, the successful artifact digest is verified byte-for-byte, `53-alpha-p1-batch-1-contact-sheet.png` is manually reviewed, and the Studio evidence from the same run still shows 51 covered / 89 missing / 0 P0 pending with these five cards still marked P1 MISSING.

No card IDs, deck recipes, gameplay rules, stats, costs, effects, engine authority, economy, inventory, matchmaking or runtime art precedence change.
