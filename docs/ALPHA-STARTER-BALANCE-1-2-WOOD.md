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


## Round 2 result — rejected

The anti-board/resilient-defense grid also completed **21,750 games** with quality PASS.

Artifact:

- ZIP SHA-256: `c1040d5945efdda8e4d039ddeec867bbf097b9c380f2f9ddce69499d23f3582e`;
- JSON SHA-256: `83bac7cd1b75875b0f915e6711683b38bc9c09aa5463739a0b4d46f3247225e9`.

No finalist was promotion-eligible.

Best: `wood_bark_to_glacial`

- health 80;
- first-player 51.3%;
- 2 critical;
- Ember × Wood: 68/32;
- Wood × Florestia: 36.5/63.5;
- Wood × Tide: 60/40.

Rootwater Sage and Memory Tide moved Wood to roughly 38% against Ember but created criticals against Tide/Tempestade. Elder Bear almost reached 40% in both target matchups but created three replacement criticals.

**Conclusion: Wood-only power redistribution is exhausted.**

## Round 3 — redistribute power on the winning sides

Round 3 no longer modifies Ironwood during screening.

### Ember candidates

Ember's `ember_shatter` has only ~22.5% aggregate play rate, but its permanent destruction can be disproportionately valuable into Ironwood's Equipment/Enchantment package.

It is replaced with effects expected to be more useful against Tempestade's smaller units and less useful against Ironwood's larger bodies:

1. Shatter -> Cinder Snap (Burst 2 to a unit);
2. Shatter -> Emberstorm (2 AoE to all enemy units);
3. Shatter -> second Flare Line;
4. Shatter -> third Flame Lash.

### Florestia candidates

Florestia sits only 42% against Tempestade, so any further softening must preserve anti-air.

Candidates remove interaction expected to be strong into Ironwood's larger units:

1. Primal Recall -> third Canopy Warden;
2. Primal Recall -> third Webweaver;
3. Predator Pounce -> third Canopy Warden;
4. Predator Pounce -> third Webweaver.

This trades anti-Ironwood removal/tempo for Reach bodies that should protect the Tempestade matchup.

### Round-3 grid

- 8 individual candidates × 750 games;
- top 2 Ember + top 2 Florestia;
- four cross-family finalists × 3,000 games;
- unchanged 3,000-game baseline control;
- ~21,750 games.

Promotion requires fewer than 2 criticals, zero replacement criticals and first-player within ±2pp.


## Round 3 result — improved but rejected

Round 3 completed another **21,750 games** with quality PASS.

Artifact:

- ZIP SHA-256: `88d617e3b030a778736eca23d66ec9c4be7852f48ba2e111b5717dcc927ca03f`;
- JSON SHA-256: `0118dbeca7e55d7bd211be1aa05eeed07d31cb9aaf1407aa758486a07e4da76b`.

Best finalist:

`ember_shatter_to_stun__forest_pounce_to_webweaver`

Result:

- health score: **82**;
- first-player: **51.5%**;
- healthy: 6;
- watch: 7;
- critical: **2**.

The original critical set remained unchanged:

- Ember × Wood: 67.5 / 32.5;
- Wood × Florestia: 36.5 / 63.5.

Useful guardrail movement:

- Ember × Tempestade: 44 / 56;
- Tide × Florestia: 42.5 / 57.5;
- Florestia × Tempestade: 44.5 / 55.5.

**Decision: no promotion.** One-slot redistribution improved global health, but neither original critical crossed the 40/60 floor.

## Round 4 — two-slot matchup packages

Round 4 keeps the same winning-side redistribution principle, but increases intensity to two recipe slots per deck.

The key idea is to soften Ember and Florestia **simultaneously**, so their mutual matchup can stay balanced while both lose matchup-specific power against Ironwood.

### Ember packages

Every Ember candidate removes `ember_shatter` plus one additional pressure piece, then replaces those slots with low-damage tempo/AoE that should be more useful into small Tempestade boards than into Ironwood's larger bodies.

1. Shatter + Soulbrand -> Flame Lash + Emberstorm;
2. Shatter + one Flamebrand -> Flame Lash + Emberstorm;
3. Shatter + one Steamscale Wyrm -> Flame Lash + Emberstorm;
4. Shatter + Meteor Strike -> Flame Lash + Cinder Snap.

### Florestia packages

Every Florestia candidate removes at least one `forest_predator_pounce` plus a second interaction slot, then compensates with Reach and/or Barrier.

1. both Predator Pounce copies -> Webweaver + Canopy Warden;
2. Pounce + Primal Recall -> Webweaver + Pack Shelter;
3. Pounce + Moon Snare -> Webweaver + Pack Shelter;
4. Pounce + Entangle -> Webweaver + Pack Shelter.

This is intentionally not a raw power reduction. It is a **power redistribution** away from anti-Ironwood removal and toward anti-air/combat defense.

Promotion rules remain unchanged:

- fewer than 2 critical matchups;
- zero replacement critical pairs;
- first-player within ±2pp of 50%;
- exact canonical reproduction after promotion.
