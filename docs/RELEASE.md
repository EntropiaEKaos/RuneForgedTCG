# RuneForge 2.97 release process

## Local candidate evidence

The source candidate has passed executable behavioral regression, static/source audits, static schema guards, import checks and the certified Alpha journeys. Ranked has separate balance evidence and remains fail-closed at runtime unless a deployment explicitly opts in.

## Public Alpha clean-deployment gate

The free public Alpha is promoted independently from Ranked and real-money payments.

The authoritative clean-deployment proof is:

`.github/workflows/alpha-release-candidate.yml`

For every relevant push to `main`, and on manual dispatch, the workflow certifies the **exact merge SHA** with:

- Node 22.23.2;
- clean registry-backed `npm ci`;
- lock/runtime reproducibility;
- fresh PostgreSQL 17 bootstrap;
- `npm run production:verify`;
- the built application running through `next start`;
- persisted Alpha HTTP journey;
- real two-browser Casual PvP journey;
- Alpha visual journey;
- public readiness evidence for all seven Alpha capabilities.

The workflow runs with:

```env
RUNEFORGE_RELEASE=2.97.0
RUNEFORGE_DEPLOY_SHA=<exact 40-character commit SHA>
RUNEFORGE_DEPLOY_ENV=alpha
RANKED_RELEASE_CERTIFIED=false
```

A public Alpha candidate is acceptable only when the exact merge SHA has a green **Alpha Release Candidate** run and the uploaded `artifacts/alpha-release-candidate/manifest.json` reports `passed: true`.

See `docs/ALPHA-RELEASE-CANDIDATE-1-0.md`.

## Equivalent operator verification

On a registry-connected machine with a fresh PostgreSQL deployment, the equivalent operator sequence starts with:

```bash
npm ci
npm run db:bootstrap
RUNEFORGE_RELEASE=2.97.0 RUNEFORGE_DEPLOY_SHA=<exact-40-char-sha> RUNEFORGE_DEPLOY_ENV=alpha RANKED_RELEASE_CERTIFIED=false npm run production:verify
```

Then start the production build and run the launch-scope journeys against it:

```bash
npm start
npm run test:e2e:alpha-journey
npm run test:e2e:marketplace
node scripts/alpha-casual-pvp-journey.mjs
node scripts/alpha-visual-journey.mjs
npm run alpha:release-evidence
```

The GitHub Actions gate is preferred because it binds the evidence to the repository SHA and uploads the manifest/screenshots automatically. `release:preflight` also rejects a malformed deploy SHA and, inside GitHub Actions, rejects any `RUNEFORGE_DEPLOY_SHA` that differs from `GITHUB_SHA`.

The running deployment exposes `GET /api/public/game/deployment/provenance`. That endpoint must report the same exact SHA and a bounded environment identity (`ci`, `preview`, `alpha`, `staging` or `production`); invalid or missing provenance returns HTTP 503. See `docs/PUBLIC-DEPLOYMENT-PROVENANCE-1-0.md`.

## P2P Marketplace gate

Marketplace 1.0 is part of the Alpha candidate only when the per-copy ownership migration and its economy certifications pass.

Fresh databases apply `drizzle/0043_p2p_marketplace.sql` through `db:bootstrap`. Existing certified databases apply it through `db:upgrade` under the shared schema advisory lock.

`production:verify` includes Marketplace PostgreSQL integrity checks. Pull-request CI additionally runs the built-server `test:e2e:marketplace` journey, including two concurrent buyers racing for the same listing and a complete escrowed card-for-card trade. Exactly one concurrent buyer may succeed.

The Marketplace release boundary is intentionally internal: player-to-player sales use RuneForge Gold only, Dust is non-transferable, direct trades are card-for-card, and there is no cash-out path. See `docs/P2P-MARKETPLACE-1.0.md`.

## Ranked activation is a separate decision

Ranked is not required for the public Alpha.

Only when Ranked itself is being promoted should the exact deploy artifact additionally run:

```bash
npm run production:verify
npm run ranked:verify
```

After both commands pass in the final Ranked environment, enable Ranked deliberately:

```env
RUNEFORGE_RELEASE=2.97.0
RANKED_RELEASE_CERTIFIED=true
```

Then rerun deployment verification and HTTP smoke tests against the deployed PostgreSQL instance.

## Real-money payments are also separate

Mercado Pago database/idempotency hardening remains part of production safety verification, but the public Alpha does not require live provider credentials or provider-network E2E.

Do not accept real money until sandbox/production credentials and provider E2E are separately certified.

## Why the shipped example is false

`.env.production.example` intentionally ships `RANKED_RELEASE_CERTIFIED=false`. A source ZIP, passing balance simulation, or normal pull-request CI is not enough to bypass the SHA-bound clean-deployment gate.


## Netlify deployment

The repository Netlify path is certified rather than a plain framework build.

`netlify.toml` binds the Git build `COMMIT_REF` to `RUNEFORGE_DEPLOY_SHA` and runs `npm run production:verify`. Production/deploy-preview/branch-deploy contexts set a bounded deploy environment. The exact non-secret SHA/environment are also embedded into the server build so deployment provenance remains available when Git metadata is build-only at runtime.

A Netlify deploy is still not accepted as public Alpha evidence until the deployed HTTPS origin passes the external launch smoke/provenance checks.

See `docs/NETLIFY-CERTIFIED-DEPLOYMENT.md`.

## Recovery credential boundary

Recovery keys are no longer persisted automatically in browser Web Storage. New/rotated keys use a one-time copy/download handoff; explicit recovery can replace a temporary guest session and rotates the credential on success.

See `docs/PLAYER-RECOVERY-SECURITY-2-0.md`.
