import assert from "node:assert/strict";
import { putFourPlayerBattlefieldObject } from "./four-player-battlefield";
import { createFourPlayerCombatBodySnapshot } from "./four-player-combat-body";
import { clearRegisteredCustomCards, registerCustomCards } from "./custom-registry";
import { createFourPlayerMatchState } from "./four-player-match";
import { queueFourPlayerRoundStartTriggers } from "./four-player-triggers";
import type { CardDef } from "./types";

const supported: CardDef = {
  defId: "fourp_mechanic_supported",
  name: "4P Mechanic Supported",
  region: "Ironwood",
  type: "Unit",
  cost: 2,
  power: 2,
  health: 4,
  race: "Beast",
  rarity: "Rare",
  description: "Fixture",
  emoji: "M",
  mechanics: [{
    key: "damaged_pack",
    name: "Damaged Pack",
    trigger: "onRoundStart",
    condition: {
      kind: "and",
      children: [
        { kind: "selfDamaged" },
        { kind: "allyRace", race: "Beast", min: 1 },
        { kind: "roundAtLeast", amount: 1 },
      ],
    },
    effect: { kind: "healNexus", amount: 2, target: "none" },
  }],
};

const ordered: CardDef = {
  defId: "fourp_mechanic_ordered",
  name: "4P Mechanic Ordered",
  region: "Emberhold",
  type: "Unit",
  cost: 2,
  power: 2,
  health: 3,
  rarity: "Rare",
  description: "Fixture",
  emoji: "O",
  trigger: { when: "onRoundStart", effect: { kind: "healNexus", amount: 1, target: "none" } },
  mechanics: [
    {
      key: "first_authored",
      name: "First Authored",
      trigger: "onRoundStart",
      condition: { kind: "always" },
      effect: { kind: "healNexus", amount: 2, target: "none" },
    },
    {
      key: "second_authored",
      name: "Second Authored",
      trigger: "onRoundStart",
      condition: { kind: "always" },
      effect: { kind: "healNexus", amount: 3, target: "none" },
    },
  ],
};

const unsupported: CardDef = {
  defId: "fourp_mechanic_unsupported_opponent",
  name: "4P Mechanic Unsupported Opponent",
  region: "Tidecall",
  type: "Unit",
  cost: 2,
  power: 1,
  health: 3,
  rarity: "Rare",
  description: "Fixture",
  emoji: "U",
  mechanics: [{
    key: "ambiguous_opponent",
    trigger: "onRoundStart",
    condition: { kind: "opponentNexusBelow", amount: 30 },
    effect: { kind: "draw", amount: 1, target: "none" },
  }],
};

clearRegisteredCustomCards();
registerCustomCards([supported, ordered, unsupported]);

try {
  const body = createFourPlayerCombatBodySnapshot(supported)!;
  let match = createFourPlayerMatchState("p1");
  match = {
    ...match,
    seats: {
      ...match.seats,
      p1: { ...match.seats.p1, life: 20 },
    },
    battlefield: putFourPlayerBattlefieldObject(match.battlefield!, {
      id: "supported-source",
      defId: supported.defId,
      kind: "unit",
      ownerSeat: "p1",
      controllerSeat: "p1",
      enteredTurn: 0,
      keywords: [],
      combat: { ...body, health: body.maxHealth - 1 },
    }),
  };

  const supportedQueue = queueFourPlayerRoundStartTriggers(match, "mechanic-supported");
  assert.equal(supportedQueue.queued.length, 1, "supported controller-scoped mechanic must enter the shared stack");
  assert.match(String(supportedQueue.queued[0]!.payload.description), /Damaged Pack/);

  const fullHealth = {
    ...match,
    battlefield: {
      objects: match.battlefield!.objects.map((object) => ({
        ...object,
        ...(object.combat ? { combat: { ...object.combat, health: object.combat.maxHealth } } : {}),
      })),
    },
  };
  assert.equal(
    queueFourPlayerRoundStartTriggers(fullHealth, "mechanic-condition-false").queued.length,
    0,
    "false supported mechanic condition must not queue",
  );

  const orderedBody = createFourPlayerCombatBodySnapshot(ordered)!;
  const orderedMatch = {
    ...createFourPlayerMatchState("p1"),
    battlefield: putFourPlayerBattlefieldObject(createFourPlayerMatchState("p1").battlefield!, {
      id: "ordered-source",
      defId: ordered.defId,
      kind: "unit",
      ownerSeat: "p1",
      controllerSeat: "p1",
      enteredTurn: 0,
      keywords: [],
      combat: orderedBody,
    }),
  };
  const orderedQueue = queueFourPlayerRoundStartTriggers(orderedMatch, "mechanic-order");
  assert.deepEqual(
    orderedQueue.queued.map((item) => item.payload.description),
    [
      "Second Authored — onRoundStart",
      "First Authored — onRoundStart",
      "4P Mechanic Ordered — onRoundStart",
    ],
    "LIFO push order must resolve printed first, then mechanics in authored order like 1v1",
  );

  const unsupportedBody = createFourPlayerCombatBodySnapshot(unsupported)!;
  const ambiguous = {
    ...match,
    battlefield: putFourPlayerBattlefieldObject(match.battlefield!, {
      id: "unsupported-source",
      defId: unsupported.defId,
      kind: "unit",
      ownerSeat: "p1",
      controllerSeat: "p1",
      enteredTurn: 0,
      keywords: [],
      combat: unsupportedBody,
    }),
  };
  const ambiguousQueue = queueFourPlayerRoundStartTriggers(ambiguous, "mechanic-unsupported");
  assert.equal(
    ambiguousQueue.queued.filter((item) => item.payload.sourceDefId === unsupported.defId).length,
    0,
    "singular opponent conditions remain fail-closed until multiplayer semantics are explicit",
  );

  console.log("FOUR PLAYER MECHANICS TRIGGERS: PASS — supported condition trees queue; false/ambiguous conditions fail closed");
} finally {
  clearRegisteredCustomCards();
}
