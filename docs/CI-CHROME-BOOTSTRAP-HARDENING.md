# CI Chrome Bootstrap Hardening

## Context

After Alpha Starter Balance 1.2 was squash-merged into `main` at
`66456eaab4360caa3e231b2c01e804f7434ef3bb`, all balance gates, Ecos do
Abismo evidence and the four flagship visual certifications passed.

The full CI failed twice at the same browser bootstrap point:

- `ALPHA PLAYER JOURNEY`: PASS;
- HTTP/PvP/Ranked API E2E: PASS;
- Next production build/server: PASS;
- `alpha-pvp-lobby-preflight.mjs`: failed before navigation with
  `Chrome debugging endpoint not ready`.

The preflight previously used this sequence:

1. reserve an ephemeral TCP port with Node;
2. close the reservation;
3. launch Chrome requesting that exact port;
4. poll `/json/list`.

That reserve-release-rebind sequence leaves a race window and gives poor
diagnostics if Chrome exits before exposing CDP.

## Hardened contract

The PvP lobby preflight now:

- launches Chrome with `--remote-debugging-port=0`;
- lets Chrome allocate the actual debugging port;
- waits for the official `DevToolsActivePort` file inside the isolated
  temporary user-data directory;
- validates the port before CDP discovery;
- detects Chrome process exit while waiting;
- reports bounded Chrome stderr plus exit code/signal on bootstrap failure;
- keeps the existing isolated profile and cleanup behavior.

No gameplay, PvP authority, balance recipe, engine, cards, economy, Ranked or
visual surface is changed by this hardening.

## Regression guard

`src/lib/ci-chrome-bootstrap-regression.test.ts` fails closed if the preflight:

- stops using Chrome-owned port allocation;
- stops reading `DevToolsActivePort`;
- loses fail-fast Chrome process diagnostics;
- reintroduces `freePort()` or `node:net` preallocation.

## Certification gate

Do not merge this hardening until the exact PR head passes:

1. source-contract taxonomy;
2. typecheck/lint;
3. full behavioral and coverage gates;
4. production PostgreSQL probes;
5. production build;
6. complete browser E2E, including the PvP lobby preflight;
7. all balance evidence workflows relevant to the changed branch;
8. post-merge CI on the definitive `main` SHA.
