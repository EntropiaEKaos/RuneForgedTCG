# RuneForge architecture

RuneForge is a Next.js/TypeScript collectible card game with a deterministic server-authoritative engine, PostgreSQL persistence through Drizzle, multiplayer settlement/replay, admin content tooling, collection/economy systems and Mercado Pago commerce.

## Authority boundaries

- The game engine is authoritative for costs, legality, actions, effects, Sentinelas, combat and deterministic replay.
- PvP actions are server transitions. Browsers receive a redacted participant projection rather than the authoritative state.
- PvP rooms freeze the complete relevant card-definition closure (`contentSnapshot` + `contentHash`). Initial game creation, later actions and settlement use that same snapshot, so a Studio publish cannot mutate an in-flight match.
- Ranked settlement has one PvP authority. Each Ranked room freezes its season id and a certification snapshot containing ranked rules version, deck-pool version and both certified deck fingerprints.
- Ranked Season Zero accepts only the immutable `season-zero-r2` pool. Arbitrary/custom decks are rejected by the server.
- Player/admin sessions are server-persisted and revocable.
- Retry-sensitive economy mutations use PostgreSQL transactions and idempotency receipts.
- Studio publication is validated before content reaches the live registry and reverse dependencies protect destructive content operations.

## Ranked release boundary

The dedicated Ranked balance gate audits the exact immutable pool that matchmaking accepts. The current `season-zero-r2` certificate ran 4,800 games across 8 deterministic strata with health score 100, 6/6 healthy matchups, 0 watch, 0 critical, all 6 matchups stable, first-player win rate 50.5% and maximum seed deviation 7.5 pp under the 15 pp threshold.

The runtime requires both `config.rankedEnabled` and `RANKED_RELEASE_CERTIFIED=true`. `/api/ranked` additionally requires a Ranked season whose active flag and time window are open. This three-part boundary keeps competitive admission fail-closed while preserving settlement for already snapshotted in-flight rooms.

The executable release provenance and the exact activation/rollback sequence are recorded in `docs/RANKED-R2-RELEASE-CERTIFICATE.md`.

## Data and schema

`src/db/schema/` is the ORM model. `database/baseline-2.31.sql` plus later migrations define fresh PostgreSQL bootstrap. Static parity scripts guard common drift; `scripts/production-verify.ts` is the runtime database verification layer. Static parsers are not proof that PostgreSQL migrations execute.

## Production boundary

A release is not production-certified until the official dependency versions, full TypeScript check, ESLint, behavioral suite, PostgreSQL verification and Next build all complete on the deploy candidate. Repository certification is not a claim that a public host is serving that SHA: the deployed origin must also expose matching deployment provenance and pass the production smoke against its real PostgreSQL instance.
