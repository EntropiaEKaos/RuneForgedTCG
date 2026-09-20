# FORGED Commander 4P Alpha

## Scope

Commander 4P is a separate experimental multiplayer mode. It does not replace Casual PvP or Ranked and it does not widen the certified binary `PlayerId = "player" | "ai"` engine contract.

The current Alpha carries the recovered four-player combat authority through physical card play, targeting, combat, General casting, circular priority, Fast/Burst reactions, activated/reaction battlefield abilities, automatic printed triggers, Sentinela loyalty, a LIFO stack, public graveyard interaction and provenance-safe Equipment attachments while remaining isolated from the certified 1v1 engine.

## Rules snapshot

- 4 real players;
- 60-card library;
- 1 General outside the 60-card library;
- General must be a Champion or Legend;
- 30 starting Nexus;
- 5-card starting-hand contract;
- up to 3 banked Spell Mana, following the certified 1v1 resource semantics;
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
12. public graveyard targeting by physical instance identity, including `selfMill`, return-to-hand, reanimation and banish;
13. physical Equipment attachment with a two-slot cap plus generated `attachEquipment` effects;
14. Equipment provenance: physical attachments can settle to graveyard with a destroyed/recalled bearer while generated attachments never manufacture cards;
15. main-phase activated abilities for Units, Permanents, Generals and Sentinelas using the shared 4P stack;
16. reaction activated abilities using the same circular priority and LIFO resolution, including battlefield `negateSpell`;
17. authoritative costs for regular mana, Spell Mana, Nexus health, selected discard, exhaust, Barrier consumption, sacrifice and Sentinela loyalty;
18. Spell Mana banking up to 3 on the incoming player's next turn, with regular mana spent first on eligible cards and no regular fallback for explicit ability `spellMana` costs;
19. semantic resource separation: Unit, Sentinela, Structure and General remain regular-mana-only while eligible spell-like cards may complete cost from the bank;
20. Sentinela loyalty snapshots plus one-activation-per-round budget shared across classic/generic abilities;
21. client-visible stack, battlefield attachments, ability options, public Spell Mana and graveyards without exposing private deck or opponent-hand identities;
22. automatic printed `onSummon`, `onPermanentSummon`, `onDeath`, `onAllyDeath` and table-round `onRoundStart` triggers on the same circular LIFO stack;
23. deterministic automatic 4P trigger targeting, including clockwise opponent selection, Hexproof filtering, target snapshots and safe fizzle when a snapshotted target disappears;
24. trigger propagation for normal battlefield entry, generated tokens, reanimation and sacrifice/death transitions without treating recall as death;
25. `onAttack` and `onBlock` declaration triggers staged on the same LIFO stack after declarations and before combat damage, with declaration changes reopening trigger staging;
26. incremental combat impact windows for `onStrike` and `onNexusStrike`, including distinct Double Strike windows and Quick Attack survival checks before counterstrike;
27. combat-authored `onKill` provenance recorded only from the lethal battlefield strike and dispatched during casualty cleanup; spell/effect kills never manufacture an `onKill` source;
28. simultaneous normal combat exchange remains atomic before impact triggers, while Quick Attack and Double Strike retain ordered strike semantics;
29. isolation from Casual PvP, Ranked and the binary 1v1 `PlayerId` engine.

## Deliberately not claimed yet

This Alpha still does not claim parity with `onLevelUp`, conditional `mechanics` trigger graphs, race-gated draw/refund trigger semantics or every reaction ability in the full catalog, nor Ranked/tournament support for Commander. Unsupported trigger primitives remain fail-closed and are expanded only behind explicit behavioral certification.


## Certification base

The recovered Commander 4P combat branch is based on certified production `main` `b6891a54b1629183d031156dc1fe644ea22f3420`. The incremental combat-impact authority uses Commander combat envelope version 8 so older persisted Alpha rooms fail closed and must restart. Each new Commander HEAD is recertified independently; green results from an older SHA are never reused after rules or UI authority changes.