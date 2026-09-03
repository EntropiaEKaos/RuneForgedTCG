# Graveyard & Reanimator 1.0 — RuneForge

## Objective

Introduce a real, authoritative graveyard resource and an advanced Discard/Reanimator archetype without changing the six certified Alpha starter recipes or contaminating the Alpha Starter Balance baseline.

The target player experience is the classic reanimator loop — deliberately put expensive threats into the graveyard, then convert setup and tempo into an early or recursive battlefield threat — expressed with RuneForge-native regions, rules, terminology, interaction and balance constraints.

## Regional identity

### Tidecall — setup / selection

Tidecall owns the precision side of the archetype:

- draw then discard / loot patterns;
- controlled discard outlets;
- self-mill and card selection;
- protection, recall and stack interaction;
- returning cards from graveyard to hand.

### Voidborn — death / recursion

Voidborn owns the conversion side:

- death and sacrifice value;
- graveyard thresholds;
- reanimation;
- recursive threats;
- graveyard denial / banish effects;
- high-cost creatures designed to be legitimate reanimation targets.

The flagship advanced preset will be a Tidecall/Voidborn dual-region deck. It is deliberately NOT a starter deck.

## Authoritative zone model

RuneForge currently exposes a Graveyard concept in the Control Plane but the match engine does not yet keep a real reusable graveyard zone. Graveyard 1.0 makes it authoritative.

Each player receives a public graveyard containing ordered card entries. Graveyard entries retain at minimum:

- unique zone instance id;
- `defId`;
- owner;
- round entered;
- reason (`discard`, `mill`, `death`, `destroy`, `spell`, `counter`, `sacrifice`, `overflow`);
- optional source instance id for audit/replay diagnostics.

The zone is deterministic and part of authoritative replay state.

## Zone transition contract

The following transitions must feed the graveyard instead of silently deleting cards:

1. selected discard costs from hand;
2. future discard effects;
3. mill from deck;
4. dead Units;
5. destroyed Artifacts / Enchantments;
6. destroyed Sentinelas when their card representation is eligible;
7. resolved Spells;
8. countered Spells;
9. attached Equipment when its bearer dies;
10. cards lost because a return-to-hand effect meets a full hand, if the rules surface keeps that overflow behavior.

Generated non-collectible tokens are not legal reanimation targets. The first certified implementation must fail closed on ambiguous transformed/non-collectible representations instead of creating duplicate or impossible cards.

## Reanimation contract

A reanimation effect:

1. selects an eligible Unit card from the acting player's graveyard;
2. validates that the card still exists in that graveyard at authoritative resolution time;
3. validates battlefield capacity;
4. removes exactly that graveyard entry;
5. creates a fresh Unit instance using the normal engine construction path;
6. enters with normal summon sickness (`summonedThisTurn=true`), so Haste remains meaningful;
7. counts as an ally summoned;
8. uses normal battlefield/onSummon semantics unless a specific card explicitly says otherwise;
9. does NOT count as a spell cast merely because the returned card is a Unit;
10. can die again and return to the graveyard normally.

Reanimation must never duplicate a graveyard card or leave the same entry simultaneously in two zones.

## Minimum generic mechanics

Graveyard 1.0 should expose data-driven primitives rather than hard-code individual cards:

- `discardFromHand` — selected own-hand discard into graveyard;
- `mill` with explicit owner/opponent destination semantics;
- `returnGraveyardToHand`;
- `reanimateUnit`;
- `banishGraveyardCard` (graveyard hate / interaction);
- graveyard target kinds for own/enemy card and own Unit;
- graveyard-count mechanic conditions for later card authoring.

Where an existing mechanic already exists, such as activated-ability selected discard, the implementation should route that existing path into the authoritative graveyard rather than inventing a parallel discard system.

## Interaction and counterplay

Reanimator must be strong but answerable.

The first content wave must include graveyard interaction at the same time as reanimation itself. At minimum:

- single-card graveyard banish;
- a tempo answer that can respond to a reanimation plan;
- ordinary stack negation remains relevant to reanimation Spells/Rituals;
- reanimated creatures remain vulnerable to normal kill/recall/stun/frostbite rules unless their own text protects them.

No release where recursion ships without graveyard interaction is acceptable.

## AI contract

Existing generic discard AI cannot be assumed correct for Reanimator. The Reanimator policy needs to recognize setup value:

- prefer discarding expensive designated reanimation targets when a recursion effect is available or likely;
- avoid discarding the only reanimation spell/outlet without a strong reason;
- value graveyard cards as resources instead of treating them as permanently lost;
- prioritize reanimation targets by board impact, cost bypass and survival value;
- use graveyard hate against high-value opposing targets.

AI changes must stay deterministic under the seeded simulation contract.

## Studio / Admin contract

The feature is not complete until Card Studio can author and validate it.

Studio must support:

- graveyard target selection;
- reanimation / return / banish effects;
- discard amounts and selection semantics;
- eligibility constraints displayed to the designer;
- sandbox execution against a seeded graveyard state;
- semantic validation that rejects impossible target/effect combinations.

No raw arbitrary scripting is introduced.

## Advanced archetype — working name

**Ecos do Abismo** — Tidecall / Voidborn Discard Reanimator.

Gameplay loop:

1. develop a small discard/selection engine;
2. place one of the expensive finishers into the graveyard intentionally;
3. survive or disrupt the opponent for one tempo window;
4. reanimate a threat ahead of its printed mana curve;
5. protect it or convert its death into another recursion cycle.

This preset remains outside the six Alpha starters and outside the current starter-balance matrix until the mechanic itself is certified.

## Initial content roles

The first content package should contain, at minimum:

### Enablers

- low-cost Unit with `discard 1 -> draw 1` activated ability;
- Tidecall selection Spell/Ritual;
- self-mill setup card;
- Structure or Artifact that acts as a repeatable discard outlet.

### Reanimation

- baseline reanimation Ritual/Spell;
- slower value recursion card returning a Unit to hand;
- one conditional or limited reanimation effect for deck-building variety.

### Targets

At least three expensive Units with different payoff profiles:

- evasive/protected threat;
- stabilizing Lifesteal/defensive threat;
- high-pressure finisher.

They must remain castable normally; the archetype accelerates them but does not create otherwise unusable cards.

### Hate / interaction

- targeted graveyard banish;
- one additional interactive answer so mirror matches and control decks have agency.

## Balance rules

The first implementation must be evaluated separately from the starter baseline.

Required evidence before adding the preset to a public Alpha selection surface:

- deterministic head-to-head matrix against existing advanced/certified decks;
- first-player skew;
- average reanimation round;
- percentage of games with a successful reanimation;
- win rate conditional on reanimating by rounds 3/4/5;
- card utilization for discard outlets, recursion cards and finishers;
- frequency of stranded finishers in hand;
- frequency of graveyard hate being playable/used;
- no critical matchup outside the project's certified balance bands without an explicit review.

Recipe-only tuning is preferred before global CardDef changes whenever possible.

## Delivery sequence

### PR A — Graveyard Zone 1.0

- authoritative graveyard state;
- discard/mill/death/destroy/spell/counter transitions;
- replay/PvP DTO visibility rules;
- deterministic engine tests;
- no Reanimator deck yet.

### PR B — Graveyard Effects 1.0

- graveyard targets;
- return-to-hand;
- reanimate;
- banish;
- Card Studio authoring and sandbox;
- AI support;
- regression tests.

### PR C — Ecos do Abismo

- original RuneForge cards;
- 40-card advanced Tidecall/Voidborn preset;
- balance/telemetry evidence;
- browser/playability certification;
- merge only after full CI.

## Non-goals

- no changes to the six certified Alpha starter recipes during this rollout;
- no copying of Magic card names/text/art;
- no arbitrary script execution in card definitions;
- no direct Ranked enablement before balance evidence;
- no bypass of the Alpha visual feature freeze.
