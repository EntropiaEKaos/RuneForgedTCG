# CI Chrome Bootstrap Hardening

## Context

After Alpha Starter Balance 1.2 was squash-merged into `main` at
`66456eaab4360caa3e231b2c01e804f7434ef3bb`, the full CI failed twice in
`alpha-pvp-lobby-preflight.mjs` before browser navigation with:

`Chrome debugging endpoint not ready`

PR #129 hardened that preflight and was certified on its exact head. After its
squash merge to `main` at
`b0cbb7b3b11ac9e6aaf16f22a7f25b8cc5f06302`, the same class of failure
appeared independently in:

`alpha-flagship-signatures-browser-cert.mjs`

with:

`Chrome remote debugging endpoint did not become ready`

This second failure proved that the issue was systemic across the repository's
headless browser harnesses, not specific to PvP.

## Root cause

The legacy browser scripts used the same sequence:

1. reserve an ephemeral TCP port with Node;
2. close the reservation;
3. launch Chrome requesting that exact port;
4. poll `/json/list`.

That reserve-release-rebind sequence leaves a race window between releasing
the socket and Chrome binding it. It also produces weak diagnostics when Chrome
exits before exposing CDP.

## Shared hardened contract

`scripts/chrome-devtools-bootstrap.mjs` is now the single port-discovery
contract for all certified headless Chrome scripts.

It:

- defines `--remote-debugging-port=0`;
- lets Chrome allocate its own debugging port;
- waits for Chrome's official `DevToolsActivePort` file in the isolated
  user-data directory;
- validates the discovered port;
- detects Chrome process exit before bootstrap completion;
- includes bounded stderr plus exit code/signal when stderr is available.

The existing per-cert `waitForChrome(port)` logic remains responsible for
waiting for a page target after the port is known.

## Migrated browser surfaces

The shared bootstrap covers 16 headless scripts:

- Alpha Visual Journey;
- PvP lobby preflight;
- Runtime Tooltip;
- Activated Ability;
- Casual PvP;
- PvP Reaction Priority;
- Semantic Codex;
- Card Art Viewer;
- Flagship Champions;
- Flagship Structures;
- Flagship Mana Rituals;
- Flagship Traps;
- Flagship Starter Signatures;
- Studio Card Rules;
- Studio Card Rules RBAC;
- Studio Modal Ability.

No gameplay, engine, CardDef, recipe, AI, economy, Ranked, PvP authority or
visual implementation is changed.

## Regression guard

`src/lib/ci-chrome-bootstrap-regression.test.ts` scans the repository's
headless Chrome scripts and fails closed if any certified script:

- does not use the shared helper;
- stops using Chrome-owned port allocation;
- stops discovering `DevToolsActivePort`;
- reintroduces `freePort()`;
- reintroduces dynamic `--remote-debugging-port=${port}`;
- reintroduces `node:net` TCP port preallocation.

The guard also certifies the helper's process-exit and diagnostic contract.

## Certification gate

Do not merge the systemic hardening until the exact PR head passes:

1. taxonomy and static source-contract audits;
2. typecheck/lint;
3. full behavioral and coverage gates;
4. production PostgreSQL probes;
5. production build;
6. complete browser E2E;
7. Alpha Starter Balance Evidence;
8. all four flagship visual certifications;
9. post-merge certification on the definitive `main` SHA.
