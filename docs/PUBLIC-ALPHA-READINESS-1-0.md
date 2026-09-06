# Public Alpha Readiness 1.0

## Purpose

Expose a small public contract that answers one operational question:

> Is the certified playable Alpha available right now, and which launch-scope journeys are currently usable?

This endpoint is intentionally narrower than the full game configuration and does not expose admin/control-plane data.

## Endpoint

`GET /api/public/game/alpha/readiness`

The endpoint verifies PostgreSQL availability, reads the current runtime status, and returns the canonical release/version identifiers.

## Public state

`state` is one of:

- `ready` — general runtime is available and AI/PvE is enabled;
- `limited` — runtime is available but AI/PvE is temporarily disabled;
- `maintenance` — the game is in maintenance mode.

A database/runtime read failure returns HTTP 503 with `Retry-After: 5`.

Responses are always `Cache-Control: no-store` because this is operational status.

## Certified Alpha scope

The public contract lists only journeys already covered by the playable Alpha certification:

- first-run onboarding;
- deck selection;
- mulligan;
- authoritative PvE;
- Forge + persisted decks;
- exactly-once rewards / persisted progression;
- authoritative Casual PvP.

Routes are presentation/navigation hints only. They do not bypass session, matchmaking or gameplay authority.

## Explicit launch boundaries

The response permanently marks these as **not required for the playable Alpha launch**:

- public Ranked;
- real-money payments;
- large-scale Live Ops.

It may report whether Ranked is operational at runtime, but that does not redefine the Alpha launch boundary.

## Security boundary

The endpoint does not expose:

- announcements;
- advanced engine config;
- matchmaking tuning;
- economy values;
- admin/session state;
- payment configuration;
- secrets or environment variables.

## Certification

Behavioral tests cover:

- ready runtime;
- AI-disabled limited runtime;
- maintenance mode;
- stable seven-capability Alpha scope;
- explicit non-goals.

Source-contract tests guard the DB readiness probe, no-store/503 semantics and absence of control-plane internals.
