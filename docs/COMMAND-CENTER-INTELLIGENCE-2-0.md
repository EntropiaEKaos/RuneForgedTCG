# FORGED Command Center Intelligence 2.0

Command Center 2.0 extends the server-owned operational projection with player lifecycle, retention and marketplace/trading health.

## Lifecycle

The primary funnel tracks account → first pack → first deck → first match → second match → marketplace use → accepted trade → observed D7 return. Ranked and Draft adoption remain separate diagnostic signals because they are optional branches rather than mandatory sequential stages.

## Retention

D7 and D30 are computed server-side from persisted account creation and first-party telemetry timestamps. A player counts as retained only when activity exists at or after the account-age threshold. Empty eligible cohorts remain zero rather than fabricated percentages.

## Marketplace

The admin overview includes active/listed/sold listings plus active/created/accepted/expired direct trades. Analytics remains read-only and does not create a second economy authority.

## Intelligence signals

2.0 adds trade acceptance, D7 retention, Ranked adoption and Draft adoption beside DAU/MAU, DAU/WAU, PvP completion and payment approval.

## Safety

The endpoint remains admin-only and read-only. It aggregates existing production-owned tables and sanitized first-party telemetry. No PII is added to the response.
