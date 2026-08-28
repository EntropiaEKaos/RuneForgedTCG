# RuneForge 2.97.0 — Ranked Certification & Production Hardening

RuneForge 2.97 closes the competitive Ranked launch architecture instead of merely removing a feature flag. Ranked now uses a small immutable, server-authoritative preconstructed deck pool with frozen season/content provenance, authoritative replay settlement and a dedicated multi-stratum balance gate.

## Playable alpha quick start

Requirements: Node.js 22 or 24, npm 10 or 11, and Docker Desktop with Compose.

```bash
npm ci
npm run alpha:setup
npm run dev
```

Open `http://127.0.0.1:3000`, choose **Play Now**, select a deck and enter the Nexus. `alpha:setup` creates an ignored `.env.local`, starts a persistent PostgreSQL 17 container and bootstraps a fresh RuneForge 2.97 schema. Running it again preserves the alpha database and verifies its schema version.

The local alpha keeps Ranked and real-money payments disabled. The admin login defaults are documented in `.env.example` and are strictly for local development.

Run the complete dependency-independent alpha gate with:

```bash
npm run alpha:verify
```

## Current release status

- PvE / Casual PvP / Studio / Vanilla / Forge / Draft: candidate GO after clean deployment verification.
- Ranked code + balance candidate: **PASS** for the `season-zero-r1` certified pool.
- Ranked production activation remains **fail-closed by default** (`RANKED_RELEASE_CERTIFIED=false`) until the clean deployment machine completes the official dependency/toolchain/PostgreSQL release gate and deliberately switches it to `true`.
- Mercado Pago: implementation is present and hardened; validate production/sandbox credentials and complete provider E2E before accepting real money.

## Ranked 2.97 architecture

Season Zero Ranked accepts exactly four certified 40-card preconstructed decks:

- Tidecall Control — Ranked
- Voidborn Dread — Ranked
- Tempestade Iminente — Ranked
- Aliança da Forja do Trovão — Ranked

Custom/player-authored decks remain available in Casual but are rejected server-side from Ranked. The certification versions are:

- Ranked rules: `2026.08.97`
- Ranked deck pool: `season-zero-r1`
- Engine: `2.96.0`
- Engine ruleset: `2026.08.96`
- Database schema: `2.97`

Each Ranked room snapshots the season, certified deck fingerprints, exact deck lists, content definitions/content hash, engine rules and match options. Actions and settlement execute against the immutable room content snapshot rather than the mutable global registry.

## Ranked balance evidence

The final 2.97 audit was rerun from the source tree shipped in this package:

- 4 certified decks / 6 pairwise matchups;
- 800 games per matchup across 8 deterministic seed strata;
- **4,800 completed games**;
- health score **100**;
- **6 healthy / 0 watch / 0 critical**;
- first-player win rate **50.4%**;
- **6/6 stable** matchups;
- maximum seed-stratum deviation **11.1 percentage points** (limit 15);
- matchup range **46.2%–54.5%**;
- Ranked balance gate: **PASS**.

See `BALANCE_AUDIT_2.97.json` and `docs/AUDIT_2.97.md`.

## Test evidence taxonomy

RuneForge does not mix source-text checks with behavioral evidence:

- `npm run test:behavior` — executable product behavior only.
- `npm run audit:source-contracts` — static source/configuration contracts; useful lint, **not behavioral proof**.
- `npm run audit:schema-static` — static SQL/Drizzle structural guards; PostgreSQL execution remains authoritative.
- `npm run audit:test-taxonomy` — prevents source-reading tests from being counted as behavioral.

Final local evidence in this environment:

- **35/35 behavioral targets PASS**;
- **41/41 legacy source-contract audits PASS**, reported separately;
- **28/28 current 2.97 source contracts PASS**, reported separately;
- local imports **432 files PASS**;
- TypeScript syntax/transpile **418/418 src+scripts PASS** with global TypeScript 5.8.3 — this is **not** the full project typecheck;
- schema static parity **92 indexes / 32 FK contracts**;
- fresh schema static model **60 tables / 627 columns / 41 SQL FKs**;
- semantic static model **6 Drizzle FKs / 14 named CHECKs / 10 named indexes**.

## Production verification boundary

This repository includes the reviewed npm lockfile. A production activation still requires a clean registry-connected machine and real PostgreSQL:

```bash
npm ci
npm run production:verify
npm run ranked:verify
```

Only after those commands pass should production set:

```env
RUNEFORGE_RELEASE=2.97.0
RANKED_RELEASE_CERTIFIED=true
```

The shipped `.env.production.example` keeps `RANKED_RELEASE_CERTIFIED=false` deliberately so an unverified deployment cannot accidentally enable Ranked.

See `docs/RELEASE.md`, `docs/TESTING.md`, `docs/SECURITY.md` and `docs/ARCHITECTURE.md`.
