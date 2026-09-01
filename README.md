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

Run the dependency-independent source/build gate with:

```bash
npm run alpha:verify
```

After `alpha:setup`, run the complete playable-alpha certification with:

```bash
npm run alpha:certify
```

`alpha:certify` reruns the alpha verification gates, starts the production build locally and executes a real HTTP player journey against the persistent PostgreSQL database: account creation → catalog → Forge deck persistence → server-issued PvE token → complete authoritative match replay/settlement → exactly-once XP/gold/dust rewards → profile progression → account recovery with the same persisted deck and balances.

## Current release status

- PvE / Casual PvP / Studio / Vanilla / Forge / Draft: candidate GO after clean deployment verification.
- Playable Alpha journey: certified in CI only when the full persisted HTTP journey passes after the production build.
- Ranked code + balance candidate: **PASS** for the `season-zero-r1` certified pool.
- Ranked production activation remains **fail-closed by default** (`RANKED_RELEASE_CERTIFIED=false`) until the clean deployment machine completes the official dependency/toolchain/PostgreSQL release gate and deliberately switches it to `true`.
- Mercado Pago: implementation is present and hardened; validate production/sandbox credentials and complete provider E2E before accepting real money.

## Certified engineering ledger

Final engineering outcomes are recorded here from Vanilla 1.0 onward. Detailed design/audit documents remain under `docs/`.

### Vanilla 1.0 — Content Baseline & Balance Lab Intake

- **429 code-authored Vanilla cards** are frozen as the current content baseline.
- The dedicated experimental wave contains **180 `van_*` cards** across the six regions.
- The Balance Lab intake contains **12 experimental 40-card decks**, exactly **2 per region**.
- The 12-deck pool covers **180/180 experimental cards**; an orphaned experimental card blocks the gate.
- A new deterministic audit measures catalog region/type/rarity distribution, regional identity tiers, semantic archetypes, per-deck type mix, mana curve, average cost, copies, missing references and region legality.
- The audit is fail-closed and is also part of the behavioral suite as the **77th behavioral target**.
- No card numbers are changed in this baseline step. The next step is **Vanilla 1.1 — Balance Lab Experimental Matrix**, reusing the existing 2.97 simulation/statistics infrastructure before any rebalance.

Run the baseline report with:

```bash
node --import tsx scripts/vanilla-content-audit.ts --enforce
```

See `docs/VANILLA-1-0-CONTENT-BASELINE.md`.

### Vanilla 1.1 — Balance Lab Experimental Matrix

- The 12 experimental decks remain isolated from Ranked and are injected into the existing real-engine balance simulator through deck overrides.
- The certified intake matrix covers **66/66 pairwise matchups**: 6 same-region and 60 cross-region.
- The initial full run executed **13,200 games**: 200 per matchup, split across 5 deterministic independent seed strata.
- Simulation quality passed: **66/66 stable matchups**, zero incomplete matchups, zero pool errors, **49.9% first-player win rate**, **0% draws**, average **10.6 rounds**, maximum seed deviation **18.5 pp** against a **23.7 pp** quality threshold.
- Balance itself is deliberately reported separately and is **BLOCKED**: **9 healthy / 5 watch / 52 critical** matchups.
- Strongest deck: **Tidecall Vanguard — 85.5%** over 2,200 games. Weakest deck: **Florestia Ascendant — 21.4%** over 2,200 games.
- Most extreme matchup: **Tidecall Vanguard 97.5% × 2.5% Florestia Ascendant** over 200 games.
- The dominant pattern is structural: Vanguard recipes generally outperform Ascendant recipes. This points the next engineering slice toward deck/AI utilization telemetry before card-stat rebalance.
- The simulator contract is now the **78th behavioral target**; the 13,200-game matrix stays a reproducible heavyweight audit instead of slowing every normal CI run.
- No experimental deck is promoted to Ranked and no card stat/cost is changed by Vanilla 1.1.

Run the matrix with:

```bash
npm run audit:vanilla-balance
```

See `docs/VANILLA-1-1-BALANCE-LAB.md`.

### Vanilla 1.2 — Utilization Telemetry

- The Balance Lab now has an **opt-in, read-only telemetry path**; the historical `runBalanceSimulation()` contract remains unchanged.
- An executable A/B contract runs the same deterministic simulation with and without telemetry and requires an identical `SimulationSummary`, proving the instrument does not change match outcomes.
- The diagnostic matrix covered **66/66 matchups and 3,960 games** across 3 deterministic strata, with zero pool errors, zero telemetry errors and zero incomplete matchups.
- Vanguard finished at **70.1%** aggregate win rate versus **29.9%** for Ascendant in this diagnostic run, a **40.2 pp** gap.
- Vanguard played **11.8 cards/game** versus **9.7**, ended with **2.7 cards** in hand versus **5.3**, dealt **22.8 Nexus damage/game** versus **11.9**, and summoned **10.8 allies/game** versus **4.3**.
- Ascendant accumulated **54,416 target-starved samples** versus **11,439** for Vanguard and **26,491 ignored-playable samples** versus **10,251**.
- Both families recorded **0 `policyUnsupportedSamples`**: there is no evidence of a simple missing semantic-card-type implementation. The friction is concentrated in targeting, timing, composition and action prioritization.
- The signal appears under both `player-heuristic` and `ai-core`; `ai-core` is especially prone to ending turns while a telemetry-playable card remains available.
- Highest-priority target-starved examples include **Prisão de Gelo, Tridente da Lua Azul, Prisão Elétrica, Foice do Último Suspiro, Asas de Relâmpago, Juramento da Forja, Pele de Carvalho** and **Pele da Matilha**.
- Vanilla 1.2 therefore **does not buff/nerf cards**. The next slice is **Vanilla 1.3 — Tactical Coverage & Playability Friction**, which must reproduce and classify these failures before recipe/curve/stat changes.
- The non-invasive telemetry contract is the **79th behavioral target**; the 3,960-game matrix remains an explicit heavyweight audit.

Run the telemetry matrix with:

```bash
npm run audit:vanilla-utilization
```

See `docs/VANILLA-1-2-UTILIZATION-TELEMETRY.md`.

### Vanilla 1.3 — Tactical Coverage & Playability Friction

- The historical `ai-core` priority tree remains untouched; the public `ai.ts` facade only invokes a narrow tactical fallback after the certified core returns `null`.
- The fallback closes reproduced main-phase gaps for `frostbite`, `stun`, `recall`, `killUnit`, nonlethal Nexus damage, `poison`, `mill`, `buffAllies`, `buffRace` and `grantKeyword`.
- Target selection reuses the canonical `spellNeedsTarget()` + `isValidTarget()` contracts, respects ownership/Hexproof and fails closed when no legal target exists.
- Semantic usefulness guards prevent no-op spending: no repeated Frostbite/Stun/keyword grants, no empty global buffs and no racial buff without a matching ally.
- The repeated **3,960-game utilization matrix** passed with zero pool/telemetry/incomplete errors. Ascendant cards played rose **9.7 → 10.4/game**, final hand fell **5.3 → 4.8**, and `ignored-playable` fell **26,491 → 12,610 (-52.4%)**.
- The key isolation signal is policy-specific: Ascendant `player-heuristic` end-turn-with-playable stayed essentially flat (**16.9% → 17.1%**), while `ai-core` fell **53.5% → 28.1%**. The correction therefore acts where the diagnosed gap actually existed.
- The full **13,200-game Balance Lab** also remained statistically valid: **66/66 stable**, first-player win rate **49.8%**, draw rate **0%**, average **10.6 rounds**, quality gate **PASS**.
- Balance remains deliberately **BLOCKED** at **8 healthy / 8 watch / 50 critical**. Tidecall Ascendant improved **45.0% → 50.0%** and Voidborn Ascendant **27.7% → 29.5%**, but the other Ascendant recipes remain structurally weak.
- This proves the AI gap was real but not the sole cause of Vanguard dominance. The next slice is **Vanilla 1.4 — Ascendant Recipe & Curve Reconstruction**, before any card-stat rebalance.
- Vanilla 1.3 changes no card costs/stats/text, no experimental recipe, no authoritative rules and no Ranked pool. Its executable regression is the **80th behavioral target**.

See `docs/VANILLA-1-3-TACTICAL-PLAYABILITY.md`.

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
- `npm run test:e2e:alpha-journey` — real HTTP/PostgreSQL certification of the core Alpha player loop against a running production build.

Current behavioral certification after Vanilla 1.3 contains **80 behavioral targets**. Source-contract, schema, database, build and browser E2E evidence remain separate gates in the full CI pipeline.

Historical 2.97 local evidence retained for provenance:

- **35/35 behavioral targets PASS** at the original 2.97 certification point;
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
