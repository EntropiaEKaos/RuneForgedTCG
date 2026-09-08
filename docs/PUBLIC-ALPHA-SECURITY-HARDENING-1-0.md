# Public Alpha Security Hardening 1.0

## Scope

This slice closes two production-readiness findings without changing gameplay, card content, Ranked policy, payments or Live Ops:

1. player recovery bearer credentials must not remain in browser persistent storage;
2. Netlify must not offer a deploy path that bypasses the certified production gate.

## Recovery key lifecycle

The authoritative recovery model remains server-side:

- only a SHA-256 digest is stored in PostgreSQL;
- recovery credentials expire;
- successful use is transactionally locked;
- all old sessions for the recovered account are revoked;
- the credential rotates immediately;
- a fresh HttpOnly player session is issued.

The browser lifecycle is now explicit:

- account creation/rotation/recovery publishes the new key only to volatile module memory;
- a global notice tells the player to save it outside RuneForge;
- dismissing the notice clears the in-memory copy;
- `/recover` accepts a saved key and shows the one-time replacement key;
- invalid recovery does not replace the current session;
- valid recovery revokes the current session row and emits one replacement cookie.

## Legacy migration

Old builds used:

`localStorage["runeforge_recovery_code"]`

Current code never writes this key.

If an old value exists, it is read once and removed immediately:

- when the current HttpOnly session is still valid, the legacy key is surfaced in volatile memory so the player can save it;
- when the normal session has expired, the legacy key is used once to recover the account and the server rotates it;
- if the old key is invalid/expired, normal guest-session creation continues.

This avoids silently destroying the only recovery credential of an upgrading Alpha tester.

## Browser certification

The Alpha visual journey now requires:

- the one-time recovery notice appears for a newly created account;
- the displayed key matches the expected recovery-key shape;
- `localStorage.getItem("runeforge_recovery_code") === null`;
- the user can dismiss the one-time notice;
- `/recover` renders as part of the certified browser journey.

The PostgreSQL-backed Alpha player journey additionally proves:

- an invalid recovery key preserves an already active temporary session;
- the valid key replaces that session with the original progressed account;
- Forge deck and progression survive recovery exactly as before.

## Netlify certified build

`netlify.toml` calls only:

`npm run deploy:netlify:certified`

The script requires explicit opt-in and exact SHA binding to Netlify `COMMIT_REF`, then delegates to the full:

`npm run production:verify`

Plain `npm run build` is no longer a valid Netlify deployment command.

## Boundaries unchanged

- Alpha capabilities stay the same seven certified capabilities.
- Ranked remains `RANKED_RELEASE_CERTIFIED=false` for public Alpha.
- Real-money provider E2E remains outside Alpha launch requirements.
- No engine, cards, deck recipes, balance data or CMS authority changes.
