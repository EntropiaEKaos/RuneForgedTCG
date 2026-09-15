# Alpha P0 Batch 1 — Runtime Activation

Base production: `de99d04e9b4190173b30c1960ce04cd8be5eac37`.

This change activates only the five physical Alpha P0 masters certified and promoted by PR #189:

- `ember_bolt` → `/art/cards/alpha-p0/emberhold/ember_bolt.webp`
- `wood_webweaver` → `/art/cards/alpha-p0/ironwood/wood_webweaver.webp`
- `tide_guard` → `/art/cards/alpha-p0/tidecall/tide_guard.webp`
- `wood_growth` → `/art/cards/alpha-p0/ironwood/wood_growth.webp`
- `wood_mend` → `/art/cards/alpha-p0/ironwood/wood_mend.webp`

## Runtime contract

`ALPHA_P0_ACTIVE_IDS` is the single activation allowlist. `getCardArt()` resolves only targets on that allowlist, after cosmetic and Admin/editorial overrides and before the existing Flagship built-ins. The Alpha exposure model consumes the same allowlist when computing `knownDedicatedArt`, so runtime resolution and Studio coverage cannot drift independently.

Admin/editorial art remains higher priority than built-in P0 masters. Clearing an editorial override restores the certified P0 master.

The remaining sixteen P0 production targets stay fail-closed: they retain deterministic target paths and briefs but are not exposed through `getCardArt()` and are not counted as covered until a later physical-master certification and activation change.

## Coverage delta

Starter art coverage changes only because five certified files become runtime-active:

- unique starter cards: 140 → 140
- dedicated-art coverage: 30 → 35
- missing dedicated art: 110 → 105
- live P0 queue: 21 → 16

No card rules, stats, effects, costs, deck recipes, IDs, economy, inventory, matchmaking, engine authority or fallback semantics change.

## Certification

Behavioral contracts must prove:

1. exactly five active P0 ids and exact equality with physical Batch 1;
2. every active id resolves its certified regional WebP through `getCardArt()` and the catalog overlay;
3. all remaining P0 targets remain unresolved and uncovered;
4. coverage is exactly 35 covered / 105 missing / 16 P0 pending;
5. Admin/editorial art still overrides a built-in P0 master;
6. all five active WebPs are served by the production build as `image/webp`;
7. `Scorching Bolt` opens its P0 master through the real Codex `VER ARTE` viewer without overflow.

Visual evidence added by the browser gate: `45-alpha-p0-ember-bolt-art-viewer.png`.

Do not merge until the exact PR head passes all workflows and the `45` screenshot has been manually reviewed.
