# FORGED Client 1.1 — Player Experience

Production baseline: `0709191c71d0a1b9dd8c385f5ebcd12198835c96` (FORGED Client 1.0).

## Scope

This branch deepens the certified client without changing gameplay authority:

- total player Profile 2.0 redesign inspired by the information hierarchy of mature competitive game clients, using original FORGED visual language;
- Home as the player's headquarters, driven by real account/progression/ranked/collection data;
- Collection 2.0 integration with the existing cosmetic-variant wardrobe;
- first-party Player Journey telemetry and an authoritative accumulated funnel in Command Center;
- progression surfacing (level/XP, daily missions, achievements, login streak and Ranked history) using existing persisted systems;
- Live Ops surfacing from the existing versioned Events/Promotions CMS, including optional safe internal event CTA and date window;
- continued Alpha P1 art-production work as a separately certifiable content slice.

## Profile 2.0

The profile is organized around identity, progress, competitive status, collection and legacy:

1. dominant player identity header with avatar, title, status, badges and account level;
2. account XP progress and persistent login streak;
3. real Ranked MMR/current peak/wins/losses/placement state;
4. collection completion and cosmetic wardrobe summary;
5. achievements, daily mission progress and shared-deck reputation;
6. account access/recovery controls remain discoverable and operational.

No fake league tier is derived from MMR. The profile renders the canonical persisted Ranked values exposed by `playerSelfDto`.

## Player Journey

Command Center adds a database-backed accumulated funnel:

`account created → opened a pack → created a custom deck → played a match → won a match → entered Ranked`

These milestones use persistent production tables. UI telemetry complements the funnel with intent/navigation events but is not used as the sole authority for milestone completion.

## Safety boundary

This branch must not change:

- engine rules or card behavior;
- card stats, costs or effects;
- deck recipes;
- MMR calculation or matchmaking algorithms;
- Ranked authority;
- economy transaction semantics;
- payment authority;
- existing identity/auth provider security boundaries.

All work remains isolated from `main` until exact-head certification is complete.