# Alpha Starter Balance 1.1 — Recipe-Only Refinement

## Objective

Reduce the three critical Alpha starter matchups revealed by the certified 1.0 stack-aware baseline **without changing card stats, effects, rules, AI policy, engine behavior, Ranked, economy or visual surfaces**.

This slice is intentionally recipe-first.

## Certified baseline

Starting point: `main` at `91eaf344facd6878ba12dc5e35a7f55c9e91e39f`.

Alpha Starter Balance 1.0:

- 3,000/3,000 simulated games;
- 15/15 pairwise starter matchups;
- stack-aware reaction resolution;
- Trap reaction coverage errors: 0;
- first-player win rate: 50.5%;
- health score: 78;
- 8 healthy / 4 watch / 3 critical.

Remaining critical matchups:

- Ironwood vs Florestia: 28.0 / 72.0;
- Emberhold vs Ironwood: 68.0 / 32.0;
- Tidecall vs Florestia: 37.5 / 62.5.

## Evidence-driven targets

The 1.0 utilization artifact identified especially low-use reactive slots:

### Ironwood

- `wood_wither` — Withering Vines: about 17.6% play rate when seen;
- `wood_bark_rupture` — Ruptura da Casca: about 18.7% play rate when seen.

Both frequently remain target-starved while Ironwood loses badly to Emberhold and Florestia.

### Tidecall

- `tide_dispel` — Disenchant Tide: about 16.6% play rate when seen.

Tidecall is no longer globally weak after stack-aware Trap support, but still sits at 37.5% against Florestia.

## Candidate philosophy

Every candidate:

1. changes only one or two existing recipe slots;
2. keeps exactly 40 cards;
3. remains legal under `validateDeck`;
4. preserves exactly the starter's certified Structure, Ritual and Trap teaching cards;
5. uses only existing collectible cards;
6. never mutates the canonical recipe during screening;
7. is evaluated against the **entire six-starter matrix**, not only the target matchup.

## Screening candidates

### Ironwood — six candidates

- 1x Wither -> Champion;
- 1x Bark Rupture -> Champion;
- 1x Wither + 1x Bark Rupture -> Champion + Canopy;
- 1x Wither + 1x Bark Rupture -> Champion + Ward;
- 1x Wither + 1x Bark Rupture -> Champion + Ent;
- 2x Wither -> Champion + Canopy.

These candidates reduce conditional removal density while increasing proactive unit/protection density.

### Tidecall — six candidates

- 1x Dispel -> Draw;
- 1x Dispel -> Mirror;
- 1x Dispel -> Champion;
- 2x Dispel -> Draw + Mirror;
- 2x Dispel -> Champion + Draw;
- 2x Dispel -> Champion + Mirror.

These candidates reduce target-starved permanent removal while increasing card flow, board pressure or equipment value.

## Two-stage grid

The workflow deliberately separates exploration from certification.

### Stage 1 — screening

For all 12 individual candidates:

- all 15 starter matchups;
- 5 deterministic seed strata;
- 10 games per stratum;
- 50 games per matchup;
- 750 games per candidate.

A baseline control is run at the same reduced sample.

Candidates are ranked with a fail-closed priority:

1. fewer critical matchups;
2. fewer watch matchups;
3. higher health score;
4. lower first-player skew.

The top two Ironwood candidates and top two Tidecall candidates advance.

### Stage 2 — finalists

The four Wood × Tide combinations are rerun at the full certified sample:

- 15 matchups;
- 5 deterministic seed strata;
- 40 games per stratum;
- 200 games per matchup;
- **3,000 games per finalist**.

A full 3,000-game unchanged baseline control is also rerun in the same workflow.

Expected grid volume is roughly 25,000 games.

## Promotion rule

No candidate is promoted merely because it improves one critical matchup.

A finalist is eligible for promotion only if:

- every requested game completes;
- the full matrix remains legal/stable;
- no new critical matchup is introduced;
- total critical matchups decrease, or the same count is retained with a clearly stronger health profile and no regression that outweighs the target improvement;
- first-player skew does not materially worsen;
- CI, behavioral, coverage, build, E2E and visual certs stay green after the actual recipe is committed.

The screening script itself **does not modify `decks.ts`**.

## Files in this exploration slice

- `src/game/alpha-starter-balance-1-1.ts` — candidate definitions and read-only recipe overrides;
- `src/game/alpha-starter-balance-1-1.test.ts` — legality, slot locality and semantic teaching-card preservation;
- `scripts/alpha-starter-balance-recipe-grid.ts` — two-stage deterministic matrix;
- `.github/workflows/alpha-starter-balance-recipe-grid.yml` — evidence workflow;
- this document.

## Merge discipline

The exploration branch is not merge-ready simply because the grid completes.

After the artifact is inspected:

1. choose the best finalist;
2. promote only its exact recipe changes to `src/game/decks.ts`;
3. replace exploratory acceptance with a canonical recipe test/gate;
4. rerun the full 3,000-game Alpha baseline on the real recipe;
5. require normal repository CI + four visual certs;
6. merge only if the promoted real recipe reproduces the evidence.
