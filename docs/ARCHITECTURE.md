# RuneForge architecture

RuneForge is a Next.js/TypeScript collectible card game with a deterministic server-authoritative engine, PostgreSQL persistence through Drizzle, multiplayer settlement/replay, admin content tooling, collection/economy systems and Mercado Pago commerce.

## Authority boundaries

- The game engine is authoritative for costs, legality, actions, effects, Sentinelas, combat and deterministic replay.
- PvP actions are server transitions. Browsers receive a redacted participant projection rather than the authoritative state.
- PvP rooms freeze the complete relevant card-definition closure (`contentSnapshot` + `contentHash`). Initial game creation, later actions and settlement use that same snapshot, so a Studio publish cannot mutate an in-flight match.
- Ranked settlement has one PvP authority. Each Ranked room freezes its season id and a certification snapshot containing ranked rules version, deck-pool version and both certified deck fingerprints.
- Ranked Season Zero accepts only the immutable `season-zero-r1` pool. Arbitrary/custom decks are rejected by the server.
- Player/admin sessions are server-persisted and revocable.
- Retry-sensitive economy mutations use PostgreSQL transactions and idempotency receipts.
- Studio publication is validated before content reaches the live registry and reverse dependencies protect destructive content operations.

## Ranked release boundary

The dedicated Ranked balance gate audits the exact immutable pool that matchmaking accepts. For 2.97 it completed 4,800 games across 8 deterministic strata with 6/6 healthy, 0 watch, 0 critical and all matchups stable. The runtime still requires both `config.rankedEnabled` and `RANKED_RELEASE_CERTIFIED=true`; the environment flag defaults false until the clean release pipeline succeeds.

## Data and schema

`src/db/schema/` is the ORM model. `database/baseline-2.31.sql` plus later migrations define fresh PostgreSQL bootstrap. Static parity scripts guard common drift; `scripts/production-verify.ts` is the runtime database verification layer. Static parsers are not proof that PostgreSQL migrations execute.

## Production boundary

A release is not production-certified until the official dependency versions, full TypeScript check, ESLint, behavioral suite, PostgreSQL verification and Next build all complete on the deploy candidate.
