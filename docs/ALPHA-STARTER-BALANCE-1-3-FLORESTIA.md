# Alpha Starter Balance 1.3 — Florestia Matchup Redistribution

## Certified starting point

Balance 1.2 is the canonical recipe baseline.

Full 3,000-game profile:

- health score: 86;
- first-player: 51.7%;
- healthy: 8;
- watch: 6;
- critical: 1;
- new critical pairs: 0.

The repaired matchup is:

- Emberhold × Ironwood: 58/42.

The only residual critical is:

- Ironwood × Florestia: 36.5/63.5.

Important guardrails:

- Ember × Tempestade: 40/60;
- Tide × Florestia: 41/59;
- Florestia × Tempestade: 48/52.

## Diagnosis

Balance 1.2 proved that generic Ironwood power increases are exhausted: they
create replacement criticals against Tidecall and/or Tempestade before the
target matchup is repaired.

Therefore 1.3 does not buff Ironwood and does not touch Emberhold.

The remaining hypothesis is that Florestia still has too much interaction whose
value scales with large resilient enemy bodies:

- remaining Predator Pounce;
- Primal Recall;
- remaining Moon Snare / Entangle;
- Thornfang Deathtouch;
- Dawn Alpha Challenger.

The replacement side deliberately favors tools whose value is concentrated
against faster or airborne opponents:

- Canopy Warden — Reach;
- Moonfang — Lifesteal;
- Spirit Guide — summon Nexus healing.

## Round 1 candidate grid

Eight Florestia-only two-slot packages are screened across the complete
six-starter matrix.

Screening:

- 8 candidates;
- 15 matchups each;
- 5 deterministic strata;
- 10 games per stratum;
- 750 games per candidate;
- 750-game baseline screen.

Finalists:

- top 4 candidates;
- 3,000 games each;
- unchanged 3,000-game 1.2 baseline control.

Expected total: 21,750 games.

## Promotion rules

A candidate is promotion-eligible only if:

1. all matrix games complete;
2. critical matchup count reaches zero;
3. no new critical pair appears;
4. Ironwood × Florestia reaches at least 40/60;
5. first-player remains within ±2 percentage points of 50%.

The ranking also penalizes distance below the 40% Ironwood floor before global
watch/health tiebreakers, because the purpose of 1.3 is explicitly to repair
the final critical without hiding it behind unrelated aggregate movement.

## Discipline

The grid uses read-only simulator deck overrides. No canonical recipe is
changed until a 3,000-game finalist is promotion-eligible.

If no candidate qualifies, Round 1 is rejected and 1.3 pivots without forcing
a recipe change.


## Round 1 result — promoted candidate

Round 1 completed **21,750 games** with quality PASS.

Evidence artifact:

- workflow: Alpha Starter Balance 1.3 Matchup Grid #1;
- artifact ZIP SHA-256: `b01d50e2b160e1d82de805a1931f46dad33e163502b2f323f58284a38c221281`.

Exactly one 3,000-game finalist was promotion-eligible:

`forest_recall_thornfang_to_canopy_spirit`

Exact recipe delta:

- first `forest_primal_recall -> forest_canopy_warden`;
- first `forest_thornfang -> forest_spirit_guide`.

Full finalist result:

- health score: **89** (baseline 86);
- first-player: **51.3%**;
- healthy: **8**;
- watch: **7**;
- critical: **0**;
- new critical pairs: **0**.

Target repair:

- Ironwood × Florestia: **36.5/63.5 -> 40/60**.

Key guardrails:

- Ember × Ironwood: **58/42** — unchanged;
- Tide × Florestia: **42.5/57.5**;
- Void × Florestia: **49/51**;
- Ember × Florestia: **50.5/49.5**;
- Florestia × Tempestade: **49.5/50.5**.

The promotion therefore removes the final critical matchup without replacing it
elsewhere.

## Canonical 1.3 certification

After promotion, exploratory candidate/grid source and the grid workflow are
removed from the branch.

The final implementation contains:

- the real recipe delta in `src/game/decks.ts`;
- `src/game/alpha-starter-balance-1-3.test.ts` locking the exact active recipe;
- the 1.2 test converted to a historical snapshot for forward compatibility;
- `.github/workflows/alpha-starter-balance-1-3.yml` running the canonical
  3,000-game matrix;
- this evidence document.

The canonical gate fails closed unless:

1. all 3,000 games complete;
2. all 15 matchups complete;
3. simulation quality passes;
4. reaction coverage errors remain zero;
5. health score remains at least 89;
6. critical matchup count is exactly zero;
7. first-player remains within ±2 percentage points of 50%.

Balance 1.3 is not integrated until CI, Alpha evidence, the historical 1.1/1.2
compatibility gates, the four visual certs and post-merge certification all pass
on the exact promoted recipe.
