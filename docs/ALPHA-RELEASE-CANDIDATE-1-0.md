# Public Alpha Release Candidate 1.0

## Purpose

RuneForge already has a CI-certified playable Alpha and a public readiness endpoint. The remaining launch boundary was operational: the repository still required a **clean deployment verification** before calling PvE, Casual PvP, Studio, Vanilla, Forge and Draft a public Alpha GO.

Public Alpha Release Candidate 1.0 turns that requirement into a reproducible, SHA-bound GitHub Actions gate.

## Workflow

`.github/workflows/alpha-release-candidate.yml` runs on relevant pushes to `main` and can also be started manually.

It certifies the **exact merge SHA** in a clean Ubuntu runner with:

1. Node 22.23.2;
2. a clean registry-backed `npm ci`;
3. the reviewed lock/runtime reproducibility gate;
4. fresh PostgreSQL 17 bootstrap;
5. the full `production:verify` gate;
6. the production Next.js build started with `next start`;
7. the persisted Alpha HTTP journey;
8. the real two-browser Casual PvP journey;
9. the Alpha visual journey;
10. the public readiness endpoint and its seven advertised capabilities;
11. the public deployment-provenance endpoint bound to the exact GitHub SHA.

The workflow uploads `alpha-release-candidate-<sha>` evidence for 30 days.

## Evidence manifest

`scripts/alpha-release-candidate-evidence.mjs` writes:

`artifacts/alpha-release-candidate/manifest.json`

The manifest records the repository, exact commit SHA, run id, package version, public readiness payload, public deployment provenance and every gate assertion.

The release-candidate gate requires:

- HTTP 200 from `/api/public/game/alpha/readiness`;
- `Cache-Control: no-store`;
- runtime state `ready`;
- entry route `/play`;
- exactly seven capabilities:
  - onboarding;
  - deck selection;
  - mulligan;
  - authoritative PvE;
  - Forge + persisted decks;
  - rewards/progression;
  - Casual PvP;
- every capability available;
- API release version matching the package/release environment;
- HTTP 200 + `no-store` from `/api/public/game/deployment/provenance`;
- provenance commit SHA exactly matching both `GITHUB_SHA` and `RUNEFORGE_DEPLOY_SHA`;
- provenance environment exactly `alpha`.

## Deliberate launch boundaries

This gate certifies the public Alpha scope only.

**Ranked remains outside** the public Alpha launch requirement and stays fail-closed with:

`RANKED_RELEASE_CERTIFIED=false`

**Real-money payments remain outside** the public Alpha launch requirement. The existing local/database Mercado Pago safety probes can still run as part of production verification, but provider credentials and provider-network E2E are not prerequisites for the free Alpha.

Large-scale Live Ops is also outside the public Alpha launch requirement.

The public readiness manifest explicitly verifies all three boundaries and requires Ranked to remain operationally disabled during Alpha RC certification.

## Promotion rule

Do not call a commit the deployable public Alpha candidate merely because its pull request CI is green.

A candidate is launch-certifiable only when the **exact merge SHA** has a green `Alpha Release Candidate` workflow, its uploaded manifest reports `passed: true`, and the running provenance endpoint reports that same exact SHA.

See `docs/PUBLIC-DEPLOYMENT-PROVENANCE-1-0.md` for the provider-neutral runtime identity contract.

Ranked activation remains a separate later decision requiring its own release verification and balance gate.
