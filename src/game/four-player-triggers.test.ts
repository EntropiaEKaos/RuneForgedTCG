import assert from "node:assert/strict";
import { putFourPlayerBattlefieldObject } from "./four-player-battlefield";
import { createFourPlayerCombatBodySnapshot } from "./four-player-combat-body";
import { clearRegisteredCustomCards, registerCustomCards } from "./custom-registry";
import { passFourPlayerFlow, submitFourPlayerAction } from "./four-player-flow";
import { createFourPlayerMatchState, eliminateFourPlayerMatchSeat, type FourPlayerMatchState } from "./four-player-match";
import { fourPlayerStackActionKind } from "./four-player-reactions";
import { pumpFourPlayerServer } from "./four-player-server-pump";
import {
  destroyedFourPlayerObjectsFromRemoval,
  queueFourPlayerRoundStartTriggers,
  queueFourPlayerTransitionTriggers,
} from "./four-player-triggers";
import type { CardDef } from "./types";

function passAllLiving(match: FourPlayerMatchState): FourPlayerMatchState {
  let next = match;
  const count = 4 - next.turn.eliminatedSeats.length;
  for (let index = 0; index < count; index += 1) {
    next = { ...next, resolution: passFourPlayerFlow(next.resolution) };
  }
  return next;
}

const fixtures: CardDef[] = [
  {
    defId: "four_player_trigger_summon", name: "Trigger Summoner", region: "Emberhold", type: "Unit", cost: 1,
    power: 2, health: 3, rarity: "Common", description: "4P trigger fixture.", emoji: "T",
    trigger: { when: "onSummon", effect: { kind: "damageNexus", amount: 2, target: "none" } },
  },
  {
    defId: "four_player_trigger_plain", name: "Plain Trigger Body", region: "Florestia", type: "Unit", cost: 1,
    power: 1, health: 3, rarity: "Common", description: "4P trigger fixture.", emoji: "P",
  },
  {
    defId: "four_player_trigger_death", name: "Death Trigger", region: "Emberhold", type: "Unit", cost: 1,
    power: 1, health: 2, rarity: "Common", description: "4P trigger fixture.", emoji: "D",
    trigger: { when: "onDeath", effect: { kind: "damageNexus", amount: 3, target: "none" } },
  },
  {
    defId: "four_player_trigger_ally_death", name: "Ally Death Trigger", region: "Ironwood", type: "Unit", cost: 1,
    power: 1, health: 4, rarity: "Common", description: "4P trigger fixture.", emoji: "A",
    trigger: { when: "onAllyDeath", effect: { kind: "healNexus", amount: 2, target: "none" } },
  },
  {
    defId: "four_player_trigger_destroy", name: "Targeting Trigger", region: "Tidecall", type: "Unit", cost: 1,
    power: 2, health: 2, rarity: "Common", description: "4P trigger fixture.", emoji: "X",
    trigger: { when: "onSummon", effect: { kind: "destroyPermanent", amount: 0, target: "enemyPermanent" } },
  },
  {
    defId: "four_player_trigger_round_draw", name: "Round Draw Trigger", region: "Tidecall", type: "Unit", cost: 1,
    power: 1, health: 2, rarity: "Common", description: "4P trigger fixture.", emoji: "R",
    trigger: { when: "onRoundStart", effect: { kind: "draw", amount: 1, target: "none" } },
  },
  {
    defId: "four_player_trigger_round_heal", name: "Round Heal Trigger", region: "Ironwood", type: "Unit", cost: 1,
    power: 1, health: 2, rarity: "Common", description: "4P trigger fixture.", emoji: "H",
    trigger: { when: "onRoundStart", effect: { kind: "healNexus", amount: 1, target: "none" } },
  },
  {
    defId: "four_player_trigger_watcher", name: "Permanent Summon Watcher", region: "Florestia", type: "Enchantment", cost: 1,
    maxHealth: 4, rarity: "Common", description: "4P trigger fixture.", emoji: "W",
    trigger: { when: "onPermanentSummon", effect: { kind: "draw", amount: 1, target: "none" } },
  },
  {
    defId: "four_player_trigger_target_permanent", name: "Target Permanent", region: "Ironwood", type: "Artifact", cost: 1,
    maxHealth: 4, rarity: "Common", description: "4P trigger fixture.", emoji: "O",
  },
  {
    defId: "four_player_trigger_race_watcher", name: "Race Watcher", region: "Emberhold", type: "Artifact", cost: 1,
    maxHealth: 4, rarity: "Common", description: "Refund when a Dragon is summoned.", emoji: "F",
    trigger: { when: "onPermanentSummon", effect: { kind: "manaRefund", amount: 1, target: "none", race: "Dragon" } },
  },
  {
    defId: "four_player_trigger_self_watcher", name: "Self Subject Watcher", region: "Tidecall", type: "Artifact", cost: 1,
    maxHealth: 4, rarity: "Common", description: "Barrier the summoned subject.", emoji: "B",
    trigger: { when: "onPermanentSummon", effect: { kind: "grantBarrier", amount: 0, target: "self" } },
  },
  {
    defId: "four_player_trigger_dragon", name: "Trigger Dragon", region: "Emberhold", type: "Unit", cost: 1,
    power: 1, health: 2, race: "Dragon", rarity: "Common", description: "Dragon subject.", emoji: "G",
  },
  {
    defId: "four_player_trigger_warrior", name: "Trigger Warrior", region: "Emberhold", type: "Unit", cost: 1,
    power: 1, health: 2, race: "Warrior", rarity: "Common", description: "Warrior subject.", emoji: "Y",
  },
  {
    defId: "four_player_trigger_draw_on_summon", name: "Draw-On-Summon Trigger", region: "Tidecall", type: "Unit", cost: 1,
    power: 1, health: 1, race: "Dragon", rarity: "Common", description: "4P trigger fixture.", emoji: "U",
    trigger: { when: "onSummon", effect: { kind: "drawOnSummon", amount: 1, target: "none" } },
  },
];

registerCustomCards(fixtures);
try {
  const body = (defId: string) => createFourPlayerCombatBodySnapshot(fixtures.find((card) => card.defId === defId)!)!;

  // onSummon enters the same LIFO stack through the real server pump.
  let castMatch: FourPlayerMatchState = { ...createFourPlayerMatchState("p1"), phase: "main_1" };
  castMatch = {
    ...castMatch,
    resolution: submitFourPlayerAction(castMatch.resolution, {
      id: "cast-trigger-fixture",
      controller: "p1",
      kind: "card_cast",
      payload: {
        instanceId: "trigger-summon-p1",
        defId: "four_player_trigger_summon",
        ownerSeat: "p1",
        cardType: "Unit",
        keywords: [],
        combat: body("four_player_trigger_summon"),
      },
    }),
  };
  const castPump = pumpFourPlayerServer(passAllLiving(castMatch));
  assert.equal(castPump.resolved[0]?.kind, "card_cast");
  assert.equal(castPump.match.resolution.stack.items.at(-1)?.kind, "triggered_ability");
  assert.equal(fourPlayerStackActionKind(castPump.match.resolution.stack.items.at(-1)!), "sentinela");
  assert.equal(castPump.match.resolution.priority.holder, "p1");
  const summonPump = pumpFourPlayerServer(passAllLiving(castPump.match));
  assert.equal(summonPump.resolved[0]?.kind, "triggered_ability");
  assert.equal(summonPump.match.seats.p2.life, 28);
  assert.equal(summonPump.match.seats.p3.life, 30);

  // Eliminated seats are skipped by deterministic clockwise opponent targeting.
  let before = eliminateFourPlayerMatchSeat({ ...createFourPlayerMatchState("p1"), phase: "main_1" }, "p2");
  const after: FourPlayerMatchState = {
    ...before,
    battlefield: putFourPlayerBattlefieldObject(before.battlefield!, {
      id: "trigger-summon-skip-p2",
      defId: "four_player_trigger_summon",
      kind: "unit",
      ownerSeat: "p1",
      controllerSeat: "p1",
      enteredTurn: before.turn.turn,
      combat: body("four_player_trigger_summon"),
    }),
  };
  const skipQueue = queueFourPlayerTransitionTriggers(before, after, [], "summon-skip");
  const skipPump = pumpFourPlayerServer(passAllLiving(skipQueue.match));
  assert.equal(skipPump.match.seats.p3.life, 28);

  // onPermanentSummon watches allied Unit entry and returns an authoritative draw request.
  before = { ...createFourPlayerMatchState("p1"), phase: "main_1" };
  before = {
    ...before,
    battlefield: putFourPlayerBattlefieldObject(before.battlefield!, {
      id: "summon-watcher",
      defId: "four_player_trigger_watcher",
      kind: "permanent",
      ownerSeat: "p1",
      controllerSeat: "p1",
      enteredTurn: 0,
      durability: { health: 4, maxHealth: 4 },
    }),
  };
  const watcherAfter: FourPlayerMatchState = {
    ...before,
    battlefield: putFourPlayerBattlefieldObject(before.battlefield!, {
      id: "summoned-for-watcher",
      defId: "four_player_trigger_plain",
      kind: "unit",
      ownerSeat: "p1",
      controllerSeat: "p1",
      enteredTurn: before.turn.turn,
      combat: body("four_player_trigger_plain"),
    }),
  };
  const watcherQueue = queueFourPlayerTransitionTriggers(before, watcherAfter, [], "permanent-summon-fixture");
  assert.equal(watcherQueue.queued.some((entry) => entry.payload.when === "onPermanentSummon"), true);
  const watcherPump = pumpFourPlayerServer(passAllLiving(watcherQueue.match));
  assert.equal(watcherPump.drawRequests?.p1, 1);

  // onPermanentSummon race gates use the summoned Unit as the 1v1-style effect subject.
  let raceBefore: FourPlayerMatchState = { ...createFourPlayerMatchState("p1"), phase: "main_1" };
  raceBefore = {
    ...raceBefore,
    seats: { ...raceBefore.seats, p1: { ...raceBefore.seats.p1, mana: 0, maxMana: 1 } },
    battlefield: putFourPlayerBattlefieldObject(raceBefore.battlefield!, {
      id: "race-watcher",
      defId: "four_player_trigger_race_watcher",
      kind: "permanent",
      ownerSeat: "p1",
      controllerSeat: "p1",
      enteredTurn: 0,
      durability: { health: 4, maxHealth: 4 },
    }),
  };
  const withSubject = (defId: "four_player_trigger_dragon" | "four_player_trigger_warrior", id: string): FourPlayerMatchState => ({
    ...raceBefore,
    battlefield: putFourPlayerBattlefieldObject(raceBefore.battlefield!, {
      id,
      defId,
      kind: "unit",
      ownerSeat: "p1",
      controllerSeat: "p1",
      enteredTurn: raceBefore.turn.turn,
      combat: body(defId),
    }),
  });
  const dragonQueue = queueFourPlayerTransitionTriggers(
    raceBefore,
    withSubject("four_player_trigger_dragon", "dragon-subject"),
    [],
    "dragon-race-subject",
  );
  const dragonPump = pumpFourPlayerServer(passAllLiving(dragonQueue.match));
  assert.equal(dragonPump.match.seats.p1.mana, 1, "Dragon summon satisfies Forgeheart-style source-relative manaRefund");

  const warriorQueue = queueFourPlayerTransitionTriggers(
    raceBefore,
    withSubject("four_player_trigger_warrior", "warrior-subject"),
    [],
    "warrior-race-subject",
  );
  const warriorPump = pumpFourPlayerServer(passAllLiving(warriorQueue.match));
  assert.equal(warriorPump.match.seats.p1.mana, 0, "non-Dragon summon must not satisfy the race-gated refund");

  let selfBefore: FourPlayerMatchState = { ...createFourPlayerMatchState("p1"), phase: "main_1" };
  selfBefore = {
    ...selfBefore,
    battlefield: putFourPlayerBattlefieldObject(selfBefore.battlefield!, {
      id: "self-watcher",
      defId: "four_player_trigger_self_watcher",
      kind: "permanent",
      ownerSeat: "p1",
      controllerSeat: "p1",
      enteredTurn: 0,
      durability: { health: 4, maxHealth: 4 },
    }),
  };
  const selfAfter: FourPlayerMatchState = {
    ...selfBefore,
    battlefield: putFourPlayerBattlefieldObject(selfBefore.battlefield!, {
      id: "self-subject-unit",
      defId: "four_player_trigger_warrior",
      kind: "unit",
      ownerSeat: "p1",
      controllerSeat: "p1",
      enteredTurn: selfBefore.turn.turn,
      combat: body("four_player_trigger_warrior"),
    }),
  };
  const selfQueue = queueFourPlayerTransitionTriggers(selfBefore, selfAfter, [], "permanent-self-subject");
  const selfPump = pumpFourPlayerServer(passAllLiving(selfQueue.match));
  const selfSubject = selfPump.match.battlefield?.objects.find((object) => object.id === "self-subject-unit");
  assert.equal(selfSubject?.combat?.barrier, true, "onPermanentSummon target:self must resolve against the summoned Unit subject");

  // Death is explicit: recall-like removal without destroyed metadata cannot fire death triggers.
  let deathBefore: FourPlayerMatchState = { ...createFourPlayerMatchState("p1"), phase: "main_1" };
  deathBefore = {
    ...deathBefore,
    seats: { ...deathBefore.seats, p1: { ...deathBefore.seats.p1, life: 20 } },
    battlefield: putFourPlayerBattlefieldObject(
      putFourPlayerBattlefieldObject(deathBefore.battlefield!, {
        id: "death-source",
        defId: "four_player_trigger_death",
        kind: "unit",
        ownerSeat: "p1",
        controllerSeat: "p1",
        enteredTurn: 0,
        combat: body("four_player_trigger_death"),
      }),
      {
        id: "death-survivor",
        defId: "four_player_trigger_ally_death",
        kind: "unit",
        ownerSeat: "p1",
        controllerSeat: "p1",
        enteredTurn: 0,
        combat: body("four_player_trigger_ally_death"),
      },
    ),
  };
  const deathAfter: FourPlayerMatchState = {
    ...deathBefore,
    battlefield: { objects: deathBefore.battlefield!.objects.filter((object) => object.id !== "death-source") },
  };
  assert.equal(queueFourPlayerTransitionTriggers(deathBefore, deathAfter, [], "recall-is-not-death").queued.length, 0);
  const removed = destroyedFourPlayerObjectsFromRemoval(deathBefore, deathAfter);
  const deathQueue = queueFourPlayerTransitionTriggers(deathBefore, deathAfter, removed, "real-death");
  assert.equal(deathQueue.queued.length, 2);
  const firstDeathPump = pumpFourPlayerServer(passAllLiving(deathQueue.match));
  assert.equal(firstDeathPump.match.seats.p1.life, 22, "same-controller ally-death resolves before earlier pushed onDeath");
  assert.equal(firstDeathPump.match.seats.p2.life, 30);
  const secondDeathPump = pumpFourPlayerServer(passAllLiving(firstDeathPump.match));
  assert.equal(secondDeathPump.match.seats.p2.life, 27);

  // Target snapshots fizzle safely if the chosen permanent disappears first.
  let targetBefore: FourPlayerMatchState = { ...createFourPlayerMatchState("p1"), phase: "main_1" };
  targetBefore = {
    ...targetBefore,
    battlefield: putFourPlayerBattlefieldObject(targetBefore.battlefield!, {
      id: "enemy-permanent",
      defId: "four_player_trigger_target_permanent",
      kind: "permanent",
      ownerSeat: "p2",
      controllerSeat: "p2",
      enteredTurn: 0,
      durability: { health: 4, maxHealth: 4 },
    }),
  };
  const targetAfter: FourPlayerMatchState = {
    ...targetBefore,
    battlefield: putFourPlayerBattlefieldObject(targetBefore.battlefield!, {
      id: "targeting-summon",
      defId: "four_player_trigger_destroy",
      kind: "unit",
      ownerSeat: "p1",
      controllerSeat: "p1",
      enteredTurn: targetBefore.turn.turn,
      combat: body("four_player_trigger_destroy"),
    }),
  };
  const targetQueue = queueFourPlayerTransitionTriggers(targetBefore, targetAfter, [], "fizzle-target");
  const missingTargetMatch: FourPlayerMatchState = {
    ...targetQueue.match,
    battlefield: { objects: targetQueue.match.battlefield!.objects.filter((object) => object.id !== "enemy-permanent") },
  };
  const targetPump = pumpFourPlayerServer(passAllLiving(missingTargetMatch));
  assert.equal(targetPump.resolved[0]?.kind, "triggered_ability");
  assert.equal(targetPump.match.resolution.stack.items.length, 0);

  // APNAP queue order starts at active seat.
  let roundMatch = createFourPlayerMatchState("p1");
  roundMatch = {
    ...roundMatch,
    seats: { ...roundMatch.seats, p4: { ...roundMatch.seats.p4, life: 25 } },
    battlefield: putFourPlayerBattlefieldObject(
      putFourPlayerBattlefieldObject(roundMatch.battlefield!, {
        id: "round-p1",
        defId: "four_player_trigger_round_draw",
        kind: "unit",
        ownerSeat: "p1",
        controllerSeat: "p1",
        enteredTurn: 0,
        combat: body("four_player_trigger_round_draw"),
      }),
      {
        id: "round-p4",
        defId: "four_player_trigger_round_heal",
        kind: "unit",
        ownerSeat: "p4",
        controllerSeat: "p4",
        enteredTurn: 0,
        combat: body("four_player_trigger_round_heal"),
      },
    ),
  };
  const roundQueue = queueFourPlayerRoundStartTriggers(roundMatch, "round-fixture");
  assert.equal(roundQueue.queued.length, 2);
  assert.deepEqual(roundQueue.queued.map((entry) => entry.controller), ["p1", "p4"]);
  assert.equal(roundQueue.match.resolution.priority.holder, "p1");

  // The server queues onRoundStart only when the four-seat turn order wraps.
  let boundary: FourPlayerMatchState = { ...createFourPlayerMatchState("p4"), phase: "ending" };
  boundary = {
    ...boundary,
    battlefield: putFourPlayerBattlefieldObject(boundary.battlefield!, {
      id: "round-boundary-p1",
      defId: "four_player_trigger_round_draw",
      kind: "unit",
      ownerSeat: "p1",
      controllerSeat: "p1",
      enteredTurn: 0,
      combat: body("four_player_trigger_round_draw"),
    }),
  };
  const boundaryPump = pumpFourPlayerServer(passAllLiving(boundary));
  assert.equal(boundaryPump.turnAdvanced, true);
  assert.equal(boundaryPump.match.turn.activeSeat, "p1");
  assert.equal(boundaryPump.match.turn.round, 2);
  assert.equal(boundaryPump.match.resolution.stack.items.at(-1)?.kind, "triggered_ability");

  // drawOnSummon now enters the same certified trigger stack and emits only a count-based draw request.
  const drawOnSummonBefore = { ...createFourPlayerMatchState("p1"), phase: "main_1" as const };
  const drawOnSummonAfter: FourPlayerMatchState = {
    ...drawOnSummonBefore,
    battlefield: putFourPlayerBattlefieldObject(drawOnSummonBefore.battlefield!, {
      id: "draw-on-summon-trigger-source",
      defId: "four_player_trigger_draw_on_summon",
      kind: "unit",
      ownerSeat: "p1",
      controllerSeat: "p1",
      enteredTurn: drawOnSummonBefore.turn.turn,
      combat: body("four_player_trigger_draw_on_summon"),
    }),
  };
  const drawOnSummonQueue = queueFourPlayerTransitionTriggers(
    drawOnSummonBefore,
    drawOnSummonAfter,
    [],
    "draw-on-summon-trigger",
  );
  assert.equal(drawOnSummonQueue.queued.length, 1);
  const drawOnSummonPump = pumpFourPlayerServer(passAllLiving(drawOnSummonQueue.match));
  assert.equal(drawOnSummonPump.drawRequests?.p1, 1);
} finally {
  clearRegisteredCustomCards();
}

console.log("FOUR PLAYER AUTOMATIC TRIGGERS: PASS — summon, death, ally death, permanent summon, round start, drawOnSummon, targets and fizzle");
