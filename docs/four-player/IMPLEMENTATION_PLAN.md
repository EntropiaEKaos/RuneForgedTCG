# FORGED Four-Player General Mode — Implementation Plan

Status: development
Branch: `feat/four-player-general-mode`

## Boundaries
- Existing 1v1 behavior remains unchanged.
- Four-player runtime remains isolated and feature-gated until certification.
- VFX consumes gameplay events; rules resolution never depends on VFX.
- Server-authoritative rules, RNG, priority, combat, clock and elimination.
- Per-seat projections protect hidden information.

## Repository seam confirmed
The current deck validator already accepts an explicit `DeckRules` object (`src/game/decks.ts`). The 4P validator must reuse this seam with mode-specific rules instead of changing runtime defaults used by 1v1.

## Phase 1
1. Define `four_player_general` ruleset identifier/feature gate.
2. Define four seats without changing the current 1v1 contracts.
3. Define General metadata/state and General Zone semantics.
4. Add isolated 80-card main deck + 1 General validation, max 2 copies, with identity hooks.
5. Regression tests proving `validateDeck()` default behavior remains unchanged.

## Phase 2 — deterministic headless runtime
- Circular turn manager P1 -> P2 -> P3 -> P4, skipping eliminated seats.
- Circular priority manager with consecutive-pass tracking and reset-on-action.
- Deterministic simultaneous-trigger ordering.
- Seeded simulations.

## Phase 3 — General runtime
- Public General Zone.
- Cast from General Zone.
- +2 generic tax per prior cast from that zone.
- Data-driven Command, Presence and Ascension hooks.

## Phase 4 — multiplayer combat
- Per-attacker defending-seat assignment.
- Split attacks across opponents.
- Defender-scoped blocking by default.
- Explicit player/opponent/each-opponent/all-players targeting semantics.

## Phase 5 — elimination
- Atomic engine-owned elimination.
- Ownership/control, tokens, stack, continuous effects and delayed-trigger torture tests.
- Last surviving player wins.

## Phase 6 — networking and secrecy
- Four real clients in one authoritative match.
- Per-seat projections; hidden hand/deck identities are never sent to unauthorized clients.
- Reconnect/replay/resync tests.

## Phase 7 — board and VFX integration
- Local player bottom; opponents left/top/right.
- Central stack/combat focus.
- Smart Priority candidate default.
- Consume the existing VFX event/budget pipeline after gameplay contracts stabilize.

## Phase 8 — telemetry and certification
- Seat performance, duration, turns, first elimination, priority latency/stalls.
- General casts/tax and Command/Presence/Ascension contribution.
- Global-card and archetype/race/class performance.
- Thousands of deterministic simulations plus four-client E2E.
- 1v1 regression gates before promotion to `main`.
