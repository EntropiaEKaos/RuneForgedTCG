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

## Certified build path

`vercel.json` routes the platform build through:

```text
node scripts/vercel-certified-build.mjs
```

The adapter then executes:

```text
npm run production:verify
```

That gate includes release runtime/preflight checks, Ranked fail-closed verification, source/schema audits, typecheck, lint, the behavioral suite, PostgreSQL production probes and the real Next.js production build.

The explicit RuneForge deploy identity is present while `next build` runs, so `next.config.ts` embeds only the non-secret fallback identity (`RUNEFORGE_BUILD_SHA` / `RUNEFORGE_BUILD_ENV`) for runtime provenance.

## Required Vercel configuration

Production and any Preview environment intended to pass this gate must provide the same required runtime configuration documented by `.env.production.example`, including:

- a reachable PostgreSQL `DATABASE_URL`;
- player/admin session secrets;
- MFA and payment encryption keys;
- an HTTPS `NEXT_PUBLIC_APP_URL` appropriate for the environment;
- proxy policy;
- Ranked certification flag;
- durable asset storage configuration for serverless production.

Secrets remain in Vercel environment configuration and are never committed to the repository.

## Public proof after deploy

A deploy is not considered publicly certified until the live host satisfies all of the following:

1. `GET /api/health` succeeds over HTTPS.
2. `GET /api/public/game/alpha/readiness` returns HTTP 200 with Alpha state `ready`.
3. `GET /api/public/game/deployment/provenance` returns HTTP 200 and `Cache-Control: no-store`.
4. The provenance `commitSha` equals the exact Git SHA that Vercel deployed.
5. The provenance environment equals the expected `production` or `preview` context.
6. A persistence smoke proves that the runtime is connected to the intended durable PostgreSQL database rather than ephemeral process state.

If deployment identity is unavailable or invalid, the provenance endpoint remains fail-closed with HTTP 503.
