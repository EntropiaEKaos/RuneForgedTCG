# Commander 4P Combat Recovery — Lossless Integration Audit

## Certified baseline

Integration base:

`b6891a54b1629183d031156dc1fe644ea22f3420`

This is the certified Commander 4P Alpha main containing the PostgreSQL room/seat authority, 60-card + General loadout, ready/start flow and isolated Commander UI/API.

## Frozen source anchors

The recovery process does not depend on mutable feature branches. Exact historical states were frozen before integration:

- `archive/four-player-general-mode-f3decdb2` → `f3decdb2f9ae439136937e994285586d06dba294`
- `archive/collectibles-four-player-runtime-6a4f9d1e` → `6a4f9d1e8e99a1166022fa5385e6e5c8aadf8911`
- `archive/commander-alpha-four-player-3ad87324` → `3ad87324df959f13ab5450430e394b1d569839e3`
- `archive/commander-certified-b6891a54` → `b6891a54b1629183d031156dc1fe644ea22f3420`

These archive refs must not be force-moved or reused for later releases.

## Preservation contract

1. Source branches and archive refs are never rewritten as part of recovery.
2. Recovery happens only on `feat/commander-4p-combat-recovery`.
3. No historical file is deleted to make integration easier.
4. Every imported engine module retains a traceable source SHA.
5. The certified 1v1 `PlayerId = "player" | "ai"` contract remains untouched.
6. `commander_rooms` / `commander_seats` remain the persistent authority.
7. No old migration number, old four-player schema, or old shared-engine mutation is copied over current certified schema.
8. A source behavior that no longer matches current product rules is adapted, not silently restored.

## PR #209 — primary engine source

Source: `archive/four-player-general-mode-f3decdb2`

This source contains the mature headless four-player engine: turn rotation, priority, stack, combat, elimination, General Zone, mana, phases, projection, resync, protocol, server pump and four-client harnesses.

### A — bring nearly intact

These modules are isolated deterministic logic and do not mutate the 1v1 engine:

- `four-player-turn-manager.ts` + tests
- `four-player-priority-manager.ts` + tests
- `four-player-stack.ts`
- `four-player-flow.ts` + tests
- `four-player-combat.ts` + tests
- `four-player-elimination.ts` + tests
- `four-player-phase-machine.ts` + tests
- `four-player-general-zone.ts` + tests
- `four-player-general-abilities.ts` + tests
- `four-player-ascension.ts` + tests
- `four-player-card-zones.ts` + tests
- `four-player-turn-start.ts` + tests
- `four-player-server-pump.ts` + tests
- `four-player-resync.ts`
- four-client and reconnect harnesses

### B — import with current-rule adaptation

These are valuable but contain old product assumptions or require a bridge to the certified PostgreSQL authority:

- `four-player-general.ts` / test
  - old source: 80-card deck, max 2 copies;
  - current contract: 60 cards, max 3 copies, Champion/Legend General outside the library.
- `four-player-match.ts` / integration tests
  - preserve 30 starting resource/life boundary;
  - normalize terminology to Commander/Nexus where exposed publicly.
- `four-player-damage.test.ts`
  - General damage ledger may remain telemetry/ability state;
  - it must not silently become a Commander-damage win condition.
- `four-player-projection.ts` / tests
  - preserve hidden-information guarantees;
  - align public field naming with current Commander DTOs.
- `four-player-protocol.ts` / tests
  - retain revision/replay protection;
  - persistent revision must be coordinated with `commander_rooms.version`.
- `four-player-session.ts` / tests
  - connection epochs are valuable;
  - seat ownership comes from authenticated `commander_seats`, not an independent in-memory authority.
- `four-player-authority.ts` / tests
  - keep pure command validation and pump orchestration;
  - execute inside current PostgreSQL room transactions.
- `four-player-reducer.ts` / tests
  - retain canonical event reduction;
  - state serialization must use the current room `game_state`.
- `four-player-broadcast.ts` / tests
  - retain per-seat projections;
  - transport must use the current authenticated Commander room.
- `scripts/test-suites.mjs`
  - merge only the new tests into the current taxonomy; never replace the current suite.
- design docs
  - preserve historical design as source material;
  - do not restore the obsolete 80+1 / two-copy contract.

## PR #223 — selective UI/API reference only

Source: `archive/collectibles-four-player-runtime-6a4f9d1e`

Useful references:

- `src/app/four-player/FourPlayerClient.tsx` for four-seat battlefield/lobby presentation;
- `src/app/api/four-player/*` for command transport patterns;
- `src/app/forge/ForgeClient.tsx` for mode-entry UX ideas;
- `src/game/four-player-mode.ts` / rules as reference when behavior is not already stronger in #209.

Do **not** transplant directly:

- `drizzle/0048_collectibles_four_player_runtime.sql`;
- `src/db/schema/four-player.ts`;
- global changes to `src/game/types.ts`;
- global changes to `src/game/engine/state.ts`;
- old deck endpoints that bypass the current Commander loadout authority;
- collectible/marketplace changes already superseded on main;
- old bootstrap/schema edits tied to obsolete migration numbering.

Reason: these would collide with current Trading/Collectibles/Commander schema or contaminate the certified 1v1 engine.

## PR #232 — archive / comparison only

Source: `archive/commander-alpha-four-player-3ad87324`

Its Commander authority foundation is superseded by the certified #237 implementation. It remains preserved for provenance and for recovering any isolated idea not present in current main.

## Recovery sequence

### Slice 1 — deterministic combat core

Import the isolated #209 engine and tests, adapting only the central rules contract to current 60+1 / three-copy Commander rules.

### Slice 2 — PostgreSQL authority bridge

Bind protocol revision, authenticated seat, connection epoch, reducer and server pump to locked `commander_rooms` transactions.

### Slice 3 — full rules flow

Activate phases, priority/reactions, General cast/recast tax, split combat, damage, elimination, deck-out and last-player-standing settlement.

### Slice 4 — per-seat DTOs and reconnect

Use #209 projection/broadcast/resync logic without sending opponent hidden card identities.

### Slice 5 — battlefield UI

Recover useful presentation concepts from #223, but mount them on the existing `/commander` surface and current API rather than reviving the obsolete `/four-player` authority.

### Slice 6 — certification

Require:

- unit + integration tests for every imported module;
- four-client authoritative harness;
- reconnect/stale-epoch harness;
- exact-SHA PostgreSQL certification;
- browser evidence at desktop/mobile;
- zero regression in Casual PvP and Ranked;
- exact-SHA post-merge certification before declaring the combat Alpha promoted.

## Non-loss rule

If an old behavior is rejected during adaptation, its original implementation remains recoverable from its frozen archive ref. Recovery never depends on deleting or rewriting history.
