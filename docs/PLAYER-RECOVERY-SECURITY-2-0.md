# Player Recovery Security 2.0

## Goal

Recovery keys are account credentials. RuneForge must not persist them in browser Web Storage.

The stable player session remains the HttpOnly `rf_player_session` cookie backed by the durable `player_sessions` table.

## New key lifecycle

A recovery key is returned only when:

- a player account is created;
- an existing account is recovered;
- the authenticated player explicitly rotates the key.

The client keeps that newly issued key only in short-lived JavaScript memory and opens a global one-time handoff dialog.

The dialog supports:

- copy to clipboard;
- download as `runeforge-recovery-key.txt`;
- explicit dismissal after the player has stored it elsewhere.

The key is not automatically written to `localStorage`, `sessionStorage`, IndexedDB or cookies.

## Legacy cleanup

Older builds used the local key `runeforge_recovery_code`.

The new client never reads or uses that credential. On session/recovery activity it only removes the legacy item so old secrets do not remain persistently accessible to future JavaScript.

## Explicit recovery

A browser with no valid session creates a normal temporary guest if needed.

If the locally remembered public display name is already owned, onboarding retries with a generated guest rather than getting stuck on HTTP 409.

The player can then paste their stored recovery key on the Profile page.

Recovery is authoritative server-side and can replace an already-authenticated temporary identity:

1. recovery key is validated by hash and expiry under a row lock;
2. the recovery key is rotated;
3. all sessions of the recovered account are revoked;
4. a new durable session is created;
5. the current browser session, including a temporary guest session, is revoked;
6. the recovered HttpOnly session cookie is installed;
7. the newly rotated recovery key is shown once for external storage.

Recovery preserves progression, cards, decks, match history and economy because identity returns to the original player row.

## Security boundary

The database stores only `recovery_key_hash` and expiry.

Recovery keys remain rate-limited and body-limited by `POST /api/player`.

A successful recovery always rotates the key, so a used recovery key cannot be replayed.

## Certification

CI/Alpha E2E must prove recovery over an already-authenticated temporary player, not only an anonymous browser.

Source contracts reject any return of automatic recovery-secret persistence.
