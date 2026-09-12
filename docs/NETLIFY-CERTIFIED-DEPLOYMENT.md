# Netlify Certified Deployment Contract

## Why this exists

The old `netlify.toml` called `npm run build` directly. That allowed a hosting path to bypass RuneForge release preflight, PostgreSQL verification, Ranked fail-closed checks and source/runtime gates.

Netlify is now fail-closed.

## Build identity

Netlify exposes `COMMIT_REF` during Git builds. The build command binds it to RuneForge's canonical deploy identity:

```bash
RUNEFORGE_DEPLOY_SHA=$COMMIT_REF npm run production:verify
```

Deploy contexts set:

- production → `RUNEFORGE_DEPLOY_ENV=production`;
- deploy-preview → `RUNEFORGE_DEPLOY_ENV=preview`;
- branch-deploy → `RUNEFORGE_DEPLOY_ENV=preview`.

All other production secrets/configuration remain outside source control and must be configured in the host.

## Runtime provenance

Netlify's Git `COMMIT_REF` is a build variable, not a general read-only Functions runtime variable.

RuneForge therefore embeds only the non-secret release identity produced during the certified build:

- `RUNEFORGE_BUILD_SHA`;
- `RUNEFORGE_BUILD_ENV`.

`readDeploymentProvenance()` still prefers explicit runtime `RUNEFORGE_DEPLOY_SHA` / `RUNEFORGE_DEPLOY_ENV` when present. The embedded values are a fallback for hosting platforms where Git metadata is build-only.

No secret is embedded.

## Required hosting configuration

A real deploy still requires the same production settings used by release preflight, including:

- PostgreSQL;
- player/admin session secrets;
- MFA/payment encryption keys;
- HTTPS application URL;
- proxy policy;
- Ranked certification flag;
- durable asset storage configuration.

If any required production setting is missing or unsafe, `production:verify` fails and Netlify must not publish the deploy.

## Public proof

After deploy, `GET /api/public/game/deployment/provenance` must return the exact deployed Git SHA and expected environment with HTTP 200 and `Cache-Control: no-store`.

Invalid provenance remains HTTP 503.
