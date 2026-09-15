# Alpha P0 Masters Batch 4

Production baseline: `0ce30db0950aaf0af4f2ac6354d320e999a39d9d`

## Scope

Materialize the fourth physical Alpha P0 art batch without changing runtime activation.

Batch 4 is exactly positions 16–20 of the certified 21-master P0 production contract:

1. `storm_lightning` — Tempestade
2. `storm_sky_sentinel` — Tempestade
3. `storm_strikecaller` — Tempestade
4. `tide_sprite` — Tidecall
5. `void_drain` — Voidborn

`wood_cub` remains the final unproduced P0 target after this batch.

## Delivery contract

Every Batch 4 master is generated deterministically from authored vector composition and delivered as:

- 4:5 aspect ratio;
- 1536×1920 master;
- single-frame WebP;
- regional path `/art/cards/alpha-p0/<region>/<defId>.webp`;
- composition centered inside the established safe area.

Regional direction remains aligned with the Flagship style bible:

- **Tempestade:** storm blue, electric white, violet charge and pale gold; controlled high-altitude lightning rather than generic chaos.
- **Tidecall:** deep navy, luminous cyan, pearl white and sea-glass teal; elegant suspended-water language and coral/tide architecture.
- **Voidborn:** black violet, abyssal blue, ghost silver and toxic magenta; controlled soul-smoke/void geometry rather than an undifferentiated black field.

## Authored identities

- `storm_lightning`: a focused, engineered lightning strike with precise descending geometry.
- `storm_sky_sentinel`: vigilant armored guardian holding a high-altitude bastion edge.
- `storm_strikecaller`: battlefield conductor deliberately directing multiple lightning vectors.
- `tide_sprite`: compact luminous water elemental surrounded by suspended droplets and Tidecall forms.
- `void_drain`: controlled essence threads converging into a compact abyssal aperture.

## Certification

`src/game/alpha-p0-batch-4-art.test.ts`:

- proves Batch 4 stays exactly at production positions 16–20;
- requires `ALPHA_P0_ACTIVE_IDS.length === 15`;
- requires all five Batch 4 targets to remain runtime-inactive and P0 pending;
- executes the real generator;
- inspects every generated file with Sharp;
- requires WebP / 1536×1920 / single frame;
- emits `artifacts/alpha-visual/50-alpha-p0-batch-4-contact-sheet.png` for manual review.

The test is registered as a behavioral certification and CI reruns it after browser E2E so the contact sheet is preserved in the final visual artifact.

## Safety boundary

This PR must not modify `ALPHA_P0_ACTIVE_IDS`, `getCardArt()` resolution, alpha coverage accounting, gameplay rules, stats, effects, costs, deck recipes, IDs, engine authority, economy, inventory or matchmaking.

Expected live state throughout this physical-production PR:

- active P0 masters: **15**;
- starter covered: **45 / 140**;
- starter missing: **95**;
- P0 pending: **6**;
- P1/P2 pending: **46 / 43**.

Do not merge until the exact PR head has all normal workflows green and `50-alpha-p0-batch-4-contact-sheet.png` has been manually reviewed. Runtime activation belongs in a separate PR after physical certification.
