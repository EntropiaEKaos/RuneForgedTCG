# Security model

## Authentication and sessions

Admin passwords use scrypt and MFA secrets use AES-256-GCM. Sensitive operator mutations require step-up authentication and revoke sessions where appropriate. Player recovery credentials are hashed, expire, rotate after successful recovery and invalidate prior sessions. Recovery keys are never newly persisted in browser storage: they are surfaced once from volatile client memory and must be saved explicitly by the player. Legacy browser-stored recovery keys are consumed once, removed immediately and migrated through the normal rotation flow. Public player responses use allow-list DTOs rather than database-row spreading.

## Request security

Mutation origin validation trusts forwarded host/protocol headers only when `TRUST_PROXY=true`. Rate limits use PostgreSQL-backed atomic counters and fail closed. Expired rate-limit buckets are cleaned by maintenance rather than random request-path cleanup. Authoritative PvP actions and matchmaking are rate limited per stable player identity.

## Ranked/PvP confidentiality and integrity

- Ranked accepts only server-defined certified precons.
- Room season and certification provenance are immutable for settlement.
- The entire card-definition closure used by a room is snapshotted and hashed.
- Participant responses redact the opponent hand, both future deck orders and server-only RNG/instance counters.
- Settlement replays the canonical host/guest construction against the frozen content snapshot before recording the result.
- Immediate Ranked rematches are suppressed by configurable cooldown to reduce trivial win-trading/farming.

## Payments and economy

Mercado Pago webhook signatures are verified, provider objects are re-fetched, order/product/value/currency/environment bindings are validated, and fulfillment is idempotent. Provider error details are sanitized from public responses. Retry-sensitive economy operations use operation IDs/receipts and transactional wallet/ledger mutation.

## Operational note

The PostgreSQL rate-limit store is appropriate for the MVP but writes for each limited request. Benchmark sustained production load and move behind the limiter interface to a dedicated low-latency backend such as Redis if database write pressure becomes material.


## Player recovery browser boundary

The recovery key is a bearer credential and is treated as such.

- `rf_player_session` stays HttpOnly and is the normal browser identity.
- Newly issued recovery keys live only in volatile JavaScript memory long enough to be shown/copy-saved.
- `runeforge_recovery_code` is never written by current code.
- Old builds that left that key in `localStorage` are migrated one time: read, removed immediately, and either surfaced for explicit saving or used once to recover/rotate an expired session.
- Invalid recovery credentials do not destroy the current session.
- Valid recovery credentials revoke the previous browser session row and issue one replacement cookie plus one replacement recovery key.

The real Alpha browser journey asserts that the one-time key is visible while `localStorage.getItem("runeforge_recovery_code") === null`.
