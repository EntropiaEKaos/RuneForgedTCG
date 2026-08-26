# Engineering audit — RuneForge 2.97.0

## Scope

Final pass over the Ranked launch candidate after repeated implementation → scan → correction cycles. Evidence below distinguishes executable behavior from static guardrails.

## Ranked findings closed

1. Open/custom Ranked deck acceptance was replaced by an immutable certified precon pool.
2. Matchmaking, room creation and settlement enforce certified deck fingerprints server-side.
3. Ranked room season is captured at match creation and reused at settlement.
4. Exact content definitions are frozen per PvP room; initial createGame, actions and settlement use that same snapshot.
5. Participant state redaction hides opponent hand, future deck order and server RNG/id counters.
6. Canonical settlement replay verifies the actual host/guest construction before result persistence.
7. MMR/tier overflow now resolves to the top tier instead of falling back to Bronze.
8. Rematch cooldown reduces immediate repeat-opponent farming.
9. PvP authoritative actions are rate limited.
10. Ranked season seed migration is create-only and respects operator deactivation.
11. Database upgrade/runtime verification checks Ranked/content snapshot columns, FKs/index and active-room invariants.
12. Administrative Studio HTTP 500 responses are sanitized; detailed failures remain server-log only.

## Final balance certification

- Rules version: `2026.08.97`
- Deck pool: `season-zero-r1`
- 4 certified decks
- 6 matchups
- 800 games/matchup
- 8 deterministic seed strata
- **4,800 games**
- health score **100**
- first-player WR **50.4%**
- **6 healthy / 0 watch / 0 critical**
- **6/6 stable**
- max seed deviation **11.1 pp** (threshold 15)
- certified gate **PASS**

Pairwise pooled win rates: Tide–Void 49.7/50.3; Tide–Tempestade 50.3/49.7; Tide–Convergence 53.8/46.2; Void–Tempestade 54.5/45.5; Void–Convergence 46.6/53.4; Tempestade–Convergence 48.1/51.9.

## Regression evidence

- Behavioral: **35/35 PASS**.
- Legacy static/source contracts: **41/41 PASS**, not counted as behavior.
- Current 2.97 static contracts: **28/28 PASS**, not counted as behavior.
- Test taxonomy: **35 behavioral / 41 source-contract**.
- Local import resolution: **432 source/script files PASS**.
- TS syntax/transpile: **418/418 src+scripts PASS** with TypeScript 5.8.3; not full typecheck.
- Schema static parity: **92 indexes / 32 FK contracts PASS**.
- Fresh schema static: **60 tables / 627 columns / 41 SQL FKs PASS**.
- Semantic static: **6 Drizzle FKs / 14 named CHECKs / 10 named indexes PASS**.
- Ranked fail-closed guard: PASS while release env flag is false.

## Remaining external release blocker

No real `package-lock.json` is present. `release-runtime-gate` therefore blocks production as designed. The environment could not complete `npm run lock:refresh` within the network timeout. Consequently this audit does **not** claim the exact dependency typecheck, ESLint, Next build, PostgreSQL migration execution or HTTP E2E were completed here.

## Verdict

The source-level Ranked candidate is **GO for clean-deploy certification** and its dedicated competitive balance gate is PASS. Production Ranked must remain fail-closed until the official dependency/PostgreSQL/build pipeline passes on the exact deployment artifact, at which point the operator may set `RANKED_RELEASE_CERTIFIED=true`.
