# Vanilla 1.9 — Floor Convergence

Vanilla 1.9 continues the evidence-first balance program after Vanilla 1.8 raised Florestia Ascendant from 38.0% to 40.4% without changing CardDefs.

The 1.9 goal was narrower: determine whether the remaining Florestia floor could still be improved through recipe concentration before considering any card-level balance mutation.

## Baseline

Vanilla 1.8 closed at:

- global health score: **74**;
- global matrix: **29 healthy / 17 watch / 20 critical**;
- Florestia Ascendant: **40.4%**, with **4 healthy / 1 watch / 6 critical** matchups;
- Emberhold Ascendant: approximately **40.5%** and the other principal floor deck;
- all 180 experimental Vanilla cards preserved;
- no CardDef, AI or engine mutation.

## Diagnostic 1 — 4,200 games

The first 1.9 laboratory compared the two floor decks over every unique matchup involving either `vanilla_forest_2` or `vanilla_ember_2`:

- 21 unique matchups;
- 5 deterministic strata;
- 40 games per stratum;
- **4,200 total games**;
- **2,200 games per floor deck**;
- 0 incomplete simulation runs;
- 0 policy-unsupported telemetry samples.

Florestia remained at **40.4%** and Emberhold at **40.5%** in that direct diagnostic. The important separation was utilization:

- Florestia final hand: **3.0 cards/game**;
- Emberhold final hand: **1.8 cards/game**;
- Florestia Nexus damage: **16.3/game**;
- Emberhold Nexus damage: **17.5/game**;
- Florestia and Emberhold shared four critical Vanguard opponents: Tempestade, Tidecall, Voidborn and Ironwood;
- Florestia additionally remained critical into Emberhold and Florestia Vanguard.

Target-starvation was already material in both decks, so the evidence did **not** support adding more target-dependent spells.

## Composition Screen — 7,920 games

A 12-recipe Florestia screen then tested duplicate concentration only:

- 12 candidates;
- 11 opponents;
- 3 strata × 20 games;
- 660 games per candidate;
- **7,920 total games**.

Every candidate preserved:

- all 30 Florestia regional definitions;
- exactly 40 cards;
- the runtime three-copy ceiling;
- all existing CardDefs, AI and rules.

The low-sample screen identified two candidates worth confirming, but also demonstrated that simply adding more early bodies was not generally sufficient. Most substitutions regressed to five or six critical matchups.

## High-Sample Finalists — 6,600 games

Three finalists were rerun with the exact official Balance Lab sampling density:

- 11 opponents;
- 5 deterministic strata;
- 40 games per stratum;
- **2,200 games per finalist**;
- **6,600 total games**.

Results:

| Recipe | Win rate | Healthy | Watch | Critical | Decision |
| --- | ---: | ---: | ---: | ---: | --- |
| Vanilla 1.8 baseline (`u11,u13,u14,u16,u17`) | 40.4% | 4 | 1 | 6 | historical baseline |
| `wide_u03_u04` | 39.4% | 3 | 2 | 6 | reject |
| `wide_u04_u05` | **42.1%** | 4 | 2 | **5** | finalist |

The winning concentration is:

- `van_forest_u04` — Caçadora da Alcateia;
- `van_forest_u05` — Javali de Casca;
- `van_forest_u13` — Fera do Vale Antigo;
- `van_forest_u14` — Matriarca das Presas;
- `van_forest_u16` — Titã da Selva.

Each appears three times in the active 40-card recipe. The former 1.8 duplicate pairs `u11` and `u17` return to singleton regional coverage.

The finalist cleared Tidecall Vanguard from **34.0% critical** to **40.5% watch**, created no new critical matchup and produced no overshoot critical.

## Global Certification — 13,200 games

The finalist was then tested in the full official round robin with **only** the Florestia Ascendant recipe overridden:

- 66 matchups;
- 5 deterministic strata;
- 40 games per stratum;
- **200 games per matchup**;
- **13,200 total games**.

Simulation quality:

- pool errors: **0**;
- incomplete matchups: **0**;
- unstable matchups: **0**;
- maximum seed deviation: **18.5pp**;
- stability threshold: **23.7pp**;
- quality gate: **PASS**.

Global result:

| Metric | Vanilla 1.8 | Vanilla 1.9 | Delta |
| --- | ---: | ---: | ---: |
| Health score | 74 | **76** | **+2** |
| Healthy matchups | 29 | 29 | 0 |
| Watch matchups | 17 | **18** | +1 |
| Critical matchups | 20 | **19** | **-1** |
| Florestia Ascendant win rate | 40.4% | **42.1%** | **+1.7pp** |
| Florestia critical matchups | 6 | **5** | **-1** |

The strongest deck remains Tidecall Vanguard at **57.7%**. The new global floor is Emberhold Ascendant at **39.9%**. The experimental release gate remains blocked because 19 critical matchups still exist; Vanilla 1.9 improves the matrix but does not claim global balance completion.

## Product Mutation

Vanilla 1.9 changes **recipe concentration only** in `vanilla_forest_2`.

It does not change:

- CardDefs or printed card numbers;
- engine or combat rules;
- AI policy;
- Ranked content or Ranked certification boundaries;
- Studio authoring;
- database schema or persistence;
- economy, marketplace or payments.

Vanilla 1.8 is preserved as an exact historical snapshot. The newest exact active recipe is owned by `vanilla-floor-convergence-1-9.test.ts`.

## Next Slice

The global floor is now **Emberhold Ascendant at 39.9%**. The next evidence-first balance slice should target Emberhold Ascendant's four remaining critical matchups before revisiting CardDefs, while continuing to monitor the Tidecall Vanguard ceiling at 57.7%.
