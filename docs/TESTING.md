# Testing and audit taxonomy

RuneForge separates evidence classes so static source checks are never presented as behavioral certification.

## Behavioral tests

`npm run test:behavior`

These import/execute product logic and assert outputs or state transitions. The final 2.97 local rerun completed **35/35 behavioral targets**.

## Static/source-contract audits

`npm run audit:source-contracts`

These inspect source text/configuration and are architectural lint only. The final rerun completed **41/41 legacy source-contract targets** plus **28/28 current 2.97 contracts**. These numbers are intentionally reported separately from behavioral tests.

## Static schema guardrails

`npm run audit:schema-static`

They parse SQL/Drizzle and catch drift classes without executing PostgreSQL. Final 2.97 local results: 92 historical indexes / 32 historical FK contracts; fresh model 60 tables / 627 columns / 41 SQL FKs; semantic model 6 Drizzle FKs / 14 named CHECKs / 10 named indexes. PostgreSQL remains authoritative.

## Test taxonomy guard

`npm run audit:test-taxonomy` fails if a test is unclassified or if a behavioral target reads repository source with `readFile`/`readFileSync`. Final result: **35 behavioral / 41 source-contract targets**.

## TypeScript evidence

The local global TypeScript 5.8.3 syntax/transpile pass covered **418/418 src+scripts `.ts/.tsx` files**. This verifies syntax/transpilation only. The project-level `tsc --noEmit` with the exact package dependency typings remains part of `production:verify`.

## Ranked balance evidence

`npm run ranked:verify` uses the exact server-certified pool. The final 2.97 audit ran 4,800 games, 800 per matchup across 8 seed strata, and returned 6 healthy / 0 watch / 0 critical / 6 stable.

## Runtime/integration verification

`npm run test:production-db` and `npm run production:verify` require the real PostgreSQL schema and installed dependencies. This environment cannot substitute static parsers for those checks.
