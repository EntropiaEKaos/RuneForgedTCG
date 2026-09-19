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
