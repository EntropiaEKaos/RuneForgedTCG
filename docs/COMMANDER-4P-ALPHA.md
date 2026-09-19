# FORGED Commander 4P Alpha

## Scope

Commander 4P is a separate experimental multiplayer mode. It does not replace Casual PvP or Ranked and it does not widen the certified binary `PlayerId = "player" | "ai"` engine contract.

This first Alpha establishes the authoritative multiplayer shell needed before four-way card combat is introduced.

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

1. collection-backed 60+General loadout;
2. room creation;
3. four unique seats;
4. explicit ready/unready;
5. host-only start;
6. exactly-four-player start gate;
7. clockwise authoritative turn ownership;
8. round increment when seat 3 passes to seat 0;
9. isolation from the current 1v1 engine.

## Deliberately not claimed yet

This Alpha does not claim complete four-player card combat, targeting, reaction priority, elimination, General casting, commander tax, or four-way settlement. Those mechanics must be implemented on this isolated authority instead of stretching the certified 1v1 engine.


## Certification base

The final Commander 4P Alpha PR certification is based on `main` at `09b45178115945736f7902ee84db7790ce1405c9`, after Command Center 2.0. No green result from the former `96f228fe…` base is reused after this rebuild.
