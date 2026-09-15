# Alpha P0 Masters — Batch 5

## Production base

This physical production batch starts from promoted production commit:

`6646ae50a5e9ef8cece0fd05aa31ad210daef03a`

## Scope

Batch 5 materializes the final target in the certified 21-master Alpha P0 production contract:

- `wood_cub` — Ironwood
- asset: `/art/cards/alpha-p0/ironwood/wood_cub.webp`

The visual brief is a young Ironwood guardian beneath colossal roots, with sturdy bark-like hide and amber-sap accents. It must read as a resilient juvenile guardian rather than pet imagery and must remain visually distinct from the Florestia `forest_cub` master.

## Physical delivery contract

- deterministic authored vector composition;
- 4:5 master;
- 1536×1920 pixels;
- WebP delivery;
- generated before Next resolves `/public`;
- physical metadata validated through Sharp;
- evidence: `51-alpha-p0-batch-5-contact-sheet.png`.

## Fail-closed runtime boundary

This PR is physical production only.

`wood_cub` MUST NOT be added to `ALPHA_P0_ACTIVE_IDS` here. Until a later activation PR is independently certified:

- `alphaP0ArtUrl("wood_cub")` remains undefined;
- `wood_cub` remains priority P0;
- `wood_cub` remains not-covered in the live dedicated-art registry;
- runtime P0 active masters remain 15;
- starter dedicated coverage remains 45 / 140;
- starter backlog remains 95;
- P0 pending remains 6;
- P1/P2 remain 46 / 43.

The physical presence of a file is not runtime activation.

## Non-gameplay boundary

This batch does not change:

- card definitions or IDs;
- rules, stats, effects or costs;
- starter deck recipes;
- authoritative engine behavior;
- economy or inventory;
- matchmaking or PvP authority;
- card-art resolver ordering;
- editorial/admin override precedence;
- coverage reporting.

## Promotion gate

Do not merge this batch until all of the following are true on the exact PR head:

1. all eight required workflows are green;
2. behavioral certification confirms the Batch 5 master is physical, 1536×1920 WebP and inactive/fail-closed;
3. the final CI artifact is bound to the exact PR head;
4. the downloaded artifact SHA-256 matches the GitHub artifact digest;
5. `51-alpha-p0-batch-5-contact-sheet.png` exists in the artifact;
6. the contact sheet is manually reviewed for Ironwood identity, bark-hide, amber-sap accents, colossal-root environment, safe 4:5 composition and distinction from `forest_cub`;
7. the PR head is re-fetched immediately before promotion and merged with an expected-head SHA lock.

A separate runtime activation PR is required after this physical batch is promoted.
