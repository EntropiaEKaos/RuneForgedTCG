# RuneForge Alpha — Engineering Release Certification

**Date:** 2026-09-14  
**Repository:** `EntropiaEKaos/RuneForgedTCG`  
**Certified branch:** `main`  
**Certified SHA:** `cb0274f86da146e8079037dfaf51ef58c6d2671c`  
**Package release:** `2.97.0`  
**Engine:** `2.96.0`  
**Ruleset:** `2026.08.96`  
**Content:** `2026.08.25.93`

## Executive engineering result

**PASS — the current `main` is a certified Public Alpha release candidate.**

This report supersedes the 2026-09-12 baseline as the latest engineering certification while preserving the older reports as immutable historical evidence.

The certified SHA includes the promoted Visual 5.0 cinematic identity and Visual 5.1 metagame premium passes, the latest Vanilla balance work through 1.11, the collectible cosmetic printing system, production deployment hardening, Studio baseline synchronization and the previously certified multiplayer/economy/security stack.

No release conclusion in this report is inferred from a PR-only head. The evidence below was rerun after merge against the exact `main` SHA above.

---

## 1. Exact-main certification matrix

Nine push workflows executed on `cb0274f86da146e8079037dfaf51ef58c6d2671c` and completed successfully:

| Gate | Run | Result |
|---|---:|---|
| CI | `#1116` | PASS |
| Alpha Release Candidate | `#24` | PASS |
| Alpha Starter Balance Evidence | `#244` | PASS |
| Visual 4.2 Notebook Density Cert | `#62` | PASS |
| Visual 4.3 Mobile Responsive Cert | `#36` | PASS |
| Flagship Structures Visual Cert | `#378` | PASS |
| Flagship Mana Rituals Visual Cert | `#375` | PASS |
| Flagship Traps Visual Cert | `#373` | PASS |
| Flagship Starter Signatures Visual Cert | `#371` | PASS |

The Vercel commit status for the same SHA also completed successfully with `Deployment has completed`.

### CI #1116 coverage

The exact-main CI completed all production gates, including:

- runtime and dependency-lock reproducibility;
- Ranked release gate with public Ranked still fail-closed;
- local import integrity;
- test taxonomy guard;
- static source/schema audits;
- Card Studio structure guard;
- TypeScript typecheck and lint;
- fresh PostgreSQL bootstrap;
- Portal CMS + Marketplace PostgreSQL certification;
- Mercado Pago exactly-once / financial-state certification;
- Studio publish/catalog/deck/engine lifecycle;
- Studio modal ability save/reload/sandbox/engine lifecycle;
- immutable Studio version rollback;
- Super Admin step-up/rate-limit/security checks;
- complete behavioral suite;
- behavioral engine coverage gate;
- production PostgreSQL behavior/integrity/concurrency probes;
- production Next.js build;
- HTTP/browser E2E covering Alpha journey, Marketplace, Studio authoring, recovery, Ranked fail-closed, Casual matchmaking, two-browser PvP and DTO isolation;
- Alpha Visual Journey artifact upload.

Result: **PASS**.

---

## 2. Alpha Release Candidate #24

The SHA-bound release-candidate workflow completed successfully and produced the artifact:

- artifact: `alpha-release-candidate-cb0274f86da146e8079037dfaf51ef58c6d2671c`;
- artifact id: `10329496988`;
- digest: `sha256:86ddf3cbf8184ba4244a7452bde74b6ca4bfcd53e1e1b4ec7082372be2fbc6db`.

The release manifest reports:

- `passed: true`;
- exact workflow SHA: `cb0274f86da146e8079037dfaf51ef58c6d2671c`;
- Alpha state: `ready`;
- Alpha classification: `playable`;
- entry route: `/play`;
- package release: `2.97.0`;
- Ranked operational: `false`.

### Seven certified Alpha capabilities

All seven required public-Alpha capabilities were reported as available:

1. guided first access / onboarding;
2. deck selection;
3. mulligan;
4. authoritative PvE match;
5. Forge + persisted decks;
6. persisted rewards/progression;
7. authoritative Casual PvP.

### RC manifest checks

All 22 release-manifest checks passed, including:

- readiness request HTTP 200;
- readiness `no-store`;
- valid public readiness envelope;
- runtime `state=ready`;
- `/play` entry route;
- release/package parity;
- exact seven capabilities and all available;
- Ranked not required for initial Alpha and still operationally disabled;
- real-money payments not required for initial Alpha;
- large-scale Live Ops not required for initial Alpha;
- provenance HTTP 200;
- provenance `no-store`;
- valid public provenance envelope;
- provenance commit equal to the exact workflow SHA;
- provenance commit equal to configured deploy SHA;
- provenance environment/release consistency.

The RC also completed `production:verify`, launched the exact production build and certified the public Alpha scope before uploading its evidence.

---

## 3. Deployment certification

The Vercel status attached to the exact `main` commit moved to:

`success — Deployment has completed`

Production deployment hardening from the previously resolved release blocker remains in force:

- certified Vercel build adapter;
- exact deploy SHA binding;
- production `production:verify` fail-closed gate;
- persistent Neon PostgreSQL;
- durable S3/CloudFront-backed asset storage;
- deployment provenance contract;
- no weakening of Ranked, database, economy or security gates.

### External-network observation caveat

During this review, the automation environment used to prepare this report could not resolve the canonical public hostname through its own DNS path. Therefore this report does **not** invent an independent external `curl` success for the new SHA.

That observation is separated from product status:

- Vercel reports successful completion for the exact SHA;
- the SHA-bound Alpha RC passes its readiness/provenance contract;
- the production build gate passes;
- the previous production-host certification and durable infrastructure blocker are already resolved.

For a broad public announcement, a fresh smoke from an ordinary external network should still confirm `/api/health`, Alpha readiness and deployment provenance on the currently deployed SHA. This is an operational observation step, not a known code defect.

---

## 4. Visual baseline now certified in `main`

### Visual 5.0 — Cinematic Identity

Promoted through PR #175 after exact-head certification. It deepens deck/region arena identity using existing presentation state without introducing gameplay authority.

### Visual 5.1 — Metagame Premium

Promoted through PR #176 and then recertified on merged `main`.

Certified player-facing destinations:

- Collection;
- Forge;
- Modes;
- Profile;
- Codex.

Visual 5.1 remains presentation-only and did not modify engine rules, reducer authority, PvP/Ranked protocols, backend APIs, database schema or economy behavior.

### Post-merge Alpha Visual Journey

Exact-main CI produced:

- artifact: `alpha-visual-journey-cb0274f86da146e8079037dfaf51ef58c6d2671c`;
- artifact id: `10329522241`;
- digest: `sha256:6c57eb7fb4901c85dbc251ec0957f27134393a076d18837147b80a6332d4e79e`.

Notebook and mobile-specific workflows also passed independently after merge.

---

## 5. Gameplay / balance baseline

The certified Alpha baseline includes the evidence-first Vanilla balance program through **Vanilla 1.11**.

Notable latest changes:

- Vanilla 1.10 promoted the Emberhold Ascendant `resilient-pressure` recipe after deterministic screening and full-matrix validation;
- Vanilla 1.11 promoted one narrowly scoped Florestia CardDef override: `van_forest_u04` health `3 -> 4`, with no cost, power, race or effect change;
- the Alpha Starter Balance Evidence workflow remains green after the later visual work.

Human meta telemetry remains necessary after real testers enter. Automated balance evidence reduces launch risk but is not a substitute for live player behavior.

---

## 6. Systems added or materially hardened since the 2026-09-12 report

The earlier report remains historically correct for its certified SHA. Since then, `main` gained and certified:

- automated Ranked release certification while keeping public Ranked fail-closed;
- Ranked R2 provenance alignment;
- Vercel exact-SHA certified deployment adapter;
- production Neon connection-timeout hardening;
- durable production asset-storage certification;
- Studio certified-baseline synchronization for fresh/existing databases;
- card cosmetic variants with serialized collectible copies;
- cosmetic pack reveal / marketplace printing identity polish;
- activated-ability stack resolution and counter-cost commitment fixes;
- Vanilla 1.9 floor convergence;
- Vanilla 1.10 Emberhold Ascendant recovery;
- Vanilla 1.11 Florestia floor CardDef correction;
- responsive notebook/mobile battlefield certification from Visual 4.0 through 4.4;
- Visual 5.0 cinematic arena identity;
- Visual 5.1 premium metagame presentation.

---

## 7. Release boundaries

The following remain intentionally outside the initial Alpha requirement:

- public Ranked activation;
- real-money payment launch;
- large-scale Live Ops / commercial-scale rollout.

Their exclusion is intentional, tested and represented in release contracts rather than being hidden unfinished work.

---

## 8. Residual risks

### Human balance / meta discovery

**Status: accepted Alpha risk.**

Mitigation: collect win rate, pick/play rate, matchup and retention telemetry from controlled cohorts before another numerical balance slice.

### Economy emergence

**Status: accepted Alpha risk.**

Transactional correctness is certified; price formation and wealth concentration require actual users.

### Production observability under sustained usage

**Status: controlled rollout risk.**

The production deploy is certified, but logs, latency and failure rates should be observed under a real cohort before scale increases.

### External smoke on current public hostname

**Status: final operational confirmation for broad announcement.**

No current code failure is known. A network outside the certification environment should confirm health/readiness/provenance for the newly deployed exact SHA.

---

## 9. Engineering decision

### Code / engine / data contracts

**GO**

### Production build / deploy pipeline

**GO**

### Controlled / closed Alpha

**GO**

### Broad public Alpha announcement

**GO CONDITIONAL** on one fresh external-network runtime smoke confirming the current public host serves `cb0274f86da146e8079037dfaf51ef58c6d2671c` and reports healthy readiness/provenance.

### Ranked public launch

**OUT OF SCOPE / FAIL-CLOSED**

---

## 10. Next engineering posture

The project should not add another large preventive feature before the controlled Alpha cohort begins.

The preferred next loop is:

1. external runtime smoke of the current deployed SHA;
2. controlled player cohort;
3. collect real telemetry on onboarding, match completion, second-session retention, balance, marketplace and recovery;
4. fix only demonstrated blockers/regressions;
5. choose the next balance/content slice from measured player evidence rather than inventing a pre-launch feature backlog.

This SHA is the current engineering baseline for that loop.
