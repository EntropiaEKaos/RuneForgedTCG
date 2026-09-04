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
