# Alpha P1 Batch 1 Runtime Activation

## Production baseline

This activation is based on production merge `fb127616339e180f39c9fd534084fffc2e2ee641`, where the first five Alpha P1 masters were already physically certified but intentionally remained fail-closed at runtime.

Certified Batch 1 targets:

1. `ember_duelist` — Ash Duelist
2. `ember_raider` — Ashfront Raider
3. `ember_herald` — Cinder Herald
4. `ember_whelp` — Cinder Whelp
5. `ember_zealot` — Emberfang Zealot

The physical contact sheet remains `53-alpha-p1-batch-1-contact-sheet.png`.

## Runtime promotion

`ALPHA_P1_ACTIVE_IDS` promotes exactly those five certified masters. Runtime art precedence becomes:

1. cosmetic appearance;
2. editorial/browser/custom cached art;
3. active Alpha P0 master;
4. active Alpha P1 master;
5. Flagship Champion;
6. Flagship Structure;
7. Flagship Ritual;
8. Flagship Trap;
9. Flagship starter signature;
10. regional fallback elsewhere in the presentation stack.

This preserves editorial and cosmetic authority above built-in production art.

## Coverage movement

The activation must move exactly five cards from the live P1 queue into dedicated coverage:

- starter unique cards: **140** unchanged;
- covered: **51 → 56**;
- starter missing: **89 → 84**;
- P0 pending: **0** unchanged;
- P1 pending: **46 → 41**;
- P2 pending: **43** unchanged.

Expected Studio coverage after activation:

- catalog cards: **446**;
- cards with art: **56**;
- global coverage: **12.6%**;
- starter unique: **140**;
- starter missing: **84**;
- P0 pending: **0**.

All five Batch 1 cards must disappear from the Studio `MISSING` queue after activation.

## Mutable fixture hardening

`ember_whelp` is used by the reaction-window regression as a deliberately mutable fixture. Once runtime art is active, `getCard("ember_whelp")` returns a presentation clone with the resolved art overlay. The regression therefore mutates `CARDS.ember_whelp` directly so its temporary `uncounterable` rule continues to exercise the canonical registry rather than a disposable presentation clone.

No gameplay rule is changed by this fixture correction.

## Browser certification

`scripts/alpha-p1-batch-1-browser-cert.mjs` must:

- verify all five active P1 masters are served as `image/webp` by the built app;
- open the real `/codex` surface;
- search for `Ash Duelist`;
- open its `VER ARTE` viewer;
- require dialog and modal semantics;
- require the exact master `/art/cards/alpha-p1/emberhold/ember_duelist.webp`;
- require body scroll lock and no horizontal overflow;
- capture `54-alpha-p1-ember-duelist-art-viewer.png`.

The Chrome bootstrap source contract expands from **27 to 28** certified headless browser scripts.

## Merge gate

Do not merge until the exact PR head satisfies all of the following:

1. all eight PR workflows are green on the same exact SHA;
2. behavioral logs prove 56 covered / 84 backlog / 0 P0 / 41 P1;
3. the P1 physical test reports `active registry match` while preserving `53`;
4. the browser cert reports all five P1 WebPs served and Ash Duelist viewer PASS;
5. Studio browser evidence reports 56 with art / 84 starter missing / 0 P0 and the five Batch 1 IDs are absent from the missing queue;
6. the successful CI artifact digest matches the downloaded ZIP byte-for-byte;
7. `53-alpha-p1-batch-1-contact-sheet.png`, `54-alpha-p1-ember-duelist-art-viewer.png` and `43-studio-art-pipeline.png` are manually inspected.

No deck recipe, card ID, card stats, costs, effects, engine authority, economy, inventory or matchmaking behavior changes in this activation.
