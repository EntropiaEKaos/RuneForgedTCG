# FORGED Commander 4P Alpha

## Scope

Commander 4P is a separate experimental multiplayer mode. It does not replace Casual PvP or Ranked and it does not widen the certified binary `PlayerId = "player" | "ai"` engine contract.

The current Alpha carries the recovered four-player combat authority through physical card play, targeting, combat, General casting, circular priority, Fast/Burst reactions and a LIFO stack while remaining isolated from the certified 1v1 engine.

## Rules snapshot

- 4 real players;
- 60-card library;
- 1 General outside the 60-card library;
- General must be a Champion or Legend;
- 30 starting Nexus;
- 5-card starting-hand contract;
- maximum 3 copies per card;
- clockwise seats 0 → 1 → 2 → 3 → 0;
- every room persists its own immutable rules snapshot.

## Alpha authority

PostgreSQL owns:

- room state;
- four unique player seats;
- each player's snapshotted 60-card loadout and General;
- ready state;
- host;
- current seat;
- round;
- version;
- current Alpha game-state projection.

All create/join/start/turn mutations lock the relevant player or room row. Starting fails closed unless exactly four real players occupy the room and all four are ready.

## Collection boundary

The server validates the 60-card library and General against `player_cards`. The browser cannot submit unowned cards as an authoritative loadout.

The General consumes a real owned copy and is not part of the 60-card library.

## Isolation from 1v1

Commander uses:

- `commander_rooms`;
- `commander_seats`;
- `/api/commander`;
- `/api/commander/[code]`;
- `/commander`;
- `src/lib/commander-rules.ts`.

It does **not** reuse or mutate `pvp_rooms`, Ranked settlement, the binary `GameState.players`, or 1v1 reaction authority.

## What this Alpha certifies

This slice certifies:

1. collection-backed 60+General loadout and four real seats;
2. PostgreSQL revision/CAS authority and reconnect-safe hidden-information projection;
3. clockwise turn, phase and circular priority ownership;
4. physical battlefield objects, split attacks, blockers, combat damage and elimination;
5. General Zone casting, recast tax, battlefield materialization and return-to-zone handling;
6. authoritative hand/deck/graveyard zones and ordered draw/mill/return-to-hand actions;
7. four-player targeting for units, Nexuses and durable permanents;
8. Fast/Burst reaction timing on the circular priority loop;
9. LIFO stack resolution, `negateSpell`, counter filters and `uncounterable`;
10. counter-of-counter chains where removing the counter allows the original object to resolve;
11. Fast/Burst catalog coverage including `recall`, `damagePermanent`, `destroyPermanent` and `mill`;
12. client-visible stack state without exposing private deck or opponent-hand identities;
13. isolation from Casual PvP, Ranked and the binary 1v1 `PlayerId` engine.

## Deliberately not claimed yet

This Alpha still does not claim parity with every authored card effect or every activated/reaction ability in the full catalog, nor Ranked/tournament support for Commander. Unsupported effects remain fail-closed and are expanded only behind explicit behavioral certification.


## Certification base

The recovered Commander 4P combat branch is based on certified production `main` `b6891a54b1629183d031156dc1fe644ea22f3420`. The expanded reaction/zone state uses Commander combat envelope version 2 so older persisted Alpha rooms fail closed and must restart. Each new Commander HEAD is recertified independently; green results from an older SHA are never reused after rules or UI authority changes.
