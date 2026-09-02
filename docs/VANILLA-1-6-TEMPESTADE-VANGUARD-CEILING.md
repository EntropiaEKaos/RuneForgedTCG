# Vanilla 1.6 — Tempestade Vanguard Ceiling

## Status

**Candidate recipe selected and certified for product integration.**

Vanilla 1.6 continues the evidence-first regional outlier work started in Vanilla 1.5. The target is the post-1.5 meta ceiling, **Tempestade Vanguard**, which entered this slice at **67.5% global win rate** in the certified 13,200-game matrix.

The implementation rule remained strict throughout the investigation:

1. isolate recipe/concentration effects first;
2. do not mutate CardDefs while deck composition can solve the outlier;
3. preserve Tempestade's evasive/rush identity instead of flattening the region;
4. certify the finalist with the same deterministic full-matrix protocol used by the official Vanilla Balance Lab.

No CardDef, engine rule, AI policy, Ascendant recipe or Ranked deck was changed in this slice.

## Why Tempestade Vanguard was the next target

After Vanilla 1.5, Tempestade Vanguard was the strongest remaining experimental deck at **67.5%**. Its historical Vanguard recipe duplicated all 18 Units and used only four Spells, concentrating pressure across the entire curve rather than at one isolated finisher.

The most relevant duplicated pressure package included:

- `u03` — 2-cost QuickAttack + Elusive;
- `u05` — 2-cost 3/2 Elusive;
- `u08` — 3-cost 4/2 Flying with draw;
- `u11` — 4-cost 5/3 Elusive;
- `u13` — 5-cost 5/5 Haste + QuickAttack;
- `u14`, `u17`, `u18` — additional Flying/Elusive top-end pressure.

This made a top-end-only cut an insufficient hypothesis. The lab therefore compared reductions in duplicated evasive pressure against top-end cuts and broader control/toolbox substitutions.

## Recipe laboratory

Two deterministic recipe screens were run without changing product deck definitions.

### Screen 1 — 5,280 games

Ten recipes were tested against all 11 Tempestade Vanguard opponents using 16 games × 3 seed strata per matchup.

The historical `36 Units / 4 Spells` baseline reproduced the ceiling at **67.6%**. Recipe-only candidates immediately reduced it into the intended band, proving that a CardDef nerf was not justified.

### Full-strata finalist screen — 22,000 games

The same ten recipes were then rerun at 40 games × 5 deterministic strata per opponent: **2,200 games per recipe, 22,000 total**.

Key candidates:

| Candidate | Units / Spells | Global WR | Healthy / Watch / Critical | Matchup range |
| --- | ---: | ---: | ---: | ---: |
| Historical baseline | 36 / 4 | 67.5% | 2 / 1 / 8 | 49.5%–84.0% |
| `pressure32_no_extra_burn` | 32 / 8 | 54.4% | 3 / 3 / 5 | 41.0%–66.5% |
| `pressure32_core` | 32 / 8 | 55.7% | 3 / 3 / 5 | 40.0%–71.0% |
| **`evasion32`** | **32 / 8** | **57.1%** | **5 / 1 / 5** | **41.0%–71.5%** |
| `pressure30_toolbox` | 30 / 10 | 53.0% | 2 / 4 / 5 | 38.0%–66.0% |
| `topend34_bounce` | 34 / 6 | 60.2% | 3 / 2 / 6 | 43.0%–81.5% |

`evasion32` was selected because it produces the best identity-preserving matchup shape. It makes five matchups healthy, leaves only one on watch, and its five remaining critical wins are all against structurally weaker Ascendant decks from other regions. It does not overcorrect Tempestade merely to compensate for those opponent floors.

## Accepted recipe — `evasion32`

The final Tempestade Vanguard deck remains 40 cards but moves from **36 Units / 4 Spells** to **32 Units / 8 Spells**.

### Units

All 18 regional Units remain represented.

The following four high-density evasive/draw threats become **singletons**:

- `van_storm_u03`
- `van_storm_u05`
- `van_storm_u08`
- `van_storm_u11`

Every other `van_storm_u01`–`van_storm_u18` Unit remains at two copies.

### Spells

The certified eight-card control package is:

- 2× `van_storm_s01`
- 2× `van_storm_s02`
- 2× `van_storm_s05`
- 2× `van_storm_s06`

The resulting deck has:

- **40 cards**;
- **32 Units / 8 Spells**;
- **22 unique cards**;
- **3.8 average mana cost**;
- **4 cards at cost 7+**;
- **maximum 2 copies** of any card;
- all cards mono-Tempestade;
- no Enchantment, Artifact, Equipment or Sentinela intake.

Tempestade Ascendant remains the independent 40-card / 30-unique recipe certified in Vanilla 1.4.

## Full 66-matchup certification

The accepted `evasion32` candidate was then injected in-memory as the **only** changed deck and run through the complete official Balance Lab topology:

- **66/66 pairwise matchups**;
- **200 games per matchup**;
- **5 deterministic seed strata**;
- **13,200 completed games**;
- **0 incomplete matchups**;
- **0 pool errors**;
- **66/66 stable matchups**;
- first-player win rate **50.3%**;
- draw rate **0%**;
- maximum seed deviation **16.0 pp**, below the **23.7 pp** stability threshold;
- simulation quality gate: **PASS**.

### Tempestade Vanguard result

Tempestade Vanguard finished:

- **57.1% global win rate** over 2,200 games;
- 95% Wilson interval **55.1%–59.2%**;
- **5 healthy / 1 watch / 5 critical** direct matchups.

Direct matchup results:

| Opponent | Tempestade Vanguard WR | Status |
| --- | ---: | --- |
| Emberhold Vanguard | 47.0% | healthy |
| Emberhold Ascendant | 70.5% | critical |
| Tidecall Vanguard | 41.0% | watch |
| Tidecall Ascendant | 66.5% | critical |
| Ironwood Vanguard | 45.0% | healthy |
| Ironwood Ascendant | 71.5% | critical |
| Voidborn Vanguard | 51.0% | healthy |
| Voidborn Ascendant | 67.0% | critical |
| Florestia Vanguard | 46.0% | healthy |
| Florestia Ascendant | 70.0% | critical |
| Tempestade Ascendant | 53.0% | healthy |

This is the key engineering signal: **every remaining critical Tempestade Vanguard matchup is against another region's Ascendant**, while its four other untreated Vanguards and its own Ascendant are healthy; Tidecall Vanguard sits in watch at 41.0%.

## Global meta result

The full matrix improves again:

- Vanilla 1.5: **18 healthy / 13 watch / 35 critical**;
- Vanilla 1.6: **21 healthy / 13 watch / 32 critical**.

Three additional critical matchups are eliminated without changing a single card definition.

Final deck-level win rates:

| Deck | Win rate |
| --- | ---: |
| Emberhold Vanguard | 63.2% |
| Ironwood Vanguard | 60.0% |
| Tidecall Vanguard | 59.4% |
| Florestia Vanguard | 58.7% |
| Tempestade Vanguard | 57.1% |
| Voidborn Vanguard | 55.4% |
| Tempestade Ascendant | 49.4% |
| Tidecall Ascendant | 49.0% |
| Emberhold Ascendant | 41.8% |
| Ironwood Ascendant | 36.4% |
| Florestia Ascendant | 35.7% |
| Voidborn Ascendant | 33.9% |

The global release gate remains correctly **BLOCKED** because 32 critical matchups still exist. Vanilla 1.6 is not a claim that the experimental meta is finished; it is a measured removal of the Tempestade ceiling without collateral CardDef damage.

## Regression contract

`src/game/vanilla-tempestade-vanguard-ceiling-1-6.test.ts` freezes the accepted product recipe and verifies:

- 40-card size;
- 32 Unit / 8 Spell composition;
- 22 unique cards;
- 3.8 average cost;
- four 7+ cost cards;
- singleton `u03/u05/u08/u11` contract;
- exact two-copy `s01/s02/s05/s06` package;
- maximum two-copy ceiling;
- mono-Tempestade legality;
- Unit/Spell-only intake;
- independent Tempestade Ascendant recipe.

It is registered as the **83rd behavioral target**.

## Scope guarantee

Vanilla 1.6 changes only the experimental Tempestade Vanguard recipe and its evidence/documentation contracts.

It does **not** change:

- any CardDef stat, mana cost, keyword, effect or rules text;
- authoritative game engine behavior;
- AI policy;
- Tempestade Ascendant or another Ascendant recipe;
- Ranked content or Ranked certification;
- Studio authoring behavior.

## Next balance target

After this correction the new **upper ceiling is Emberhold Vanguard at 63.2%**. At the same time, the remaining lower floor is concentrated in Ascendants, led by Voidborn Ascendant at 33.9%, Florestia Ascendant at 35.7% and Ironwood Ascendant at 36.4%.

The next slice should therefore inspect **Emberhold Vanguard concentration versus the persistent Ascendant floor** before any card-level changes. The same rule remains in force: recipe evidence first, CardDefs only if composition cannot solve the measured problem.
