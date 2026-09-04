# Alpha Starter Balance 1.4 — Watch Compression

## Certified starting point

Balance 1.3 is certified on `main` at
`3b6a33839a03b3a9d387dc794b05c6c1448ea7ee`.

Canonical 3,000-game profile:

- health score: **89**;
- first-player: **51.3%**;
- healthy: **8**;
- watch: **7**;
- critical: **0**.

The seven watch matchups are:

- Emberhold × Tidecall: 43/57;
- Emberhold × Ironwood: 58/42;
- Emberhold × Tempestade: 40/60;
- Tidecall × Ironwood: 40.5/59.5;
- Tidecall × Florestia: 42.5/57.5;
- Ironwood × Florestia: 40/60;
- Ironwood × Tempestade: 57.5/42.5.

Balance 1.4 is not allowed to sacrifice the zero-critical state merely to raise
the aggregate score.

## Telemetry diagnosis

### Emberhold

Ember is weak into Tempestade (40/60) but already favored into Ironwood
(58/42).

Candidate direction:

- remove one scaling/resilient pressure slot whose value is higher into large
  Ironwood bodies;
- replace it with small-board damage/AoE whose value should concentrate on
  Tempestade.

The tested sources are Soulbrand and the remaining Steamscale Wyrm. Replacements
are Cinder Snap or Senior Pyromancer.

### Tidecall

Tide is weak into Ironwood (40.5/59.5) and Florestia (42.5/57.5), while already
favored into Emberhold (57/43).

The utilization telemetry shows `tide_dispel` as highly stranded overall, but
1.4 deliberately does not turn that into a generic power increase.

Instead every Tide candidate replaces one `tide_heal`:

- remove pure anti-aggro Nexus sustain that helps preserve Tide's edge over
  Ember;
- add a tool that scales better against large attackers/boards.

The four replacements are Recall, Flash Freeze, Glacial Tomb and Frost Guard.

## Round 1 grid

Screening:

- 4 Ember candidates;
- 4 Tide candidates;
- full 15-matchup matrix;
- 5 deterministic seed strata;
- 10 games per stratum;
- 750 games per candidate;
- 750-game baseline screen.

Finalists:

- top 2 Ember candidates;
- top 2 Tide candidates;
- four cross-family finalists;
- 3,000 games per finalist;
- unchanged 3,000-game 1.3 baseline control.

Expected total: **21,750 games**.

## Promotion guardrails

A finalist is promotion-eligible only if:

1. all games complete;
2. critical matchup count remains exactly zero;
3. no new critical pair appears;
4. watch matchup count drops below 7;
5. health score rises above 89;
6. Ember × Tempestade does not regress below its 40% baseline;
7. Ember × Tide does not regress below its 43% baseline;
8. Tide × Ironwood does not regress below its 40.5% baseline;
9. Tide × Florestia does not regress below its 42.5% baseline;
10. first-player remains within ±2 percentage points of 50%.

No canonical recipe is changed during exploration. If no candidate qualifies,
Round 1 is rejected without forcing a balance change.


## Round 1 result — rejected

Round 1 completed **21,750 games** with quality PASS.

Artifact:
- workflow: Alpha Starter Balance 1.4 Watch Compression Grid #1;
- ZIP SHA-256: `04077a98cc93f3fd2768e74e7881979d5d2dc69a68bb03c2c9c7572d8cde3c07`.

No finalist was promotion-eligible.

Best finalist:
`ember_soulblade_to_pyromancer__tide_heal_to_frostbite`

Result:
- health: 90;
- watch: 4;
- critical: 1;
- first-player: 51.2%.

The apparent global compression was invalid because it recreated:
- Ember × Tempestade: **38/62 critical**.

Useful movement:
- Ember × Tide: 46/54;
- Ember × Ironwood: 55/45.

Conclusion: removing Ember scaling is the wrong lever. It compresses several
pairs but makes Tempestade too dominant. No Round-1 recipe is promoted.

## Round 2 — Tempestade/Tide redistribution

Round 2 leaves Emberhold untouched.

### Tempestade candidates

Tempestade currently beats Ember 60/40 but loses to Ironwood 42.5/57.5.

The new candidates replace one cheap burn slot that is especially efficient
against Ember's fragile units with either:

- Gale — higher-cost bounce that scales better into large Ironwood units; or
- Thunder Angel — a slower Flying/Lifesteal threat for longer games.

The tested sources are one Ember Bolt or one Chain Bolt.

### Tide candidates

Round 1 showed that removing a heal by itself does not repair Tide's Wood or
Florestia matchups.

Round 2 therefore changes two slots together:

- remove one Soothing Tide to avoid increasing Tide's anti-aggro edge;
- remove one highly stranded Disenchant Tide;
- add two large-board tools selected from Recall, Flash Freeze, Glacial Tomb
  and Frost Guard.

The grid size remains 21,750 games and promotion still requires zero criticals,
fewer than 7 watches, health above 89, directional improvement on the target
pairs and first-player within ±2pp.


## Round 2 result — rejected

Round 2 completed another **21,750 games** with quality PASS.

Artifact:
- workflow: Alpha Starter Balance 1.4 Watch Compression Grid #5;
- ZIP SHA-256: `c192a259ad76450f723d156708143a86801d6956b4bc33db74c16451cb87702c`.

No finalist was promotion-eligible.

Best finalist:
`storm_chainbolt_to_thunderangel__tide_heal_dispel_to_recall_glacial`

Result:
- health: 89;
- watch: 5;
- critical: 1;
- first-player: 51.1%.

The remaining blocker was:
- Ember × Tempestade: **39.5/60.5 critical**.

Useful movement:
- Ember × Tide: 48/52;
- Tide × Ironwood: 42/58;
- Wood × Tempestade: 53/47.

Conclusion: the Tide package is promising, but every tested Tempestade change
crosses the Ember floor. No Round-2 recipe is promoted.

## Round 3 — Tide-only full verification

Round 3 freezes Emberhold, Tempestade, Ironwood and Florestia at their certified
1.3 recipes.

Four Tide-only candidates are each tested directly at **3,000 games**:

1. Heal + Dispel -> Recall + Glacial;
2. Heal + Dispel -> Recall + Flash Freeze;
3. Dispel -> Recall;
4. Dispel -> Glacial.

There is no reduced screening stage. Including the unchanged 3,000-game
baseline, Round 3 runs **15,000 games**.

Promotion requires:
- zero critical matchups;
- fewer than 7 watches;
- health above 89;
- no new critical pair;
- Ember × Tempestade, Wood × Tempestade and Wood × Florestia unchanged;
- every Tide tracked matchup remaining at or above the 40% critical floor;
- first-player within ±2pp.


## Round 3 result — promoted candidate

Round 3 completed **15,000 games** with quality PASS:

- unchanged 1.3 baseline: 3,000 games;
- four Tide-only candidates: 3,000 games each.

Artifact:
- workflow: Alpha Starter Balance 1.4 Watch Compression Grid #9;
- ZIP SHA-256: `f086868090bc6b25d1fb8a33397ac8dfa69ed2d00d4214f3b7519a2da37fba93`.

Two candidates were promotion-eligible. The best was:

`tide_dispel_to_recall`

Exact recipe delta:

- first `tide_dispel -> tide_recall`.

This is the smallest possible promotion: one textual recipe slot only.

Full 3,000-game result:

- health score: **90** (baseline 89);
- first-player: **51.5%**;
- healthy: **9**;
- watch: **6** (baseline 7);
- critical: **0**;
- new critical pairs: **0**.

Key movement:

- Ember × Tide: **43/57 -> 47/53**, now healthy;
- Tide × Ironwood: **40.5/59.5 -> 43/57**;
- Tide × Void: **53/47**, healthy;
- Tide × Florestia: **42.5/57.5 -> 41/59**, still watch and non-critical;
- Tide × Tempestade: **53.5/46.5**, healthy.

Frozen guardrails reproduced exactly:

- Ember × Ironwood: **58/42**;
- Ember × Tempestade: **40/60**;
- Ironwood × Florestia: **40/60**;
- Ironwood × Tempestade: **57.5/42.5**.

The remaining six watch matchups are:

- Ember × Ironwood: 58/42;
- Ember × Tempestade: 40/60;
- Tide × Ironwood: 43/57;
- Tide × Florestia: 41/59;
- Ironwood × Florestia: 40/60;
- Ironwood × Tempestade: 57.5/42.5.

## Canonical 1.4 certification

After promotion, all exploratory candidate/grid source and the exploratory grid
workflow are removed from the branch.

The final implementation contains:

- the real one-slot Tide recipe change in `src/game/decks.ts`;
- `src/game/alpha-starter-balance-1-4.test.ts` locking the exact 40-card Tide
  order;
- `.github/workflows/alpha-starter-balance-1-4.yml` running the canonical
  3,000-game matrix;
- this complete three-round evidence document.

The canonical gate fails closed unless:

1. all 3,000 games complete;
2. all 15 matchups complete;
3. simulation quality passes;
4. reaction coverage errors remain zero;
5. critical matchup count remains exactly zero;
6. watch matchup count is at most 6;
7. health score remains at least 90;
8. first-player remains within ±2 percentage points of 50%.

Balance 1.4 is not integrated until the promoted exact head passes CI, historical
balance compatibility gates, Alpha/Ecos evidence, all visual certs, and the same
certification again after squash merge on `main`.
