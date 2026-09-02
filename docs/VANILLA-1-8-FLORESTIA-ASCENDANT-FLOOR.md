# Vanilla 1.8 — Florestia Ascendant Floor

## Status

**Certified composition-only balance slice.**

Vanilla 1.8 raises the floor of `vanilla_forest_2` (Florestia Ascendant) by changing only its experimental 40-card recipe. No CardDef, rules-engine, AI-policy, persistence, Ranked, economy, payment, or live-content behavior is changed by this slice.

The promoted recipe passed TypeScript, the complete **85/85 behavioral target suite**, and the official **13,200-game / 66-matchup Balance Lab** on the promoted head.

The global balance release gate remains **blocked**. Vanilla 1.8 is a measured convergence step, not a claim that Vanilla is fully balanced.

## Why Florestia Ascendant was the 1.8 target

Vanilla 1.7 closed the Emberhold Ascendant floor and left Florestia Ascendant as the weakest experimental deck in the certified matrix:

- Vanilla 1.7 Florestia Ascendant win rate: **38.0%**
- matchup health: **2 healthy / 2 watch / 7 critical**
- Vanilla 1.7 global health score: **72**
- global matchup distribution: **27 healthy / 18 watch / 21 critical**

The 1.8 rule was therefore the same evidence-first discipline used by the previous balance slices: diagnose extraction first, prefer recipe changes while composition remains the demonstrated cause, and touch CardDefs only if composition experiments fail to produce a credible floor improvement.

## Diagnostic finding: extraction was no longer the main problem

The first 1.8 diagnostic reused the read-only utilization telemetry on the exact Balance Lab simulator. It ran the full 66-matchup round robin with five certified seed strata and 40 games per stratum: **13,200 games**.

Florestia Ascendant showed:

- **83.9%** of seen cards played
- **12.8** card plays per game
- **2.4** cards left in hand per game
- **15.8** Nexus damage per game
- **9.6** allies summoned per game

That profile is materially different from the earlier dead-hand problem. The deck was generally able to deploy cards, but converted its resources into Nexus pressure poorly.

The telemetry also warned against blindly adding more copies of interaction. `Lua Revigorante` was played only **65.3%** of the times it was seen and remained in hand **34.7%** of the time; several targeted spells accumulated target-starved or ignored-playable samples.

By contrast, the upper Unit curve was extracted cleanly. Representative play rates when seen were:

| Card | ID | Play rate when seen |
| --- | --- | ---: |
| Titã da Selva | `van_forest_u16` | 90.0% |
| Grande Lobo Dourado | `van_forest_u15` | 89.3% |
| Matriarca das Presas | `van_forest_u14` | 88.3% |
| Arauto da Caçada | `van_forest_u17` | 87.4% |
| Fera do Vale Antigo | `van_forest_u13` | 85.8% |
| Alfa da Clareira | `van_forest_u11` | 80.7% |

**Diagnosis:** the next experiment should improve board quality and pressure conversion through recipe composition rather than increase target-dependent spells or mutate CardDefs.

## Candidate screen 1 — structural recipe families

The first recipe screen preserved all 30 Florestia regional cards and used only the 10 duplicate slots. Eight structurally different recipes were tested against all 11 opponents using the certified seed strata: **1,100 games per candidate / 8,800 games total**.

| Candidate | Win rate |
| --- | ---: |
| `clean_finishers` | **38.3%** |
| `broad_pressure` | 37.6% |
| `matriarch_hunt` | 37.3% |
| `baseline_1_7` | 35.5% |
| `curve_midrange` | 34.4% |
| `clean_interaction` | 31.7% |
| `early_curve` | 31.1% |
| `permanent_pressure` | 27.5% |

The result rejected three tempting but unsupported directions: more low curve, more permanent density, and more interaction. The highest-signal family was a concentrated upper-Unit core:

- 3× `u13`
- 3× `u14`
- 3× `u15`
- 3× `u16`
- 3× `u17`

## Candidate screen 2 — hardest-matchup refinement

The `clean_finishers` family was then refined against the three hardest inherited opponents:

- Voidborn Vanguard
- Florestia Vanguard
- Tempestade Vanguard

Sixteen deterministic variants were tested, each preserving the complete 30-card regional pool. The refinement compared pair substitutions around the finisher core for **4,800 games total**.

The best aggregate line was `swap_u15_u11` at **34.0%** across those three hard opponents, tied on aggregate with the `u18` substitution but with the stronger downstream profile chosen for the full finalist round robin.

This result specifically justified replacing the duplicated `Grande Lobo Dourado (u15)` pair with `Alfa da Clareira (u11)` rather than changing card stats.

## Finalist certification

Four finalist recipes were then tested against all 11 opponents with five certified strata × 40 games: **2,200 games per finalist / 8,800 games total**.

| Finalist | Win rate |
| --- | ---: |
| `finisher_u11` | **40.4%** |
| `finisher_u18` | 39.9% |
| `clean_finishers` | 37.0% |
| `baseline_1_7` | 35.8% |

The promoted `finisher_u11` recipe materially improved several inherited weak pairings in the same finalist experiment:

- Voidborn Vanguard: **26.5% → 39.0%**
- Florestia Vanguard: **27.5% → 34.5%**
- Ironwood Vanguard: **31.0% → 38.5%**
- Tempestade Vanguard: **31.5% → 32.0%**

The Tempestade Vanguard matchup remains a severe problem, but the finalist improved the overall floor without creating a new composition-only outlier that justified abandoning the change.

## Promoted 40-card recipe

All **30 Florestia regional cards remain represented at least once**. The ten duplicate slots make exactly these five Units three-copy cards:

- **3× `van_forest_u11` — Alfa da Clareira**
- **3× `van_forest_u13` — Fera do Vale Antigo**
- **3× `van_forest_u14` — Matriarca das Presas**
- **3× `van_forest_u16` — Titã da Selva**
- **3× `van_forest_u17` — Arauto da Caçada**

Every other regional card is singleton. There are no two-copy cards and no card exceeds the three-copy cap.

The 1.8 behavior contract explicitly locks:

- 40 cards total
- 30 unique regional definitions
- 28 Unit copies
- 8 singleton Spells
- 4 singleton Permanents
- exact tripled set `u11/u13/u14/u16/u17`
- `u03/u05/u08/u18` restored to singleton
- full `180/180` experimental card coverage preserved

## Official 13,200-game certification

The promoted recipe was certified on the official Balance Lab configuration:

- **12 decks**
- **66/66** pairwise matchups
- **200 games per matchup**
- **5** deterministic independent seed strata
- **13,200 total games**
- **12.0** average rounds
- **50.1%** first-player win rate
- **0%** draws
- **66/66 stable matchups**
- maximum seed deviation **18.5 pp**, below the **23.7 pp** stability threshold
- simulation quality gate: **PASS**
- pool errors: **0**
- incomplete matchups: **0**

TypeScript passed and the behavior suite finished **85/85 behavioral targets** green before the official matrix.

### Florestia Ascendant after promotion

- games: **2,200**
- wins/losses: **888 / 1,312**
- win rate: **40.4%**
- Wilson 95% interval: **38.3%–42.4%**
- matchup health: **4 healthy / 1 watch / 6 critical**

Official opponent rates:

| Opponent | Florestia Ascendant WR | Status |
| --- | ---: | --- |
| Emberhold Vanguard | 31.5% | critical |
| Emberhold Ascendant | 45.0% | healthy |
| Tidecall Vanguard | 34.0% | critical |
| Tidecall Ascendant | 48.5% | healthy |
| Ironwood Vanguard | 38.5% | critical |
| Ironwood Ascendant | 50.0% | healthy |
| Voidborn Vanguard | 39.0% | critical |
| Voidborn Ascendant | 50.0% | healthy |
| Florestia Vanguard | 34.5% | critical |
| Tempestade Vanguard | 32.0% | critical |
| Tempestade Ascendant | 41.0% | watch |

### Global matrix movement from Vanilla 1.7

| Metric | Vanilla 1.7 | Vanilla 1.8 |
| --- | ---: | ---: |
| Health score | 72 | **74** |
| Healthy matchups | 27 | **29** |
| Watch matchups | 18 | **17** |
| Critical matchups | 21 | **20** |
| Florestia Ascendant WR | 38.0% | **40.4%** |
| Florestia healthy/watch/critical | 2 / 2 / 7 | **4 / 1 / 6** |
| First-player WR | 50.4% | **50.1%** |

The global release gate remains **BLOCKED** because 20 critical matchups remain. The strongest deck is now Tidecall Vanguard at **58.3%**; the two lowest decks are Emberhold Ascendant at **40.5%** and Florestia Ascendant at **40.4%**.

## Scope guarantee

Vanilla 1.8 does **not** change:

- CardDef costs, stats, keywords, effects, rarity, or identity
- authoritative rules or reducers
- combat/reaction semantics
- AI policy priorities
- collection intake
- player persistence
- PvP or Ranked authority
- economy, Mercado Pago, rewards, or entitlement behavior
- Card Studio authoring semantics

The product change is intentionally limited to the experimental Florestia Ascendant recipe plus its regression contract and suite registration.

Temporary candidate-screen and certification workflow files used during exploration were removed before PR creation; they are evidence-generation scaffolding, not production surface.

## Conclusion and next balance slice

Vanilla 1.8 demonstrates that Florestia Ascendant still had meaningful composition headroom. A recipe-only change moved it from **38.0% to 40.4%** in the official matrix, doubled its healthy matchup count from **2 to 4**, reduced its critical count from **7 to 6**, and improved the global health score from **72 to 74** without touching CardDefs.

The deck is still the narrow weakest deck by 0.1 pp, with Emberhold Ascendant effectively sharing the low floor at 40.5%. The next balance slice should therefore remain diagnostic-first: compare the remaining Florestia Vanguard-pressure failures with Emberhold Ascendant's critical profile and select the next intervention by the largest evidence-backed global health gain. CardDef changes remain available only when composition/AI extraction evidence shows recipe headroom is exhausted.
