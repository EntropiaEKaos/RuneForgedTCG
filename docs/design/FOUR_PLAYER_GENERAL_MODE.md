# FORGED — Four Player General Mode

Status: Design baseline / implementation branch
Branch: `feat/four-player-general-mode`

## Product boundary

This is a separate game mode. It does **not** replace or alter the existing 1v1 modes. Shared card/rules primitives may be reused, but 4P orchestration, matchmaking, UI, balancing and telemetry remain mode-scoped.

## Baseline rules (playtest v0)

- 4 real players, free-for-all.
- Last non-eliminated player wins.
- 80-card main deck + 1 General (81 total).
- Maximum 2 copies of a non-General card unless a card/rules exception says otherwise.
- General begins in a dedicated General/Command Zone and is public information.
- General constrains deck construction through its race/class/affinity identity.
- General may be cast from the General Zone.
- If the General would leave play, its owner may move it to the General Zone where appropriate under the final replacement-event rules.
- Each subsequent cast from the General Zone costs +2 generic resources for each prior General-Zone cast.
- Initial life for the first playtest: 150% of the standard 1v1 starting life. This is a tuning parameter, not a permanent balance promise.
- Initial hand and mulligan inherit the current standard rules unless telemetry shows a 4P-specific issue.
- Turn order: P1 -> P2 -> P3 -> P4 -> repeat, skipping eliminated seats.
- Initial proposal: P1 skips the first normal draw; P2-P4 draw normally. Must be verified in simulation for seat advantage.

## General design

A General has:

1. Public identity: race, class and/or affinities used by deck validation.
2. A Command ability/passive designed for the General Zone when explicitly marked as such.
3. A Presence ability designed for battlefield play when explicitly marked as such.
4. Optional Ascension objective. Ascension is a FORGED-specific design space and should be data-driven rather than hard-coded into the multiplayer engine.

No Commander-damage analogue is part of v0. A future Dominance system may track General combat interaction for abilities/Ascension without automatically becoming a win condition.

## Combat

- The active player may attack any non-eliminated opponent.
- Attackers may be split among multiple opponents.
- Every attacker stores a defending seat/player.
- Only the defending player for that attacker declares its blockers unless a card explicitly changes blocking permissions.
- Combat damage resolves through the normal deterministic engine after declarations and response windows.

## Priority and stack

Priority is circular among non-eliminated seats.

Example while P1 is active: P1 action -> P2 -> P3 -> P4 -> P1. If all eligible players pass consecutively, the top stack object resolves (or the game advances when the stack is empty and the phase permits it). A new action resets consecutive passes.

Client UX must support:

- Auto Pass: automatically pass when there is no legal action.
- Smart Priority: stop only for meaningful legal decisions; default candidate for matchmaking.
- Full Control: expose every rules-valid priority window.

Smart/Auto Pass are UX accelerators only. Server-side rules remain deterministic and authoritative.

## Simultaneous triggers

Use deterministic active-player-first ordering followed by turn order among the other non-eliminated seats. Within a player's simultaneous triggers, preserve the existing engine's owner-controlled ordering if supported; otherwise add an explicit deterministic ordering decision.

## Multiplayer targeting vocabulary

The rules layer must distinguish at minimum:

- target player
- target opponent
- each opponent
- any number of opponents
- all players
- defending player
- owner/controller

Cards must not be silently rewritten globally for 4P. Format-specific overrides, bans or multiplayer interpretations belong to the 4P ruleset and telemetry pipeline.

## Elimination

Elimination must be atomic and deterministic. The mode must define behavior for:

- objects owned by the eliminated player;
- objects controlled but not owned by that player;
- tokens created/owned/controlled by that player;
- continuous effects originating from that player;
- delayed triggers and stack objects;
- control-changing effects involving multiple remaining players.

No UI-only cleanup is allowed; the authoritative engine owns elimination semantics.

## Social play

Table talk and non-binding agreements are allowed at the product level, subject to the eventual communication/moderation design. Agreements are never enforced by game rules.

## Anti-stall / pacing

Use decision timers plus a per-player time bank rather than multiplying a 1v1 turn timer by four. Exact values remain tuning parameters. The engine must expose timer/priority events so clients can render them without owning the authoritative clock.

A future 4P-only incentive for combat may be tested if telemetry shows excessive board stalls. It must not be introduced before baseline measurements.

## Board / client presentation

Each client sees itself at the bottom. The other three seats are rotated into left/top/right positions. Opponent hands expose counts, not secret card identities. The center of the board is reserved for stack/combat resolution and high-value VFX. Heavy VFX should be scheduled once for the focal resolution rather than duplicated per seat.

## Security / hidden information

Clients receive seat-specific projections. Hidden hand/deck information belonging to opponents must not be sent merely to be hidden by CSS. Server remains authoritative for legal actions, RNG, priority, stack, combat and elimination.

## Architecture boundary

Conceptual structure:

- shared FORGED card/rules primitives
- existing 1v1 orchestrator (unchanged behavior)
- FourPlayerMode orchestrator
  - FourPlayerTurnManager
  - FourPlayerPriorityManager
  - MultiTargetCombat
  - FourPlayerEliminationManager
  - GeneralZone rules
  - FourPlayerDeckValidator
  - FourPlayerProjection
  - FourPlayerTelemetry

The feature must remain behind a dedicated mode/feature flag until certification.

## Balance telemetry

Record independently from 1v1:

- seat win/elimination rates;
- match duration and turn count;
- time to first elimination;
- priority windows and average decision latency;
- board wipes;
- damage by source and target count;
- `each opponent` / global scaling cards;
- General cast count and tax paid;
- General presence/command ability contribution;
- Ascension frequency if enabled;
- deck archetype and race/class performance.

4P balance changes must not silently alter 1v1 balance.

## Delivery gates

1. Mode flag and ruleset contract.
2. 80+1 deck/General validation tests.
3. Headless four-seat turn/priority tests.
4. Multi-target combat tests.
5. General Zone and +2 recast tax tests.
6. Elimination ownership/control torture tests.
7. Hidden-information projection tests.
8. Thousands of deterministic headless simulations for stalls/seat bias.
9. Four real browser/client E2E session.
10. Radial desktop/mobile UI and accessibility pass.
11. VFX integration through the existing VFX scheduler/budget, without coupling the rules engine to effects.
12. Dedicated 4P telemetry dashboard and certification before enabling publicly.

## Non-goals for v0

- Replacing 1v1.
- 2v2.
- Commander-damage clone.
- Binding alliances.
- Global card nerfs made only because of 4P.
- Rewriting the existing VFX work.
