# Alpha P1 Batch 2 Runtime Certification

## Production baseline

This certification branches from production merge `07242a5d152f18b924f47b127ebcff59a3e670a7` after Command Center Evidence 1.8.

The Batch 2 runtime registry, physical masters and viewer cert already exist on this baseline. This change closes the remaining Studio evidence gap instead of duplicating the existing Batch 2 browser or physical gates.

## Certified Batch 2 targets

1. `ember_blade` — Flamebrand
2. `ember_phantom` — Flame Phantom
3. `forest_pack_shelter` — Abrigo da Matilha
4. `forest_summon_pack` — Convocar a Matilha
5. `forest_packrunner` — Corredora da Matilha

## Expected coverage

The authoritative deterministic art-priority contracts require:

- starter unique cards: **140**;
- covered: **61**;
- starter missing: **79**;
- P0 pending: **0**;
- P1 pending: **36**;
- P2 pending: **43**.

The Studio browser certification must now prove the rendered Art Pipeline exposes 61 cards with art, 79 starter cards without dedicated art and the remaining P1 queue of 36, in addition to its existing readiness, queue and overflow contracts.

## Existing physical/browser gates

The existing P1 Batch 1 physical gate invokes `alpha-p1-batch-2-art.test.ts`, which requires all five 1536x1920 WebP masters and writes `54-alpha-p1-batch-2-contact-sheet.png`.

The existing P1 Batch 1 browser cert invokes `alpha-p1-batch-2-browser-cert.mjs`, which requires all five Batch 2 WebPs to be served by the built app, opens Flamebrand in the real Codex art viewer and writes `55-alpha-p1-batch-2-ember-blade-art-viewer.png`.

These gates are intentionally not called a second time directly from CI.

## Merge gate

Do not merge until one exact PR head satisfies all of the following:

1. all eight PR workflows green on the same SHA;
2. behavioral/static contracts prove 61 covered / 79 missing / 0 P0 / 36 P1 / 43 P2;
3. physical P1 output proves 5/5 Batch 2 masters and contact sheet 54;
4. browser output proves 10 active P1 WebPs plus Batch 1/2 runtime viewers;
5. Studio browser evidence proves 61 with art / 79 starter missing / 36 P1 pending;
6. successful CI artifact digest matches the downloaded ZIP byte-for-byte;
7. `54-alpha-p1-batch-2-contact-sheet.png`, `55-alpha-p1-batch-2-ember-blade-art-viewer.png` and `43-studio-art-pipeline.png` are manually inspected.

No deck recipe, card ID, stats, costs, effects, engine authority, economy, inventory, matchmaking or fallback precedence is changed by this certification.
