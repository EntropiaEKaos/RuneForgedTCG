# Public Deployment Provenance 1.0

## Purpose

The public Alpha release gate proves that a particular RuneForge commit is launchable. Public Deployment Provenance 1.0 closes the next operational gap: a running server must also be able to prove **which exact Git commit it is serving**.

The contract is provider-neutral. It does not depend on Vercel, AWS, Fly.io, Render, Railway, Kubernetes or any other host.

## Required deployment identity

Release verification requires two server-only variables:

```env
RUNEFORGE_DEPLOY_SHA=<40-character Git commit SHA>
RUNEFORGE_DEPLOY_ENV=<ci|preview|alpha|staging|production>
```

`RUNEFORGE_DEPLOY_SHA` must be a full 40-character hexadecimal commit SHA.

When verification runs inside GitHub Actions, `RUNEFORGE_DEPLOY_SHA` must match `GITHUB_SHA` exactly. This prevents a workflow from certifying one commit while the application claims to be another.

## Public endpoint

`GET /api/public/game/deployment/provenance`

Successful response:

```json
{
  "ok": true,
  "deployment": {
    "schemaVersion": 1,
    "release": "2.97.0",
    "engineVersion": "2.96.0",
    "rulesetVersion": "2026.08.96",
    "contentVersion": "2026.08.25.93",
    "commitSha": "<40-char sha>",
    "commitShort": "<12-char sha>",
    "environment": "alpha"
  }
}
```

The endpoint is always `no-store`.

If deployment identity is missing or invalid it returns HTTP 503 instead of inventing a fallback SHA.

## Security boundary

The endpoint exposes only immutable release identity:

- application release;
- engine/rules/content versions;
- exact Git commit;
- bounded deployment environment name.

It never exposes database addresses, administrator state, credentials, secrets, payment configuration, tokens or control-plane data.

## Alpha Release Candidate integration

The Alpha Release Candidate workflow sets:

```env
RUNEFORGE_DEPLOY_SHA=${{ github.sha }}
RUNEFORGE_DEPLOY_ENV=alpha
```

Its evidence manifest now queries the public provenance endpoint and requires:

- HTTP 200;
- `Cache-Control: no-store`;
- API commit SHA = `GITHUB_SHA`;
- API commit SHA = `RUNEFORGE_DEPLOY_SHA`;
- environment = `alpha`;
- release = package version.

This binds the release evidence, runtime response and GitHub workflow to one exact commit.

## Deployment rule

A production/Alpha operator should never manually type an arbitrary SHA when automation can inject the checked-out source revision.

The deployment platform should map its immutable source revision to `RUNEFORGE_DEPLOY_SHA` and set the intended bounded environment explicitly.
