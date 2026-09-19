# FORGED Command Center 2.0

## Objective

Command Center 2.0 extends the existing admin-only operational intelligence surface with direct-trade health from Trading 2.1.

It does not create a second analytics authority and it does not mutate gameplay, progression, economy, payments, marketplace state or player state.

## New Trading projection

The existing `/api/admin/metrics/overview` response now derives server-side trade operations from `trade_offers`:

- offers created in the last 24 hours;
- accepted, declined, cancelled and expired offers in the last 24 hours;
- active offers right now;
- average time to resolution for offers completed in the last 24 hours.

The deterministic intelligence layer additionally projects:

- 24h direct-trade acceptance rate;
- current 24h vs previous 24h trends for offers created;
- current 24h vs previous 24h trends for offers accepted.

## Authority boundary

Trading lifecycle authority remains in Marketplace/Trading 2.1. Command Center only reads persisted state and produces diagnostics.

No threshold in Command Center can approve, reject, expire, settle or mutate a trade.

## Empty-base behavior

If there are no trade offers in the current 24-hour window, the acceptance signal is neutral rather than fabricating a percentage.

The visible acceptance state is an operational signal, not a product target.

## Browser certification

`scripts/command-center-intelligence-browser-cert.mjs` now requires:

- `INTELLIGENCE 2.0`;
- the operational title including Trading;
- existing DAU/MAU, DAU/WAU, PvP completion and payment approval signals;
- the new `Aceitação de trocas 24h` signal;
- no horizontal overflow at the certified viewport.

The screenshot remains part of the normal Alpha visual artifact.

## Certification base

The final PR certification after the Trading 2.0 provenance merge is based on `main` at `d688518df3fc8144cbc5e5301d4b44974d63db31`. No earlier PR-head green is reused after that base movement.
