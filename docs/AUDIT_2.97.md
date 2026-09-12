# Engineering audit — RuneForge 2.97.0

## Scope

Final release audit for the Ranked launch candidate after implementation, exact-SHA pull-request certification, squash merge and post-merge recertification. Evidence below distinguishes executable behavior from static guardrails and public-hosting proof.

## Ranked findings closed

1. Open/custom Ranked deck acceptance is replaced by an immutable certified precon pool.
2. Matchmaking, room creation and settlement enforce certified deck fingerprints server-side.
3. Ranked room season is captured at match creation and reused at settlement.
4. Exact content definitions are frozen per PvP room; initial createGame, actions and settlement use that same snapshot.
5. Participant state redaction hides opponent hand, future deck order and server RNG/id counters.
6. Canonical settlement replay verifies the actual host/guest construction before result persistence.
7. MMR/tier overflow resolves to the top tier instead of falling back to Bronze.
8. Rematch cooldown reduces immediate repeat-opponent farming.
9. PvP authoritative actions are rate limited.
10. Ranked season seed migration is create-only and respects operator deactivation.
11. Database upgrade/runtime verification checks Ranked/content snapshot columns, FKs/index and active-room invariants.
12. Administrative Studio HTTP 500 responses are sanitized; detailed failures remain server-log only.
13. Ranked admission has a two-key runtime gate: `RANKED_RELEASE_CERTIFIED=true` and `config.rankedEnabled=true`.
14. `/api/ranked` additionally requires an active season whose time window is open.
15. The current immutable pool is `season-zero-r2`; historical `season-zero-r1` release artifacts are superseded by the regenerated R2 evidence.

## Final balance certification

- Rules version: `2026.08.97`
- Deck pool: `season-zero-r2`
- 4 certified decks
- 6 matchups
- 800 games/matchup
- 8 deterministic seed strata
- **4,800 games**
- health score **100**
- first-player WR **50.5%**
- **6 healthy / 0 watch / 0 critical**
- **6/6 stable**
- max seed deviation **7.5 pp** (threshold 15)
- certified gate **PASS**

Pairwise pooled win rates: Tide–Void 45.3/54.8; Tide–Tempestade 48.5/51.5; Tide–Convergence 53.9/46.1; Void–Tempestade 51.6/48.4; Void–Convergence 50.5/49.5; Tempestade–Convergence 49.3/50.7.

The canonical generated JSON is stored in `BALANCE_AUDIT_2.97.json` and `docs/evidence/BALANCE_AUDIT_2.97.json`.

## Exact-SHA release evidence

Source certification SHA: `18dc5bec2c496e481b5d618c6ea7921d529a3052`.

- Ranked Release Certification #7 / run `34717861792`: **PASS**.
- CI #951 / run `34717861804`: **PASS**.
- Alpha Release Candidate #7 / run `34717861782`: **PASS**.
- Alpha Starter Balance Evidence #174: **PASS**.
- Flagship visual certification workflows: **PASS**.

The Ranked workflow executed a clean registry install, fresh PostgreSQL bootstrap/upgrades, `production:verify`, the current immutable-pool balance gate and a built-server two-player browser certificate.

The two-player certificate passed certified admission, Ranked matchmaking, reconnect/resume, season snapshot provenance, forfeit settlement, atomic dual-perspective MMR history, placement decrement, idempotent settlement, rematch-cooldown anti-farming, no Ranked AI fallback and closed-season admission rejection.

The general CI independently passed runtime/lock gates, typecheck, zero-warning lint, PostgreSQL bootstrapping and upgrades, Marketplace and Mercado Pago database certification, Studio lifecycle/modal/rollback, Super Admin security, behavioral suite, engine coverage, production PostgreSQL behavior/integrity/concurrency probes, production build and the broad HTTP/browser E2E journey.

## Activation boundary

The repository/runtime candidate is **GO for controlled Ranked activation**.

Activation must still be deliberate and fail-closed:

- hosting environment: `RANKED_RELEASE_CERTIFIED=true`;
- runtime game configuration: `rankedEnabled=true`;
- intended Ranked season: active and inside its date window.

The preferred immediate kill switch is `rankedEnabled=false`. A stronger release-level shutdown is `RANKED_RELEASE_CERTIFIED=false` followed by restart/redeploy. Deactivating the season independently blocks new admission while snapshotted in-flight rooms remain settleable.

## Remaining external boundary

Repository CI cannot prove that a public hosting origin is currently serving the certified SHA. Public activation is complete only after the deployed HTTPS origin reports matching `/api/public/game/deployment/provenance`, the real production PostgreSQL instance has the intended open season, and a controlled two-player production smoke succeeds.

## Verdict

**GO technical / NO automatic public enablement.** The code, database contracts, balance evidence and built-server two-player Ranked journey are certified. The only remaining step for live activation is the operator-controlled hosting/database switch and production-origin smoke documented in `docs/RANKED-R2-RELEASE-CERTIFICATE.md`.
