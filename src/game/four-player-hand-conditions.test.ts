import assert from "node:assert/strict";
import { putFourPlayerBattlefieldObject } from "./four-player-battlefield";
import { fourPlayerHandCounts, type FourPlayerCardInstance, type FourPlayerCardZones } from "./four-player-card-zones";
import { createFourPlayerCombatBodySnapshot } from "./four-player-combat-body";
import { clearRegisteredCustomCards, registerCustomCards } from "./custom-registry";
import type { FourPlayerSeat } from "./four-player-general";
import { fourPlayerMechanicConditionMatches } from "./four-player-mechanic-conditions";
import { createFourPlayerMatchState } from "./four-player-match";
import { queueFourPlayerRoundStartTriggers } from "./four-player-triggers";
import type { CardDef } from "./types";

function hand(seat: FourPlayerSeat, count: number): FourPlayerCardInstance[] {
  return Array.from({ length: count }, (_, index) => ({
    instanceId: `${seat}:secret:${index + 1}`,
    defId: `secret_${seat}_${index + 1}`,
    ownerSeat: seat,
  }));
}

const watcher: CardDef = {
  defId: "fourp_hand_condition_watcher",
  name: "4P Hand Condition Watcher",
  region: "Tidecall",
  type: "Unit",
  cost: 2,
  power: 2,
  health: 4,
  rarity: "Rare",
  description: "Fixture",
  emoji: "H",
  mechanics: [
    {
      key: "own_hand",
      name: "Own Hand",
      trigger: "onRoundStart",
      condition: { kind: "handAtLeast", amount: 2 },
      effect: { kind: "healNexus", amount: 1, target: "none" },
    },
    {
      key: "next_opponent_hand",
      name: "Next Opponent Hand",
      trigger: "onRoundStart",
      condition: { kind: "opponentHandAtLeast", amount: 3 },
      effect: { kind: "healNexus", amount: 1, target: "none" },
    },
    {
      key: "must_not_use_later_opponent",
      name: "Later Opponent Must Not Match",
      trigger: "onRoundStart",
      condition: { kind: "opponentHandAtLeast", amount: 4 },
      effect: { kind: "healNexus", amount: 1, target: "none" },
    },
  ],
};

clearRegisteredCustomCards();
registerCustomCards([watcher]);

try {
  const zones: FourPlayerCardZones = {
    p1: { hand: hand("p1", 2), deck: [], graveyard: [] },
    p2: { hand: hand("p2", 9), deck: [], graveyard: [] },
    p3: { hand: hand("p3", 3), deck: [], graveyard: [] },
    p4: { hand: hand("p4", 5), deck: [], graveyard: [] },
  };
  const handCounts = fourPlayerHandCounts(zones);

  assert.deepEqual(handCounts, { p1: 2, p2: 9, p3: 3, p4: 5 });
  assert.equal(JSON.stringify(handCounts).includes("secret_"), false, "condition context must never contain private card identities");

  const body = createFourPlayerCombatBodySnapshot(watcher)!;
  let match = createFourPlayerMatchState("p1");
  match = {
    ...match,
    seats: {
      ...match.seats,
      p2: { ...match.seats.p2, eliminated: true },
    },
    battlefield: putFourPlayerBattlefieldObject(match.battlefield!, {
      id: "hand-watcher",
      defId: watcher.defId,
      kind: "unit",
      ownerSeat: "p1",
      controllerSeat: "p1",
      enteredTurn: 0,
      keywords: [],
      combat: body,
    }),
  };

  const source = match.battlefield!.objects.find((object) => object.id === "hand-watcher")!;
  const context = { handCounts };

  assert.deepEqual(
    fourPlayerMechanicConditionMatches(match, source, { kind: "handAtLeast", amount: 2 }),
    { supported: false, matches: false },
    "hand thresholds fail closed when no authoritative count context is supplied",
  );
  assert.deepEqual(
    fourPlayerMechanicConditionMatches(match, source, { kind: "handAtLeast", amount: 2 }, context),
    { supported: true, matches: true },
  );
  assert.deepEqual(
    fourPlayerMechanicConditionMatches(match, source, { kind: "opponentHandAtLeast", amount: 3 }, context),
    { supported: true, matches: true },
    "p2 is eliminated, so singular opponent hand checks must use clockwise p3",
  );
  assert.deepEqual(
    fourPlayerMechanicConditionMatches(match, source, { kind: "opponentHandAtLeast", amount: 4 }, context),
    { supported: true, matches: false },
    "p4 has five cards but must not satisfy a singular opponent check while living p3 is next clockwise",
  );
  assert.deepEqual(
    fourPlayerMechanicConditionMatches(match, source, {
      kind: "and",
      children: [
        { kind: "handAtLeast", amount: 2 },
        { kind: "opponentHandAtLeast", amount: 3 },
      ],
    }, context),
    { supported: true, matches: true },
    "recursive condition trees must receive the same count-only context",
  );

  const withoutContext = queueFourPlayerRoundStartTriggers(match, "hand-no-context");
  assert.equal(
    withoutContext.queued.filter((item) => item.payload.sourceDefId === watcher.defId).length,
    0,
    "hand mechanics must remain fail closed outside the Commander zone-aware path",
  );

  const withContext = queueFourPlayerRoundStartTriggers(match, "hand-with-context", context);
  assert.equal(
    withContext.queued.filter((item) => item.payload.sourceDefId === watcher.defId).length,
    2,
    "only the own-hand and next-living-opponent hand mechanics should queue",
  );
  assert.deepEqual(
    new Set(withContext.queued.map((item) => item.payload.description)),
    new Set(["Own Hand — onRoundStart", "Next Opponent Hand — onRoundStart"]),
  );

  console.log("FOUR PLAYER HAND CONDITIONS: PASS — count-only authority, privacy, clockwise opponent and trigger integration");
} finally {
  clearRegisteredCustomCards();
}
