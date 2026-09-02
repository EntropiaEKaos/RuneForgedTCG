# RuneForge Visual 2.0 — FX / Juice / Motion

## Objective

Make RuneForge actions feel immediate and physical without turning persistent game state into continuous visual noise.

This phase is **presentation-only**. It does not create gameplay state, infer hidden information or change any authoritative rule. Motion consumes signals the game already exposes.

## Motion hierarchy

RuneForge now treats motion as a finite resource:

1. **Action transition** — attack, damage, heal, summon, death, resolution and opening a reaction window may use strong short-lived movement.
2. **Actionable state** — legal targets and an open response window may use restrained repeating light because the player must act while that state exists.
3. **Persistent state** — damage already suffered, rarity, status and Nexus pressure prefer material/light cues. They must not look like a new event every second.
4. **Ambient presentation** — subtle only; never stronger than targeting, reaction or combat feedback.

The goal is to distinguish **what just happened**, **what needs input now** and **what remains true**.

## Authoritative hooks

FX 2.0 deliberately reuses existing UI contracts instead of creating a parallel animation state machine:

- `data-match-phase` on the arena for main/combat/response/gameover atmosphere;
- `data-card-state` plus existing `card-targetable` / `card-attacking` classes;
- `data-targeting-mode` from `TargetingHud` for spell, reaction, Sentinela, challenge and block selection;
- `ReactionStack` and its existing top frame / timer;
- `data-fx-event` from the existing BattleView event-pop system;
- `data-nexus-state` for persistent Nexus pressure.

If an authoritative hook disappears, the presentation should fail visibly/static rather than inventing a replacement game state.

## Card geometry safety

Card transforms already carry important layout meaning, especially the player hand fan and the selected-hand clipping fix introduced by Card Presentation 2.0.

Therefore:

- targetable cards animate **light/box-shadow**, not card-shell transform;
- attack motion is scoped to `.tcg-row` and animates the **art inside the forged frame**;
- hand cards explicitly suppress the legacy global attack transform;
- no FX rule may reintroduce an extra selected-hand translation.

This boundary is a regression contract, not an art preference.

## Targeting language

`TargetingHud` keeps the same copy and actions, while the motion layer gives each existing targeting mode a material accent:

| Mode | Accent intent |
| --- | --- |
| Spell | old-gold arcane command |
| Reaction | cyan stack energy |
| Sentinela | violet command energy |
| Challenge | hostile red-orange |
| Block | defensive blue |

The HUD enters once, then its command line breathes lightly while input is required. Legal cards use a restrained gold light pulse without positional movement.

## Reaction stack

The response stack is temporary and deserves urgency:

- one-shot entry reveal when mounted;
- top frame receives a restrained resolve-first light signal;
- timer receives a travelling sheen while the window exists;
- reaction-activated picker reveals as a child of the same stack language.

No timer or animation changes reaction duration or priority authority.

## Combat and damage

The old `attackCard` animation moved the entire card shell. FX 2.0 replaces that on battlefield rows with a short frame-light punch and an inner-art push, preventing transform collisions.

A unit that remains damaged no longer scales its Health gem forever. Persistent damage is a static cracked/red material state. Actual new damage still receives the existing authoritative `fx-pop-dmg` event, restyled and shortened by FX 2.0.

## Event pops

Existing event-driven feedback remains the source of truth:

- damage / Nexus hit;
- heal;
- death;
- impact;
- status;
- summon;
- level up.

FX 2.0 only changes timing, typography and physicality. It does not generate events.

## Nexus pressure

A fractured Nexus keeps a slow, restrained heartbeat because critical Nexus pressure is durable but strategically urgent. The motion is localized to the Nexus gem and never shakes the arena continuously.

Gameover still inherits the existing Alpha safety rules that suppress transient FX and arena shake once the result surface owns interaction.

## Accessibility

`prefers-reduced-motion: reduce` removes all FX 2.0 animation and transition motion. The state remains readable through static:

- target rings/glow;
- attack red frame light;
- top-of-stack outline;
- persistent status materials.

Reduced motion is not a lower-information mode.

## Engineering boundary

FX / Juice / Motion must not change:

- CardDef values or authored mechanics;
- engine state transitions;
- targeting legality;
- reaction timing or priority;
- AI behavior;
- PvP / Ranked authority;
- persistence, economy or rewards;
- Card Studio authoring semantics;
- event generation.

## Certification

Standard CI remains authoritative for behavior. The Visual 2.0 gate additionally requires:

- source-contract proof that FX consumes existing authoritative hooks;
- 85/85 behavioral targets unchanged;
- browser E2E including PvP reconnect/hit-testing;
- visual artifact inspection for normal battlefield/card readability;
- dedicated evidence for actionable FX states when a standard screenshot does not naturally capture them.

No merge is approved from CSS inspection alone.
