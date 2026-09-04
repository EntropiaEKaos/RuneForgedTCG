# Alpha Starter Balance 1.2 — Ironwood Focus

## Starting point

Balance 1.1 is certified on `main` at `5ec1f23492b1c60da7b2954af18ffe47eee4b04a`.

Certified profile:

- 3,000/3,000 games;
- 15/15 matchups;
- simulation quality PASS;
- reaction coverage errors: 0;
- health score: 80;
- first-player: 51.3%;
- 2 critical matchups.

Residual criticals:

- Emberhold × Ironwood: 68.5 / 31.5;
- Ironwood × Florestia: 36 / 64.

Ironwood is the common loser in both remaining criticals, so 1.2 is intentionally Wood-only.

## Telemetry diagnosis

Ironwood aggregate win rate is 47.5%, but two recipe slots remain heavily stranded:

- `wood_wither` — 17.3% play rate when seen, 82.7% end-hand;
- `wood_bark_rupture` — 18.6% play rate when seen, 81.6% end-hand.

At the same time, Ironwood already sits at 59.5% against Tidecall. Generic power is therefore unsafe.

## Candidate set

Eight one-slot candidates replace exactly one stranded permanent-only answer with interaction aimed primarily at unit-heavy Ember/Florestia boards:

- Wither -> Flash Freeze;
- Bark Rupture -> Flash Freeze;
- Wither -> Riptide Stun;
- Bark Rupture -> Riptide Stun;
- Wither -> third Root Prison;
- Bark Rupture -> third Root Prison;
- Wither -> Soothing Tide;
- Bark Rupture -> Soothing Tide.

Every candidate:

- remains exactly 40 cards;
- stays inside Tidecall/Ironwood regional legality;
- changes exactly one textual recipe slot;
- preserves Structure + Ritual + Trap;
- exists only as a read-only simulator override.

## Grid

Screening:

- 8 candidates;
- full 15-matchup matrix;
- 5 deterministic seed strata;
- 10 games per stratum;
- 750 games per candidate;
- reduced unchanged baseline control.

Finalists:

- top 4 candidates;
- 3,000 games each;
- unchanged 3,000-game 1.1 baseline control.

Expected total: 21,750 games.

## Ranking and promotion guardrails

The grid penalizes in this order:

1. critical matchup count;
2. new critical pairs not present in the 1.1 baseline;
3. Ironwood exceeding 60% against Tidecall;
4. watch matchup count;
5. health score;
6. first-player skew.

A candidate is promotion-eligible only if:

- it completes the full matrix;
- critical count drops below the 1.1 baseline count of 2;
- it creates zero new critical pairs;
- Wood × Tide remains at or below 60%;
- first-player remains within ±2pp of 50%.

No recipe is changed in `decks.ts` during exploration.

## Promotion discipline

If an eligible candidate exists:

1. promote its exact textual replacement to the canonical Ironwood recipe;
2. remove exploratory helper/grid code;
3. lock the exact 40-card order in a behavioral contract;
4. add a canonical 1.2 3,000-game gate;
5. require CI, Alpha evidence, Ecos 4k and four visual certs;
6. merge only after exact recipe reproduction.

If no candidate is eligible, 1.2 will not force a recipe change merely to produce movement.


## Round 1 result — rejected

The initial one-slot interaction grid completed **21,750 games** with quality PASS.

Artifact:

- ZIP SHA-256: `53e68467ebe812f2d7818df4a8db6076c8f3cff4391637093fed7fec33c825c3`;
- JSON SHA-256: `4be73f53f5054b6431f7386a238b4d53d7b2a8a8cfbacdeb48a13ee81adb7f6b`.

No finalist was promotion-eligible.

Best finalist:

`wood_wither_to_root_prison`

Result:

- health 80;
- first-player 51.3%;
- 2 critical;
- Ember × Wood: 69/31;
- Wood × Florestia: 35.5/64.5;
- Wood × Tide: 59.5/40.5.

Stun, Heal and Root Prison substitutions therefore do not move the certified criticals enough. No Round-1 recipe is promoted.

## Round 2 — anti-board and resilient defense

Round 2 keeps the same one-slot/full-matrix discipline but changes the hypothesis.

Instead of more single-target tempo, it tests cards whose value should concentrate on creature-heavy Ember and Florestia boards:

1. **Glacial Tomb** — Frostbite all enemy units this round;
2. **Rootwater Sage** — legal Tidecall/Ironwood 2/4 body, summon: heal Nexus 2;
3. **Memory Tide** — draw 2 and heal Nexus 2;
4. **Elder Bear** — 4/6 Tough blocker.

Each tool is tested in both stranded slots:

- `wood_wither -> candidate`;
- `wood_bark_rupture -> candidate`.

The promotion rules remain unchanged: fewer than 2 criticals, no replacement critical, Wood×Tide <=60%, and first-player within ±2pp.
