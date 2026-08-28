# RuneForge 2.97 release process

## Local candidate evidence

The source candidate has passed executable behavioral regression, static/source audits, static schema guards, import checks and the 4,800-game Ranked balance certification. Ranked remains fail-closed at runtime unless the deployment explicitly opts in.

## Required clean deployment sequence

On a registry-connected machine with PostgreSQL configured:

```bash
npm run lock:refresh
# review and commit the generated package-lock.json
npm ci
RUNEFORGE_RELEASE=2.97.0 RANKED_RELEASE_CERTIFIED=false npm run production:verify
npm run ranked:verify
```

After both commands pass on the exact deploy artifact, enable Ranked deliberately:

```env
RUNEFORGE_RELEASE=2.97.0
RANKED_RELEASE_CERTIFIED=true
```

Then rerun the deployment preflight/production verification with the final environment and perform HTTP E2E/smoke tests against the deployed PostgreSQL instance.

## Why the shipped example is false

`.env.production.example` intentionally ships `RANKED_RELEASE_CERTIFIED=false`. A source ZIP with a passing simulation is not enough to bypass dependency, database and build verification.
