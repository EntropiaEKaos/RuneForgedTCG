# Alpha Art Coverage Sprint 1

## Production baseline

This sprint branches from the promoted production commit:

`115f43fc8cbaac014acb95a2d40e61620b56ed45`

The production Art Pipeline reported 446 collectible catalog cards, 30 with dedicated managed/code art and 416 still relying on non-dedicated presentation/fallback paths. Runtime fallback remains valid; this sprint is about visual quality and exposure, not fixing blank cards.

## Starter exposure baseline

The six canonical teaching starters contain:

- 6 decks;
- 240 total deck slots;
- 140 unique cards;
- 30 unique cards already covered by the certified Flagship Art Set;
- 110 unique starter cards still without a known dedicated master at the static baseline.

The backlog is deterministic and split by exposure:

- **P0 — 21 cards:** shared by multiple starters or used in 3+ starter slots;
- **P1 — 46 cards:** used in 2 starter slots;
- **P2 — 43 cards:** used in 1 starter slot.

## P0 production batch

The first art-production batch is deliberately limited to the 21 highest-exposure missing starter cards:

1. `ember_bolt` — 5 slots / 2 starters
2. `wood_webweaver` — 5 slots / 2 starters
3. `tide_guard` — 4 slots / 2 starters
4. `wood_growth` — 4 slots / 2 starters
5. `wood_mend` — 4 slots / 2 starters
6. `ember_sprinter` — 3 slots / 2 starters
7. `wood_ward` — 3 slots / 2 starters
8. `ember_face` — 2 slots / 2 starters
9. `ember_drake` — 3 slots
10. `ember_stun` — 3 slots
11. `forest_canopy_warden` — 3 slots
12. `forest_cub` — 3 slots
13. `storm_dashbolt` — 3 slots
14. `storm_eye` — 3 slots
15. `storm_herald` — 3 slots
16. `storm_lightning` — 3 slots
17. `storm_sky_sentinel` — 3 slots
18. `storm_strikecaller` — 3 slots
19. `tide_sprite` — 3 slots
20. `void_drain` — 3 slots
21. `wood_cub` — 3 slots

Completing this batch would raise the static starter dedicated-art baseline from 30/140 to 51/140 unique cards, while targeting the highest repeated player exposure first. Global managed coverage is recalculated by the Studio at runtime and is not hard-coded as a release claim.

## Studio priority queue

`src/game/alpha-art-priority.ts` derives exposure directly from the canonical deck recipes and the existing Flagship Art roster. No parallel hand-maintained card list is used for the queue.

The Art Pipeline API enriches each catalog card with:

- starter slot count;
- number of starter decks containing the card;
- starter names;
- deterministic exposure score;
- P0/P1/P2/covered/backlog classification.

The Studio UI exposes filters for all starter cards, P0 production work, all missing art and the full catalog. It also shows starter-specific coverage and pending P0 counts.

## Safety boundary

This sprint does not change:

- game rules, stats, costs or effects;
- deck recipes;
- engine authority;
- card IDs;
- player inventory/economy;
- the art fallback chain;
- production `main` until a separately certified PR is promoted.

Priority metadata is content-production guidance only.
