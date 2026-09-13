# Vercel Certified Deployment Contract

## Why this exists

A successful Vercel framework build is not, by itself, RuneForge release certification. The public Alpha depends on release preflight, PostgreSQL integrity, security boundaries, behavioral tests, Ranked fail-closed policy and an exact Git provenance identity.

Vercel therefore uses a dedicated fail-closed build adapter instead of calling `next build` directly.

## Immutable build identity

Vercel exposes Git and environment metadata as system environment variables. RuneForge consumes:

- `VERCEL_GIT_COMMIT_SHA` as the immutable source revision;
- `VERCEL_ENV` as the deploy context.

Only `production` and `preview` are accepted by the deploy adapter. The adapter binds those values to RuneForge's provider-neutral contract:

- `RUNEFORGE_DEPLOY_SHA`;
- `RUNEFORGE_DEPLOY_ENV`.

The SHA must be exactly 40 hexadecimal characters. Missing or malformed identity stops the build.

## Certified build paths

`vercel.json` routes every Vercel build through:

```text
node scripts/vercel-certified-build.mjs
```

The adapter selects the gate from the actual Vercel deploy context:

- `VERCEL_ENV=production` → `npm run production:verify`;
- `VERCEL_ENV=preview` → `npm run alpha:verify`.

Production remains fail-closed on the complete release path: release runtime/preflight checks, Ranked fail-closed verification, source/schema audits, typecheck, lint, the behavioral suite, PostgreSQL production probes and the real Next.js production build.

Preview deliberately uses the non-production Alpha verification path. It still certifies runtime/lock integrity, source/schema contracts, typecheck, lint, the behavioral suite and the production Next.js build, but it does not require production secrets or a production PostgreSQL database to be copied into pull-request environments.

The explicit RuneForge deploy identity is present while `next build` runs, so `next.config.ts` embeds only the non-secret fallback identity (`RUNEFORGE_BUILD_SHA` / `RUNEFORGE_BUILD_ENV`) for runtime provenance.

## Required Vercel production configuration

Production must provide the runtime configuration documented by `.env.production.example`, including:

- a reachable PostgreSQL `DATABASE_URL`;
- player/admin session secrets;
- MFA and payment encryption keys;
- an HTTPS `NEXT_PUBLIC_APP_URL`;
- proxy policy;
- Ranked certification flag;
- durable asset storage configuration for serverless production.

Preview may use its own isolated runtime resources when interactive preview behavior is desired, but the build gate never requires production credentials to be exposed to a PR deployment.

Secrets remain in Vercel environment configuration and are never committed to the repository.

## Public proof after deploy

A production deploy is not considered publicly certified until the live host satisfies all of the following:

1. `GET /api/health` succeeds over HTTPS.
2. `GET /api/public/game/alpha/readiness` returns HTTP 200 with Alpha state `ready`.
3. `GET /api/public/game/deployment/provenance` returns HTTP 200 and `Cache-Control: no-store`.
4. The provenance `commitSha` equals the exact Git SHA that Vercel deployed.
5. The provenance environment equals `production`.
6. A persistence smoke proves that the runtime is connected to the intended durable PostgreSQL database rather than ephemeral process state.

Preview provenance, when the preview runtime is configured, must similarly report the exact preview SHA with environment `preview`.

If deployment identity is unavailable or invalid, the provenance endpoint remains fail-closed with HTTP 503.
