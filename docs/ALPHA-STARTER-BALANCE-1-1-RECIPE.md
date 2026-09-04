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

## Round 3 — controlled Florestia + Ember softening

Round 2 also failed to move the certified criticals. Its best finalist reproduced the baseline aggregate profile (3 critical / 4 watch / health 78) but left Ember×Wood and Wood×Florestia unchanged and worsened Tide×Florestia to 36/64.

Artifact:

- ZIP SHA-256: `6aa0ce66a37838f2d14a4dc80322658fca0c1bcda8c53f4bee9c96a4a2a8afbb`;
- JSON SHA-256: `a6d8d2c8657497a4a0baae42f89e20d2f92f050377e8c4446e752fb82ecf3d8d`.

**Round-2 decision: rejected.**

The third hypothesis acts directly on the common overperformers, while staying recipe-only.

### Florestia candidates

Florestia is present in two critical matchups. Candidates reduce one or two tribal power spikes and replace them with slower existing utility:

1. Packrunner -> third Summon Pack;
2. Alpha -> third Summon Pack;
3. Champion -> third Summon Pack;
4. Packrunner + Alpha -> Summon Pack + third Nature's Mending;
5. Packrunner + Champion -> Summon Pack + third Nature's Mending;
6. Alpha + Champion -> Summon Pack + third Nature's Mending.

This spans mild to strong softening without changing the deck's Structure/Ritual/Trap or regional identity.

### Ember candidates

Ember is present in the remaining critical matchup. Instead of inserting dead cards, candidates trade a small amount of raw damage/curve density for existing interactive Ember cards:

1. Bolt -> second Flame Lash;
2. Whelp -> second Flare Line;
3. Whelp + Bolt -> Flame Lash + Flare Line;
4. Drake + Bolt -> Flame Lash + Flare Line;
5. Whelp + Drake -> Flame Lash + Flare Line;
6. Champion + Bolt -> Flame Lash + Flare Line.

The intent is to reduce Ember's 68/32 edge into Ironwood while preserving its already-watch matchup against Tempestade.

### Round-3 result

Round 3 produced the first meaningful global improvement but still failed the promotion rule.

Best finalist:
`forest_packrunner_champion_to_summon_mend__ember_drake_bolt_to_stun_flare`

Result:

- health 80;
- first-player 50.9%;
- 3 critical;
- 5 watch.

Key matchup movement:

- Tide × Florestia: 37.5/62.5 -> 50.5/49.5;
- Wood × Florestia: 28/72 -> 37.5/62.5;
- Ember × Wood: 68/32 -> 66/34;
- Florestia × Tempestade: became 35.5/64.5.

Artifact:

- ZIP SHA-256: `abaf5401d4c340ad1be7ff8512de73759696ea1b2f37b4e8dda66753738e5a2f`;
- JSON SHA-256: `4697c7c30bf99bda992a886932dbb02d00f04ec6263b5c3e848ec268d783b62c`.

**Round-3 decision: rejected.** Health improved, but the critical count did not fall below three and the Florestia softening created a new critical against Tempestade.

## Round 4 — preserve anti-air while softening

Round 4 keeps the productive Florestia/Ember direction but compensates precisely for the new weakness.

### Florestia anti-air candidates

Instead of replacing tribal power with generic healing, Florestia now replaces one amplifier/finisher with slower **Reach** bodies already legal in its Ironwood/Florestia identity:

- `forest_canopy_warden` — 3/4 Reach Beast;
- `wood_webweaver` — 2/4 Reach Beast.

Six candidates combine Packrunner or Alpha softening with Summon Pack, Canopy Warden and Webweaver.

Goal:

- keep Tide × Florestia out of critical;
- push Wood × Florestia toward 40/60;
- restore Florestia × Tempestade above the 40% critical floor.

### Ember Ashguard candidates

Round 3's Drake+Bolt -> Stun+Flare only moved Ember × Wood from 68/32 to 66/34.

Round 4 adds `ember_ashguard` (2/3 Tough) as the compensating defensive card. This lowers raw aggro pressure while helping Ember survive Tempestade rather than merely weakening every matchup.

Six candidates remove different combinations of:

- Whelp;
- Drake;
- Bolt;
- Champion;

and replace them with controlled mixtures of:

- Ashguard;
- Flame Lash;
- Flare Line.

The strongest candidate changes three slots, but no CardDef, rule or semantic teaching slot is altered.

### Round-4 promotion requirement

Promotion still requires fewer than three critical matchups in the full 3,000-game finalist matrix. Health-score improvement alone is not enough.

## Exploration implementation lifecycle

The candidate helper, two-stage grid script and exploratory grid workflow existed only while Rounds 1–4 were being measured. They were deliberately removed after promotion so the merge diff contains no dormant experimental execution path.

Historical methodology and artifact hashes remain documented here; the final branch keeps only the canonical recipe, canonical test and canonical 3k gate.

## Round 4 result — promoted candidate

Round 4 is the first experiment that satisfies the promotion rule.

Artifact:

- ZIP SHA-256: `0895e55455af224df83837edbe5f4d5a54aa2221b6ab822b34735bd2f49f2da5`;
- JSON SHA-256: `7b519616d088c07e0806c06ccfc982f84b3395f97a41d6616100e5d870ad07f3`;
- total simulated games: 24,750;
- quality: PASS.

Best finalist:

`forest_packrunner_alpha_to_canopy_web__ember_whelp_bolt_to_ashguard_stun`

Full 3,000-game result:

- health score: **80**;
- first-player: **51.3%**;
- 5 healthy / 8 watch / **2 critical**.

Criticals remaining:

- Emberhold vs Ironwood: **68.5 / 31.5**;
- Ironwood vs Florestia: **36 / 64**.

Important repaired matchups:

- Tidecall vs Florestia: **43.5 / 56.5** — no longer critical;
- Florestia vs Tempestade: **42 / 58** — no longer critical.

The recipe therefore reduces the certified critical count from 3 to 2 without introducing a replacement critical elsewhere.

### Promoted exact recipe delta

Florestia:

- -1 `forest_packrunner`;
- +1 `forest_canopy_warden`;
- -1 `forest_alpha`;
- +1 `wood_webweaver`.

Emberhold:

- -1 `ember_whelp`;
- +1 `ember_ashguard`;
- -1 `ember_bolt`;
- +1 `ember_stun`.

The changes are committed in the exact textual positions produced by the deterministic `replaceFirst` screening harness. This preserves the same seed-to-game population used for the finalist evidence.

## Canonical certification

The exploratory candidate helper and grid workflow are removed after promotion.

The final branch instead contains:

- the real recipe change in `src/game/decks.ts`;
- `src/game/alpha-starter-balance-1-1.test.ts` locking both exact 40-card arrays and their order;
- `.github/workflows/alpha-starter-balance-1-1.yml` running the real recipe through 3,000 games.

The canonical gate fails closed unless:

1. 3,000/3,000 games complete;
2. all 15 matchups complete;
3. simulation quality and reaction coverage pass;
4. health score remains at least 80;
5. critical matchups remain at most 2;
6. the only allowed critical pairs are Ember×Ironwood and Ironwood×Florestia;
7. first-player rate remains within ±2 percentage points of 50%.

This does **not** claim Alpha balance is finished. The residual two criticals become the explicit target of the next recipe iteration, after 1.1 is certified and integrated.
