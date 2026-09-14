# RuneForge Alpha — Visual 5.8 Certified Baseline

Date: `2026-09-14`

This is an append-only release-certification record for the exact merged `main` state after promotion of Visual 5.8. It does not replace the earlier 2026-09-14 engineering or executive reports; it advances the certified product baseline while preserving their historical decisions.

## Certified identity

- Repository: `EntropiaEKaos/RuneForgedTCG`
- Branch: `main`
- Certified SHA: `c9153d38255692eb4cde1fbcdc7f105d3d917dc8`
- Certified tree: `7fad25f2de7eeeeb7a9e7e563783c84df6f27a63`
- Parent baseline: `03d7b19b95d160a6351a442e87a0eacea5da7f0a`
- Release: `2.97.0`
- Engine: `2.96.0`
- Ruleset: `2026.08.96`
- Content: `2026.08.25.93`
- Product milestone: `#184 — Visual 5.8: premium deck builder workbench`

## Visual 5.8 promotion evidence

PR #184 was certified on exact head `d98ba7eadc83c51cd3bbcb817cbfad67864d0340` before merge.

The PR-head matrix completed green across CI, Alpha Starter Balance Evidence, Notebook Density, Mobile Responsive and all four Flagship Visual Cert workflows. The CI browser artifact was manually reviewed before promotion:

- `36-deck-builder-workbench.png`
- `37-deck-builder-composition.png`
- `deck-builder-visual-manifest.json`

The evidence proved a `1440x1000` workbench without horizontal overflow, a real playable catalog, and a local deck-composition transition from `0` to `3` distinct rows without saving, sharing or mutating a deck on the server.

The merge was performed by expected-head squash. The merged commit has the same tree as the certified PR head, so the squash changed commit identity but not repository contents.

## Exact-main post-merge certification

The merged SHA `c9153d38255692eb4cde1fbcdc7f105d3d917dc8` completed the full push-triggered certification matrix:

- Post-merge matrix: **9/9 workflows success**
- CI: `#1154` — success
- CI run id: `34870080608`
- Alpha Release Candidate: `#31` — success
- Alpha RC run id: `34870080650`
- Alpha Starter Balance Evidence — success
- Visual 4.2 Notebook Density Cert — success
- Visual 4.3 Mobile Responsive Cert — success
- Flagship Structures Visual Cert — success after one controlled rerun
- Flagship Mana Rituals Visual Cert — success
- Flagship Traps Visual Cert — success
- Flagship Starter Signatures Visual Cert — success

CI #1154 passed runtime/lock integrity, Ranked fail-closed, source/schema audits, typecheck, lint, PostgreSQL bootstrap, Marketplace, Mercado Pago exactly-once safety, Studio lifecycle/rollback, Super Admin security, behavioral tests, engine coverage, production PostgreSQL probes, production build, the complete HTTP/browser E2E journey and Alpha visual artifact upload.

## Flagship Structures runner incident

The first post-merge Flagship Structures attempt failed before its first screenshot because Chrome did not publish `DevToolsActivePort` within 30 seconds on that GitHub-hosted runner. The production build itself succeeded, all six deterministic Structure masters were generated, the Next.js server became ready, and there was no product assertion failure.

The failing browser script used the same shared Chrome bootstrap and launch arguments as the sibling flagship certificates, and the exact repository tree had already passed the same Structures certificate on the PR head. A controlled rerun of only the failed job was therefore performed with no code change.

The rerun passed typecheck, build, all six Codex + VER ARTE Structure captures and artifact upload. The incident is classified as a transient runner/browser bootstrap flake, not a reproduced RuneForge product regression.

## Alpha Release Candidate manifest

The exact-main Alpha RC artifact reports:

- gate: `Public Alpha Release Candidate 1.0`
- `passed: true`
- commit SHA: `c9153d38255692eb4cde1fbcdc7f105d3d917dc8`
- Alpha state: `ready`
- Alpha classification: `playable`
- exact seven public Alpha capabilities available
- entry route: `/play`
- Ranked remains operationally disabled
- real-money payments remain outside the initial Alpha launch requirement
- large-scale Live Ops remain outside the initial Alpha launch requirement
- deployment provenance in the certificate matches the exact workflow SHA

## Deployment-provider evidence

GitHub reports the Vercel commit status for the exact certified SHA as:

`success — Deployment has completed`

This proves that the provider accepted and completed a deployment for the exact SHA. It is not, by itself, independent proof that the public production hostname satisfies the runtime contract.

## External-network gate

A broad public announcement remains conditional on a fresh external-network smoke against the current public hostname. The required public proof is unchanged:

1. `GET /api/health` succeeds over HTTPS.
2. `GET /api/public/game/alpha/readiness` returns HTTP 200 and state `ready`.
3. `GET /api/public/game/deployment/provenance` returns HTTP 200 with `Cache-Control: no-store`.
4. Runtime provenance reports commit `c9153d38255692eb4cde1fbcdc7f105d3d917dc8`.
5. Runtime provenance reports environment `production`.
6. A persistence smoke proves durable PostgreSQL state rather than ephemeral process state.

The public hostname is intentionally not committed to the repository, so this record does not invent an external HTTP success from repository-only evidence.

## Decision

- Controlled / closed Alpha: **GO**
- Visual 5.8 baseline: **CERTIFIED**
- Broad public announcement: **GO CONDITIONAL** on the external-network production smoke above
- Public Ranked launch: **OUT OF SCOPE / FAIL-CLOSED**
- Next large product slice: should be selected from measured Alpha/player evidence rather than opened solely to continue the Visual 5.x numbering sequence
