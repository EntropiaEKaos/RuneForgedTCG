# Graveyard Effects 1.0 — Implementation Contract

## Certified base

This slice starts from the post-merge-certified `main` SHA:

`48c2fac6b9e852bc87c09821e63da57bd6552f3b`

It builds on Graveyard Zone 1.0 and does not alter the six Alpha starter recipes or introduce the **Ecos do Abismo** deck yet.

## Generic primitives

Graveyard Effects 1.0 adds three data-driven Spell effects:

- `returnGraveyardToHand`
- `reanimateUnit`
- `banishGraveyardCard`

And four explicit zone target kinds:

- `allyGraveyardCard`
- `enemyGraveyardCard`
- `anyGraveyardCard`
- `allyGraveyardUnit`

Graveyard entries remain separate from `BoardEntity`. Their authoritative target identity is the public `GraveyardEntry.instanceId` introduced by Graveyard Zone 1.0.

## Resolution contract

Every graveyard-targeted Spell is revalidated against the current authoritative state before payment and again when its effect consumes the target.

A stale or missing graveyard id fails closed. It cannot pay the Spell, consume another card, or duplicate a physical card across zones.

### Return to hand

`returnGraveyardToHand`:

1. targets one card in the acting player's graveyard;
2. requires available hand capacity before payment;
3. consumes exactly that graveyard entry;
4. creates a fresh normal hand `CardInstance` id for the same `defId`.

### Reanimate

`reanimateUnit`:

1. targets one eligible Unit in the acting player's graveyard;
2. requires available bench capacity before payment;
3. consumes exactly that graveyard entry;
4. creates a fresh Unit through the canonical `makeUnit` path;
5. enters with normal `summonedThisTurn=true` semantics;
6. increments `alliesSummoned` once;
7. fires normal Unit `onSummon` behavior;
8. fires controlled permanent `onPermanentSummon` behavior;
9. does not add a second `spellsCast` beyond the recursion Spell itself;
10. can later die and enter the graveyard again normally.

### Graveyard banish

`banishGraveyardCard` removes exactly one legal graveyard entry. Graveyard Effects 1.0 does not introduce a separate reusable exile zone; the banished card is intentionally no longer available to graveyard recursion.

## Main-phase-only safety boundary

In this first certified slice, graveyard-targeted effects are main-phase Spell effects only.

Authoring rejects graveyard targets on:

- Fast/Burst Spells;
- triggered abilities;
- activated abilities;
- Sentinela abilities;
- Mechanics Studio Unit mechanics.

This is intentional fail-closed behavior. It prevents Studio from persisting a graveyard interaction that the reaction/activated targeting UI cannot yet represent authoritatively. A later expansion may add those surfaces deliberately.

Normal stack counterspells remain meaningful because a main-phase recursion Spell can still open the ordinary RuneForge reaction window before resolution.

## Studio / Admin

The canonical Card Studio effect catalog now exposes the three graveyard primitives and their legal targets through the existing `CARD_EFFECT_CONTRACTS` source of truth.

Impossible effect/target pairs are rejected by `validateAuthorableCard` rather than reaching runtime.

The Studio sandbox seeds graveyards by physically moving real collectible cards out of each deck:

- one collectible Unit for the player, to test return/reanimation;
- one collectible card for the opponent, to test graveyard hate.

No sandbox-only duplicate is manufactured.

## Gameplay UI

Both public graveyards are rendered through `GraveyardTray`.

The tray exposes up to eight recent entries with card identity, entry round and transition reason. When a supported graveyard-targeted Spell is pending, only entries that pass `isValidGraveyardTarget` are clickable.

The click sends the graveyard entry's authoritative `instanceId` through the same local/PvP action flow already used for board targets.

## AI

The deterministic AI fallback understands all three new effects.

It:

- checks bench/hand capacity before considering recursion useful;
- values graveyard cards from printed cost, power and health;
- selects the highest-value legal reanimation target;
- selects legal return and graveyard-hate targets with stable `instanceId` tie-breaking;
- remains deterministic under seeded simulation.

Content-specific discard heuristics remain for the **Ecos do Abismo** content PR, where the AI can reason about actual outlets, recursion density and designated finishers.

## Certified non-goals

This PR does not include:

- `Ecos do Abismo` cards or deck recipe;
- changes to the six Alpha starters;
- changes to Alpha Starter Balance evidence;
- arbitrary card scripting;
- Fast/Burst graveyard targeting;
- graveyard-targeted activated/reaction abilities;
- Equipment recursion until physical Equipment provenance is explicit;
- a reusable exile/banished zone.

## Required certification

Before merge:

- typecheck and lint green;
- new Graveyard Effects 1.0 behavioral suite green;
- existing Graveyard Zone 1.0 suite remains green;
- Card Studio authoring/functional tests green;
- PvP/server behavior remains green;
- production build green;
- browser E2E green;
- visual freeze certs remain green;
- diff audit confirms no starter/deck/card-content changes.

After squash merge, the definitive `main` SHA must repeat CI and visual certification before **PR C — Ecos do Abismo** begins.
