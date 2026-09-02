# Vanilla 1.7 — Emberhold Ceiling & Ascendant Floor

## Status

**Product recipes integrated and certified.**

Vanilla 1.7 attacks both sides of the post-1.6 balance spread: the remaining upper outlier, **Emberhold Vanguard at 63.2%**, and the weak Ascendant floor led by Voidborn, Florestia and Ironwood.

The engineering rule remained evidence-first:

1. test deck composition before changing CardDefs;
2. preserve all 180 experimental Vanilla cards and regional identities;
3. use the runtime-legal three-copy ceiling only when concentration evidence justifies it;
4. validate the final combined product state with the official five-strata Balance Lab;
5. keep Ranked, engine behavior and AI policy untouched.

No CardDef stat, mana cost, keyword, effect or rules text changed in this slice.

## Recipe laboratories

Two deterministic laboratories were executed before product mutation.

### Screen 1 — ceiling and duplicate selection

The first screen tested **32 candidate recipes × 528 games = 16,896 games**.

It established two facts:

- Emberhold Vanguard was highly responsive to composition-only changes. The 65.3% screen baseline could be moved into the desired band without a card nerf.
- Re-selecting the ten traditional two-copy Ascendant duplicates was not enough for the weakest regions. Ironwood barely moved, Florestia improved only slightly, and Voidborn was the only region with a material gain.

### Screen 2 — structural concentration

The second screen tested **29 candidates × 528 games = 15,312 games** and evaluated the runtime-legal three-copy ceiling while preserving one copy of every regional card.

Best structural signals:

| Target | Baseline | Selected structural candidate |
| --- | ---: | ---: |
| Emberhold Vanguard | 65.3% | `u13_single_stun` — 54.7% |
| Ironwood Ascendant | 36.2% | `finisher5_tripled` — 44.9% |
| Voidborn Ascendant | 31.1% | `finisher5_tripled` — 46.6% |
| Florestia Ascendant | 36.4% | `mixed_midgame_power` — 41.7% |

Across both screens, **32,208 deterministic diagnostic games** were executed before the product recipe was accepted.

## Accepted product recipes

### Emberhold Vanguard

The historical 36 Unit / 4 Spell recipe becomes **35 Units / 5 Spells**.

- `van_ember_u13` becomes a singleton instead of two copies.
- `van_ember_s04` is added as a singleton Stun interaction.
- `van_ember_s01` remains at two copies.
- `van_ember_s02` remains at two copies.
- Every other Emberhold Unit remains at two copies.

The change removes one duplicated Haste + Tough pressure body and replaces it with regional interaction rather than weakening any card definition.

### Ironwood Ascendant

All **30 regional Vanilla cards remain represented once**. The ten extra slots concentrate five evidence-selected Units to the legal three-copy ceiling:

- 3× `van_wood_u03`
- 3× `van_wood_u08`
- 3× `van_wood_u11`
- 3× `van_wood_u13`
- 3× `van_wood_u18`

All other regional cards remain singletons.

### Voidborn Ascendant

The same structural policy was strongest for Voidborn:

- 3× `van_void_u03`
- 3× `van_void_u08`
- 3× `van_void_u11`
- 3× `van_void_u13`
- 3× `van_void_u18`

All 30 regional cards remain represented and the deck stays at 40 cards.

### Florestia Ascendant

Florestia responded better to a mixed midgame concentration:

- 3× `van_forest_u08`
- 3× `van_forest_u11`
- 3× `van_forest_u13`
- 2× `van_forest_u03`
- 2× `van_forest_u05`
- 2× `van_forest_u14`
- 2× `van_forest_u18`

All other regional cards remain singletons. The recipe still contains all 30 regional Vanilla definitions.

## Runtime legality and collection coverage

The game runtime permits **up to three copies of a card**. Vanilla 1.4 had intentionally imposed a stricter two-copy Ascendant recipe contract; Vanilla 1.7 evolves that experimental contract only for Ironwood, Voidborn and Florestia based on measured evidence.

The resulting Ascendants still preserve:

- exactly **40 cards**;
- exactly **30 unique regional cards**;
- all regional Units, Spells and permanent types represented;
- maximum **3 copies** of any card;
- global experimental coverage of **180/180 `van_*` cards**.

Emberhold, Tidecall and Tempestade Ascendant retain their previous two-copy policies.

## Official combined product certification

After integrating all four recipe changes simultaneously, the unmodified official product Balance Lab was executed at full depth:

- **66/66 pairwise matchups**;
- **200 games per matchup**;
- **5 deterministic seed strata**;
- **13,200 completed games**;
- **0 incomplete matchups**;
- **0 pool errors**;
- **66/66 stable matchups**;
- first-player win rate **50.4%**;
- draw rate **0%**;
- maximum seed deviation **18.5 pp**, below the **23.7 pp** threshold;
- simulation quality gate: **PASS**;
- balance health score: **72**.

The dedicated certification also passed TypeScript and the complete **84/84 behavioral target suite**.

## Meta improvement

Vanilla 1.7 produces the largest recipe-only improvement of the regional tuning cycle so far:

- Vanilla 1.6: **21 healthy / 13 watch / 32 critical**;
- Vanilla 1.7: **27 healthy / 18 watch / 21 critical**.

That is **11 fewer critical matchups** without touching a CardDef.

Final global deck win rates:

| Deck | Win rate | Healthy / Watch / Critical |
| --- | ---: | ---: |
| Ironwood Vanguard | 58.0% | 4 / 5 / 2 |
| Tidecall Vanguard | 57.9% | 2 / 5 / 4 |
| Florestia Vanguard | 56.4% | 6 / 1 / 4 |
| Tempestade Vanguard | 55.6% | 5 / 3 / 3 |
| Emberhold Vanguard | **53.6%** | 4 / 2 / 5 |
| Voidborn Vanguard | 53.2% | 5 / 3 / 3 |
| Tidecall Ascendant | 47.7% | 9 / 1 / 1 |
| Voidborn Ascendant | **47.4%** | 3 / 6 / 2 |
| Tempestade Ascendant | 47.2% | 5 / 2 / 4 |
| Ironwood Ascendant | **44.6%** | 6 / 2 / 3 |
| Emberhold Ascendant | 40.5% | 3 / 4 / 4 |
| Florestia Ascendant | **38.0%** | 2 / 2 / 7 |

Regional aggregate win rates also compress substantially: Tidecall 52.8%, Tempestade 51.4%, Ironwood 51.3%, Voidborn 50.3%, Florestia 47.2% and Emberhold 47.1%.

The global release gate remains correctly **BLOCKED** because 21 critical matchups remain. Vanilla 1.7 is a major convergence step, not a claim that experimental Vanilla balance is finished.

## Regression contract

`src/game/vanilla-regional-recipes-1-7.test.ts` freezes the accepted product state and verifies:

- Emberhold Vanguard 40-card / 35 Unit / 5 Spell structure;
- singleton `u13` and singleton `s04` replacement;
- exact Ironwood and Voidborn five-card triple-copy cores;
- exact Florestia mixed triple/double concentration;
- 40 cards and 30 unique regional cards for every evolved Ascendant;
- maximum three-copy runtime ceiling;
- permanent 180/180 experimental collection coverage.

The older Vanilla 1.4 contract remains responsible for the regions that did not evolve to three-copy concentration, rather than rewriting historical guarantees.

The Vanilla 1.7 contract is registered as the **84th behavioral target**.

## Scope guarantee

Vanilla 1.7 changes only experimental deck recipes and their regression/documentation contracts.

It does **not** change:

- CardDefs;
- authoritative engine rules;
- AI policy;
- runtime deck-copy rules;
- Studio authoring behavior;
- Ranked deck content or Ranked certification;
- database or commerce behavior.

## Next balance target

The upper end is now compressed: **Ironwood Vanguard at 58.0%** is the strongest deck and is no longer an extreme global ceiling.

The more important remaining problem is the floor. **Florestia Ascendant at 38.0%** is now the weakest deck, followed by Emberhold Ascendant at 40.5%. Florestia also retains seven critical direct matchups.

The next slice should therefore be **Vanilla 1.8 — Florestia Ascendant Floor**, beginning with regional/card utilization diagnostics. Because two recipe laboratories have already shown limited Florestia response to composition alone, Vanilla 1.8 is the first slice where a narrowly scoped CardDef-level investigation may be justified — but only after the same evidence-first isolation process.