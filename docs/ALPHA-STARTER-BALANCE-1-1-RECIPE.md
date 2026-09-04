# Alpha Starter Balance 1.1 — Recipe-Only Refinement

## Objective

Reduce the three critical Alpha starter matchups revealed by the certified 1.0 stack-aware baseline **without changing card stats, effects, rules, AI policy, engine behavior, Ranked, economy or visual surfaces**.

Starting point: `main` at `91eaf344facd6878ba12dc5e35a7f55c9e91e39f`.

Baseline 1.0:

- 3,000/3,000 games;
- 15/15 pairwise matchups;
- stack-aware reactions;
- Trap reaction coverage errors: 0;
- first-player: 50.5%;
- health score: 78;
- 8 healthy / 4 watch / 3 critical.

Critical matchups:

- Ironwood vs Florestia: 28.0 / 72.0;
- Emberhold vs Ironwood: 68.0 / 32.0;
- Tidecall vs Florestia: 37.5 / 62.5.

## Evidence discipline

Every experimental recipe:

1. changes only declared existing recipe slots;
2. stays at exactly 40 cards;
3. remains legal under `validateDeck`;
4. preserves exactly Structure + Ritual + Trap teaching cards;
5. uses only existing collectible cards;
6. is applied as a read-only simulator override;
7. is evaluated against the **entire six-starter matrix**.

No exploratory candidate mutates `decks.ts`.

## Round 1 — proactive-power hypothesis

The first experiment targeted the most stranded cards:

- Ironwood `wood_wither`: ~17.6% play rate when seen;
- Ironwood `wood_bark_rupture`: ~18.7%;
- Tidecall `tide_dispel`: ~16.6%.

Twelve candidates replaced those slots with highly utilized proactive cards such as Champion, Canopy, Draw and Mirror.

### Round-1 grid

- 12 individual candidates at reduced full-matrix screening;
- top 2 Wood × top 2 Tide;
- four finalists at 3,000 games each;
- unchanged 3,000-game baseline control;
- **24,750 total games**.

Artifact:

- ZIP SHA-256: `0d24e536f485974a3bc212558992daec7243d2aa920da59d2b256bd59266409f`;
- JSON SHA-256: `2ccbb33a07e0bcfbfb8a83187562cfc7fbd39a4ad50c7d3830d8308a823b28d0`.

Baseline control remained:

- 3 critical;
- 4 watch;
- health 78;
- first-player 50.5%.

Best Round-1 finalist:

`wood_one_wither_to_champion__tide_one_dispel_to_draw`

Result:

- 4 critical;
- 6 watch;
- health 74;
- first-player 50.8%.

It improved Ember×Wood from 68/32 to 60/40 and Tide×Florestia from 37.5/62.5 to 40/60, but Ironwood became too strong elsewhere, creating critical matchups against Tide, Void and Tempestade while still remaining critical against Florestia.

### Round-1 decision

**Rejected. No recipe promoted.**

The result proves that generic proactive power is the wrong lever.

## Round 2 — matchup-specific tech

Round 2 keeps the same grid methodology but replaces dead permanent-only interaction with defensive/control tools already legal in the certified regional identities.

The goal is not to make Ironwood or Tide generally stronger. The goal is to improve their bad combat shapes against Ember/Florestia without pushing healthy matchups across 60%.

### Ironwood — six tech candidates

Ironwood is Tidecall/Ironwood, so the following Tidecall tools are legal recipe options.

1. `wood_wither -> tide_guard`
   - 2/5 Tough + Reach blocker;
   - targets Ember and Florestia combat pressure.

2. `wood_bark_rupture -> tide_guard`
   - preserves both cheap Withers;
   - replaces one expensive permanent-only answer with defense.

3. `wood_wither -> tide_heal`
   - +4 Nexus health;
   - specifically buys turns against rush without increasing board stats.

4. `wood_wither -> tide_stun`
   - cheap unit tempo;
   - can interrupt Ember and Florestia attack turns.

5. `wood_wither -> tide_freeze`
   - 2 damage + draw;
   - board interaction plus replacement card rather than generic stat density.

6. `wood_bark_rupture -> tide_stun`
   - preserves both Withers;
   - converts one expensive permanent answer into combat tempo.

### Tidecall — six tech candidates

Each keeps one `tide_dispel` and converts the second target-starved copy into broader creature/combat interaction.

1. `tide_dispel -> tide_heal` — third Soothing Tide;
2. `tide_dispel -> tide_freeze` — third Riptide;
3. `tide_dispel -> tide_stun` — third Riptide Stun;
4. `tide_dispel -> tide_frostbite` — third Flash Freeze;
5. `tide_dispel -> tide_recall` — second Recall;
6. `tide_dispel -> tide_shield` — third Ripcurrent Ward.

## Two-stage grid

### Stage 1 — screening

For all 12 individual candidates:

- 15 matchups;
- 5 deterministic seed strata;
- 10 games per stratum;
- 50 games per matchup;
- 750 games per candidate.

A baseline control runs at the same sample.

Ranking priority:

1. fewer critical matchups;
2. fewer watch matchups;
3. higher health score;
4. lower first-player skew.

Top two Ironwood and top two Tidecall candidates advance.

### Stage 2 — finalists

Four Wood × Tide combinations:

- 15 matchups;
- 5 seed strata;
- 40 games per stratum;
- 200 games per matchup;
- **3,000 games per finalist**.

A full unchanged 3,000-game baseline control runs in the same workflow.

Expected volume: approximately 25,000 games.

## Promotion rule

A finalist is not promoted merely for improving one target matchup.

Promotion requires:

- complete/stable matrix;
- no new critical matchup;
- fewer critical matchups than baseline, or a clearly superior global profile with no compensating regression;
- no material first-player skew regression;
- exact real recipe reproduces the simulation after promotion;
- CI, behavioral, coverage, build, E2E and four visual certs all green.

If Round 2 still fails, the next hypothesis is controlled recipe nerf of the common overperformers (Florestia and/or Ember), not repeated generic buffs to weak decks.

## Files

- `src/game/alpha-starter-balance-1-1.ts` — candidate definitions;
- `src/game/alpha-starter-balance-1-1.test.ts` — legality/slot-locality contract;
- `scripts/alpha-starter-balance-recipe-grid.ts` — two-stage deterministic grid;
- `.github/workflows/alpha-starter-balance-recipe-grid.yml` — grid workflow;
- this document.
