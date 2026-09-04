# Alpha Starter Balance 1.0 — Evidence Baseline

## Goal

Establish a reproducible, evidence-backed balance baseline for the six canonical Alpha starter decks **without changing gameplay content inside this PR**. The matrix consumes the already-certified main branch, including Balance Simulator 2.0 reaction support and the Tidecall counter-Trap timing correction from PR #126.

This is the first gameplay front after the original Flagship Art Set reached 30/30 certified masters.

## Certified pool

Only the six teaching starters participate:

- `ember_aggro` — Emberhold Blitz
- `tide_control` — Tidecall Control
- `wood_midrange` — Ironwood Grove
- `void_shadow` — Voidborn Dread
- `florestia_tribal` — Matilha da Florestia
- `tempestade_rush` — Tempestade Iminente

Advanced `convergence_dual` and `convergence_triad` presets stay outside this matrix.

Each starter must remain legal, contain exactly 40 cards and retain its three semantic teaching cards: one Structure, one Ritual and one Trap.

## Methodology

The baseline uses the certified **stack-aware** Balance Simulator and its read-only utilization telemetry. Proactive hand actions travel through the same `aiChooseReaction()` + `applyStackedActionWithAi()` authority used by the live engine; no parallel combat or reaction implementation is introduced. Historical reaction-free simulator APIs remain untouched for old baselines.

The evidence workflow runs:

- 6 starters;
- 15 unique pairwise matchups;
- 5 deterministic independent seed strata;
- 40 games per stratum;
- 200 games per matchup;
- **3,000 simulated games total**.

The simulator alternates policy side and first player. The report preserves engine/ruleset versions, Wilson 95% intervals, round distribution, first-player win rate and per-stratum matchup results.

## Quality gate versus balance gate

A weak deck is valid evidence. An unreliable experiment is not.

Therefore the workflow initially enforces only the **simulation-quality gate**:

- all 15 matchups produced;
- every requested game completed;
- no pool/legality errors;
- no telemetry accounting errors;
- no matchup exceeding the certified seed-stratum instability threshold;
- every starter's semantic **Armadilha** must be observed and must record at least one real reaction play in the full matrix.

Balance findings are emitted independently and do not make the baseline workflow fail.

## Balance health bands

The project-wide `balance-health` contract remains authoritative:

- **Healthy:** 45–55% matchup win rate;
- **Watch:** 40–45% or 55–60%;
- **Critical:** below 40% or above 60%.

`releaseCandidateGate` is:

- `blocked-quality` when evidence quality is invalid;
- `blocked-balance` when at least one critical matchup exists;
- `review-balance` when no matchup is critical but at least one remains in Watch;
- `pass` only when every measured matchup is Healthy.

The audit supports `--enforce-balance`, but the baseline PR intentionally does **not** enable it. That flag becomes the final Release Candidate gate after evidence-driven iterations.

## Utilization diagnosis

The same run records read-only telemetry for each starter and card, including:

- play rate when seen;
- cards remaining in hand;
- playable cards ignored by policy;
- target-starved samples;
- reaction-only samples;
- policy-unsupported samples;
- cards played per game;
- Nexus damage and allies summoned per game;
- end turns with a legal play still available;
- unspent normal and spell mana;
- semantic-type utilization for Unit/Spell/Structure/Ritual/Trap and other card families.

This is used to distinguish **power imbalance** from **utilization friction** before changing content.

### Reaction-coverage correction

The first refreshed 3,000-game artifact was deliberately **not promoted** after inspection showed all six starter Traps at zero plays despite 2,318 combined appearances. The historical simulator only advanced main/blocking decisions and therefore omitted reaction-stack value.

PR #126 introduced an opt-in stack-aware balance mode and certified all six starter Traps. This baseline now consumes that mode and fails closed if a starter Trap is seen but never played, so the same blind spot cannot be silently promoted again.

## Decision order after baseline

1. Certify the 3,000-game unchanged baseline.
2. Inspect critical/watch matchups, first-player skew and seed stability.
3. Inspect utilization telemetry for the strongest and weakest starters.
4. Prefer small **recipe-only** changes when a deck has access to suitable existing cards but extracts value poorly.
5. Change card numbers or rules only when the evidence shows the problem cannot be solved cleanly at recipe level.
6. Re-run the exact same matrix and seeds for every candidate.
7. Require full repository CI plus `--enforce-balance` before calling the starter set a Release Candidate.

## Non-goals

This slice does not change:

- any starter deck recipe;
- any CardDef stats, costs, keywords or effects;
- engine rules or AI policy inside this PR (reaction support is inherited from already-certified main);
- Ranked, matchmaking, persistence, economy or payments;
- the Alpha Visual Feature Freeze surfaces.
