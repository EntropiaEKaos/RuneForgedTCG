# FORGED Commander Alpha — Four Player Authority Foundation

Commander Alpha is a separate multiplayer mode. It does not replace or widen the certified two-player `pvp_rooms` flow.

## Rules contract

- four real human players;
- four fixed seats;
- exactly 60 deck cards plus one General outside the deck;
- General must be a collectible Champion, Legend or Sentinela;
- the General defines the allowed regional identity of the 60-card deck;
- at most three copies of one card;
- 30 starting Nexus;
- clockwise circular turn order, skipping eliminated seats;
- last active player wins.

## Alpha authority slice

The first playable slice certifies the network/lobby/turn lifecycle before four-way card combat is grafted onto the engine:

1. create room with an immutable validated 60+1 loadout;
2. join the remaining seats with independently validated loadouts;
3. host can start only at 4/4 humans;
4. current seat alone can advance the turn;
5. forfeit eliminates a seat and advances turn if necessary;
6. one remaining player atomically finishes the room;
7. append-only room events expose an auditable state/version timeline.

## Isolation

`commander_rooms`, `commander_room_players` and `commander_room_events` are separate from 1v1 PvP, Ranked, matchmaking and settlement. Existing 1v1 code must not import Commander room tables.

## Next combat slice

The next Commander gameplay slice can add per-seat hand/deck/board/graveyard state, target selection across three opponents, priority/reaction windows, General casting/recost rules and four-player settlement. This alpha deliberately establishes the concurrency/state-machine boundary first so the existing 1v1 engine remains stable.
