# Phaser Battlefield Lab

Status: experimental, internal-only foundation.

## Safety boundary

This branch is based on certified main `b6891a54b1629183d031156dc1fe644ea22f3420`.
It must not modify the in-flight Commander recovery branch or make Commander depend on Phaser.
The current Alpha renderer remains the production/default renderer.

## Product target

Build a Phaser-backed battlefield renderer inside RuneForged that can mature from an internal lab into a real PvP client while consuming the authoritative RuneForged engine/server state.

Required capabilities:
- internal Battlefield/Phaser Lab inside the game;
- sandbox scenarios and deterministic stress tests;
- real PvP, first 1v1 and then Commander 4P;
- swarm-heavy boards with many individually represented creatures/tokens;
- priority, stack/reactions, targeting, attack/block, damage, death, negateSpell, General and player elimination visualization;
- renderer selection behind an internal/experimental feature flag;
- current renderer stays available until the Phaser renderer proves parity, stability and performance;
- animated, interactive, cosmetic battlefield skins;
- cosmetic battlefield reactions to match events without changing authoritative game state;
- Card Material System for layered frames, rarity/material/foil/faction/runes/foreground/FX;
- compact battlefield/army representations that preserve underlying individual game entities;
- mobile/performance certification before any public promotion.

## Architecture rule

Commander/engine -> presentation contract/event adapter -> Phaser renderer.

Never Phaser -> Commander rules.

Phaser must not become authoritative for legality, priority, combat, targeting, stack resolution, damage, victory, matchmaking, persistence or economy.

## Delivery slices

1. Lab shell + renderer boundary + deterministic fake snapshots.
2. 1v1/4P spatial layout and swarm stress harness.
3. Card Material prototype and battlefield unit representations.
4. Engine event adapter in read-only/mirror mode.
5. Interaction: selection, targeting, drag, attack/block, stack/priority.
6. Internal real PvP using authoritative match state.
7. Battlefield Skin System: layered scene manifests, ambient animation, interactions, event reactions and audio hooks.
8. Performance/mobile/reconnect/spectator/replay hardening.
9. Controlled internal comparison against the current renderer.

## Promotion gate

No Alpha renderer replacement and no merge to main merely because the prototype looks better. Promotion requires gameplay parity, deterministic state synchronization, reconnect correctness, mobile targets, stress targets and existing repository certification gates.


## Cinematic FX target

The Battlefield Lab must prepare for a premium cinematic FX runtime. This is a presentation goal, not gameplay authority.

Target quality:
- layered projectiles such as fireballs with emissive cores, animated plasma/fire, trails, sparks, smoke and impact bursts;
- branching lightning, continuous energy beams, magical arcs, portals, shockwaves, ice, necromancy and faction-specific visual languages;
- battlefield-reactive lighting, controlled camera shake, hit flashes, particles and optional post-processing/distortion;
- semantic recipes driven by authoritative engine events (for example spell resolved, damage applied, creature died), never by renderer-side rules;
- scalable quality tiers so particles, lighting and post-processing can degrade on lower-end/mobile hardware without changing gameplay;
- reusable FX recipes and asset manifests rather than one-off hardcoded effects;
- future Studio authoring for FX recipes after runtime contracts are stable;
- synchronized audio hooks as part of the eventual presentation recipe.

Required architecture:

`authoritative engine/server event -> presentation event adapter -> FX recipe -> Phaser/WebGL rendering`

The FX runtime must never determine targets, damage, legality, priority, stack resolution, death or victory. It receives confirmed semantic outcomes and turns them into spectacle.

Preparation order:
1. Stable interaction and combat presentation contracts.
2. Read-only authoritative event adapter.
3. FX event/recipe schema and lifecycle.
4. Particle/projectile/beam primitives.
5. Lighting, camera and impact layers.
6. Performance tiers and mobile fallbacks.
7. Audio synchronization hooks.
8. Data-driven recipes and later Studio authoring.

Visual ambition: cards remain readable as a TCG, while resolved high-impact spells can temporarily turn the battlefield into a cinematic event.
