# Recovery Key 2.0

## Goal

Reduce the impact of any future browser XSS by removing the long-lived account recovery credential from automatic browser persistence.

The player session remains an HttpOnly server-issued cookie. Recovery is a separate, high-value credential.

## New-account behavior

Creating a guest account no longer automatically generates or returns a recovery key.

A new player receives:

- the normal durable account;
- the normal HttpOnly player session;
- `recoveryConfigured: false`.

The player explicitly chooses **GERAR CHAVE** in Profile when they want recoverability.

## Explicit issuance

`POST /api/player` with:

```json
{ "rotateRecoveryCode": true }
```

requires the current authenticated player session and returns a newly generated recovery key.

The server stores only its SHA-256 recovery hash and expiry.

The browser:

- displays the key in component memory;
- can copy it;
- can generate a text file for the player to save;
- does **not** write the key to localStorage;
- loses the displayed plaintext after a page reload.

Generating another key immediately invalidates the previous one.

## Recovery

A saved key can be pasted into Profile.

Recovery is processed before the existing-session branch so it can deliberately switch from a temporary guest session to the recovered account.

Successful recovery:

1. locks the candidate player;
2. verifies the unexpired recovery hash;
3. generates a different recovery key;
4. atomically replaces the recovery hash;
5. revokes prior sessions for the recovered player;
6. creates a fresh durable player session;
7. returns the new recovery key once.

The presented key therefore cannot be replayed.

## Legacy migration

Older RuneForge clients may still have `runeforge_recovery_code` in localStorage.

Recovery Key 2.0 never writes that key.

Profile only detects the legacy value to provide an explicit **MIGRAR CHAVE ANTIGA** action. On successful migration:

- the old key recovers the account;
- the server rotates it;
- the old localStorage entry is deleted;
- the newly rotated key is shown once for external storage.

## Certification

The Alpha player journey now proves:

account creation without a recovery secret → explicit key issuance → normal gameplay/progression → recovery from an isolated client → retained deck/balances/progression → old-key replay rejected with HTTP 401.

Static regression guards additionally reject any future `localStorage.setItem` of the recovery credential.

## Boundaries

Recovery Key 2.0 does not change:

- gameplay or engine rules;
- card content;
- Ranked;
- economy;
- payments;
- admin authentication.
