# Alpha P1 Batch 3 Certification

Production baseline: `3cdeb3e60da76934569c6d169a610aab5e954281`.

## Deterministic queue slice

The Batch 3 targets are the next five cards in the authoritative Studio P1 ordering:

1. `forest_entangle` — Embaraçar — Florestia
2. `forest_stalker` — Espreitadora da Floresta — Florestia
3. `wood_ent` — Ancient Rootcolossus — Ironwood
4. `wood_stag` — Elder Stag — Ironwood
5. `wood_caller` — Grove Caller — Ironwood

Each target remains a two-slot starter exposure in exactly one starter deck. No recipe, card identity, cost, stats, effects or gameplay authority changes.

## Expected live coverage

- starter unique: **140**
- covered: **66**
- missing: **74**
- P0 pending: **0**
- P1 pending: **31**
- P2 pending: **43**

## Evidence

The physical gate generates and validates five 1536x1920 single-frame WebP masters and writes:

- `56-alpha-p1-batch-3-contact-sheet.png`

The browser gate requires all five assets from the built application, opens Embaraçar in the real Codex viewer and writes:

- `57-alpha-p1-batch-3-forest-entangle-art-viewer.png`

The Studio browser certificate must independently prove the rendered Art Pipeline counters are 66 with art / 74 starter missing / 31 P1 pending and preserve the existing P0, queue, readiness and overflow contracts.

Batch 3 is chained behind the existing Batch 2 physical and browser entrypoints so CI does not duplicate expensive gates.

## Merge gate

Do not merge until one exact PR head has:

1. all eight PR workflows green;
2. global art contracts at 66 / 74 / 0 / 31 / 43;
3. 5/5 Batch 3 physical masters certified;
4. Batch 3 WebPs served by the built app and Embaraçar viewer certified;
5. Studio counters certified at 66 / 74 / 31;
6. CI artifact downloaded and its SHA-256 verified against GitHub;
7. manual inspection of evidence 56, 57 and the Studio Art Pipeline screenshot;
8. a final main/PR-head re-fetch immediately before merge.

No engine, rules, deck recipes, economy, inventory, payment or matchmaking authority is changed by this art activation.
