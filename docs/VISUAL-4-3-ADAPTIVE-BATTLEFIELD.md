# RuneForge Visual 4.3 — Adaptive Battlefield

## Goal

Make the live battlefield behave like a touch-first game surface on tablets and phones instead of shrinking the desktop composition.

## Production boundary

Visual 4.3 is presentation-only. It does not change engine rules, turn authority, targeting legality, network transport, persistence, deck legality or card definitions.

The root layout and frozen BattleView DOM remain unchanged. The pass reuses the existing `PlayerHand` expansion state and accessibility contract.

## Composition modes

### Desktop / notebook

The certified Visual 4.0–4.2 short-desktop behavior remains authoritative.

### Tablet / mobile (`<= 900px`)

- Arena is bounded to `100dvh`.
- Safe-area insets are respected.
- Secondary status chrome yields to tactical surfaces.
- Both deployment rows are local horizontal scrollers with snap assistance.
- Primary actions remain a touch-sized horizontal rail.
- Mission briefing and battle log stay overlays instead of increasing document height.

### Portrait (`<= 600px`)

- Both battlefields remain visible while the hand is collapsed.
- Hand expansion becomes an overlay drawer rather than reflowing the whole battle.
- Card dimensions remain fluid through `clamp()` variables.

### Short landscape

- Battlefield cards become denser.
- Non-essential encounter/log chrome disappears.
- The hand drawer remains available without changing document height.
- The action rail stays reachable at the bottom edge.

## Touch contract

- primary controls keep a 44px interaction floor where screen height permits;
- board/hand use `touch-action: pan-x` and contained overscroll;
- coarse-pointer devices do not depend on hover transforms;
- reduced-motion users retain the same layout without transition dependency.

## Certification

The existing classified battlefield regression suite now requires the Visual 4.3 contracts while preserving the notebook/browser gates introduced by Visual 4.0–4.2.

Full repository CI remains mandatory before merge.
