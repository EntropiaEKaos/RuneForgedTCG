# FORGED Command Center Intelligence 1.7

## Objective

Turn the existing admin-only Command Center into an operational intelligence surface without creating a second analytics authority. Intelligence 1.7 derives diagnostics from measurements already owned by the production database and first-party telemetry.

## Authority boundary

The following remain authoritative and unchanged:

- `players` for account/progression state;
- persisted pack, deck, match and Ranked records for Player Journey milestones;
- `telemetry_events` for sanitized first-party client activity;
- PvP/Ranked persistence for match activity;
- economy transactions for currency flow;
- payment orders for commerce state.

The intelligence layer may aggregate, compare and classify those measurements. It must not mutate gameplay, progression, economy, payments or player state.

## Intelligence model

`src/lib/command-center-intelligence.ts` is a pure deterministic projection. It adds:

1. per-stage Player Journey conversion;
2. absolute drop-off between adjacent journey stages;
3. largest accumulated funnel leak;
4. DAU/MAU stickiness;
5. DAU/WAU daily return pressure;
6. 24h PvP completion rate;
7. 24h payment approval rate.

Signals use `healthy`, `watch`, `critical` and `neutral` as operational presentation states. They are diagnostics, not gameplay or business authority. Empty denominators resolve to neutral rather than fabricating percentages.

## Next slices

- expose the deterministic projection through the existing admin metrics response;
- add 24h versus previous-24h deltas;
- add time-bucket trends without client-side reconstruction;
- add cohort retention using persisted account creation + activity timestamps;
- render funnel leak and operational signals in Command Center;
- certify privacy, query cost, responsive behavior and browser evidence before promotion.

## Safety

No new client telemetry event is required for this first slice. No PII is introduced. Existing `/api/telemetry` sanitization and admin-only metrics access remain the security boundary.
