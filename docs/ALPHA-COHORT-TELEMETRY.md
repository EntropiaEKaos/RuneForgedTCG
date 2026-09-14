# Alpha Cohort Telemetry

## Objective

Instrument the first controlled Alpha cohort using the privacy-conscious first-party telemetry infrastructure that already exists in RuneForge. This slice does not add a third-party analytics provider and does not change gameplay authority, matchmaking, economy, persistence semantics or the release contract.

The initial funnel answers two launch questions:

1. Do new players move from first-access onboarding into play?
2. Of the matches that successfully launch, how many reach a client-observed game-over state?

## Events

The first slice intentionally uses only four low-cardinality events:

- `alpha.onboarding_shown`
- `alpha.onboarding_completed`
- `alpha.match_started`
- `alpha.match_completed`

### Allowed properties

Only categorical/product context is emitted by the client, such as:

- match kind (`ai`, `pvp`, `puzzle`, `boss`, `brawl`, `expedition`);
- AI difficulty where applicable;
- deck source (`preset` or `custom`);
- result (`win` or `loss`);
- completed round count.

The client does **not** submit player name, e-mail, recovery keys, access keys, room credentials, match tokens, mode-attempt tokens, cookies or authorization material.

Player association is resolved on the server from the existing RuneForge player session. The ingestion route continues to rate-limit requests and strip sensitive property keys before inserting `telemetry_events`.

## Delivery semantics

Telemetry is best-effort by design:

- `/api/telemetry` failures never block navigation or gameplay;
- client requests use `keepalive` so page transitions have a better chance to complete the POST;
- one-shot onboarding milestones are deduplicated per browser session;
- match events are emitted only after an authoritative launch succeeds and once the existing lifecycle reaches `gameover`;
- Studio sandbox matches are excluded from the Alpha player funnel.

A telemetry count is therefore product-observability evidence, not gameplay authority. Match settlement and progression remain governed by the existing authoritative APIs.

## Admin view

`/api/admin/studio/analytics` retains all existing metrics and adds a backward-compatible `alphaTelemetry` object for the trailing seven days:

- total Alpha telemetry events;
- unique authenticated players;
- unique browser sessions;
- onboarding shown/completed counts and completion rate;
- match started/completed counts and completion rate.

The Live Ops Studio surfaces these values as a compact **Alpha cohort · 7 days** panel.

## Follow-up policy

Do not expand tracking preemptively. Use the first controlled cohort to decide whether more specific funnels are needed for Marketplace, recovery, deck editing, second-session retention or other journeys. New events should only be added when they answer a concrete product question and must preserve the same privacy boundary.
