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
11. authorable `CardEffect` primitive parity across the Commander resolver/spell contract, including `recall`, `damagePermanent`, `destroyPermanent`, `mill`, `buffSelf` and `drawOnSummon`;
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
30. certified 1v1-compatible race gates for automatic `draw` and source-relative `manaRefund`, including matching-source, matching-ally and mismatch behavior;
31. Champion progression for `nexusDamage`, `spellsCast`, `alliesSummoned` and per-instance `nexusStrikes`, physical in-place transformation, durable buff/Equipment preservation and automatic `onLevelUp` stack triggers;
32. controller-scoped Unit/General `mechanics` trigger graphs for public authoritative conditions: `always`, `selfDamaged`, allied race/class and board thresholds, own Nexus/mana/Spell Mana/progress thresholds, `roundAtLeast`, and recursive `and`/`or`/`not`; local LIFO push order preserves 1v1 resolution semantics with the printed trigger resolving before authored mechanics;
33. explicit multiplayer opponent semantics for public `mechanics` conditions: `enemy*` aggregates all living opponents while singular `opponent*` resolves to the next living seat clockwise, skipping eliminated players;
34. `handAtLeast` and `opponentHandAtLeast` using authoritative hand counts derived from Commander card zones only; private card identities never enter the mechanic-condition context, and the singular opponent rule continues to use the next living seat clockwise;
35. `buffSelf` source identity carried through trigger/activated-ability stacks plus 1v1-compatible `drawOnSummon` race aggregation/caps; a behavioral parity invariant now fails if an authorable `CARD_EFFECT_KIND` is missing from the Commander spell/effect contract.
36. server-authoritative priority deadlines: 45 seconds for active-seat action windows and 15 seconds for reaction/non-active priority windows; expiration is resolved under the locked Commander room through the same revisioned `pass_priority` protocol, while the browser receives only a presentation deadline/countdown.
37. reconnect/resync recovery in the Commander client: HTTP 409 conflicts fetch a fresh authoritative room snapshot without replaying the rejected command; online/focus/visibility resume also refresh authority, stale local spell/ability intent is cleared on revision changes, and late polling snapshots cannot overwrite a newer combat revision.
38. four-browser Commander E2E certification: four independent Chrome profiles create four stable player sessions, own legal 60+1 loadouts, join a real 4/4 lobby, ready/start through the Commander UI, prove per-seat private hand projection, and rotate priority clockwise through all four visible clients while converging on the same authoritative revision.
39. browser-level Burst counter certification on the real Commander stack: after a real 4/4 lobby/start, the CI fixture deterministically exposes legal Tidecall cards/resources inside the persisted authoritative envelope; P1 casts `Tidal Erosion` through the visible hand/target UI, P2 receives the server-owned reaction window and answers with Burst `Deny`, P3 → P4 → P1 → P2 pass reaction priority through the visible controls, and the server resolves `negateSpell` LIFO so both spells settle to graveyard while the attempted mill never changes P2's deck count. The fixture changes only ephemeral CI state; cast legality, priority, stack, counter resolution, revision convergence and hidden-information projection remain production code.
40. browser-level counter-of-counter certification on the same production Commander stack: a second deterministic CI slice exposes another physical `Tidal Erosion` to P1 plus physical Burst `Deny` copies to P2 and P3; P1 casts at P2, P2 targets the source with `Deny`, P3 selects the visible `TOPO · Deny · P2` stack target with its own `Deny`, and three objects coexist on the public LIFO stack. P4 → P1 → P2 → P3 pass reaction priority through the UI, resolving P3's counter and removing P2's counter while the source remains pending and P2's deck is unchanged. A second P1 → P2 → P3 → P4 pass cycle then resolves the surviving `Tidal Erosion`, mills exactly the amount authored in the card catalog, and converges all four browser projections on the same final revision.
41. browser-level fail-closed reaction legality across Studio-authored custom content and the production Commander boundary: CI creates three unique Tidecall fixtures that first pass the same semantic card-authoring validator used by Studio, persists them as enabled custom catalog definitions, refreshes the DB-derived catalog cache, grants legal ownership, and builds them into the real 60-card Commander loadout. A Burst `negateSpell` authored with `counter_spell` remains visible but disabled in P2's hand while a Unit is on the stack; a forged direct combat command targeting that Unit returns HTTP 409, leaves the stack/hand/revision unchanged, and therefore cannot bypass the client. A separate Fast Spell authored with `uncounterable` projects `uncounterable: true`; ordinary `Deny` is visibly disabled, a forged counter request again returns 409 without mutation, and the protected source then resolves normally after P2 → P3 → P4 → P1 pass reaction priority. The custom definitions are CI-only and removed after certification. This certification also repairs the Studio authoring validator so reserved reaction rules are no longer misclassified as generic Mechanics keywords: `uncounterable` remains a reserved engine rule, while `counter_*` is accepted only on `negateSpell` Spells. Gameplay resolution, Commander protocol/schema, client reaction logic and existing production card definitions are unchanged.

## Deliberately not claimed yet

This Alpha still does not claim full parity for conditional `mechanics` trigger graphs. Non-Unit mechanic sources and other condition semantics not explicitly certified remain fail-closed. It also does not claim every reaction ability in the full catalog or Ranked/tournament support for Commander. Unsupported primitives are expanded only behind explicit behavioral certification.


## Certification base

The current Commander 4P reaction-legality browser certification branch is based on merged `main` `a6aa0b2210caa3d2adda17bac1b21cbb004e0d6c`, created from PR #255 only after exact HEAD `f2765dc5c948ee886c9cf1975b7de04ab4a57884` passed all 8 workflows. This slice expands browser-level proof and fixes one Studio authoring validation mismatch; the authoritative PostgreSQL room, combat envelope version 9, gameplay resolution rules, reconnect contract, client reaction filtering and binary 1v1 engine remain unchanged. The cert uses four isolated Chrome profiles and stable player sessions; its new custom definitions are unique CI-only cards validated by the production authoring contract, persisted through the existing custom-card table/cache, owned through the normal collection projection, and deleted after the run. UI legality, forged-command rejection, circular priority, source resolution, hidden-information projection and revision convergence are all exercised through production paths. Each new Commander HEAD is recertified independently; green results from an older SHA are never reused.