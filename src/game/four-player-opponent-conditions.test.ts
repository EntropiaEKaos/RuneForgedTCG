import assert from "node:assert/strict";
import { putFourPlayerBattlefieldObject } from "./four-player-battlefield";
import { createFourPlayerCombatBodySnapshot } from "./four-player-combat-body";
import { clearRegisteredCustomCards, registerCustomCards } from "./custom-registry";
import { fourPlayerMechanicConditionMatches } from "./four-player-mechanic-conditions";
import { createFourPlayerMatchState } from "./four-player-match";
import type { CardDef } from "./types";

const sourceDef: CardDef = {
  defId: "fourp_condition_source",
  name: "4P Condition Source",
  region: "Ironwood",
  type: "Unit",
  cost: 2,
  power: 2,
  health: 4,
  race: "Beast",
  classes: ["warden"],
  rarity: "Rare",
  description: "Fixture",
  emoji: "S",
};

const dragonDef: CardDef = {
  defId: "fourp_condition_dragon",
  name: "4P Condition Dragon",
  region: "Emberhold",
  type: "Unit",
  cost: 2,
  power: 3,
  health: 3,
  race: "Dragon",
  classes: ["mage"],
  rarity: "Rare",
  description: "Fixture",
  emoji: "D",
};

clearRegisteredCustomCards();
registerCustomCards([sourceDef, dragonDef]);

try {
  const sourceBody = createFourPlayerCombatBodySnapshot(sourceDef)!;
  const dragonBody = createFourPlayerCombatBodySnapshot(dragonDef)!;
  let match = createFourPlayerMatchState("p1");

  match = {
    ...match,
    seats: {
      ...match.seats,
      p2: {
        ...match.seats.p2,
        eliminated: true,
        life: 1,
        mana: 9,
        spellMana: 3,
        stats: { nexusDamageDealt: 99, spellsCast: 99, alliesSummoned: 99 },
      },
      p3: {
        ...match.seats.p3,
        life: 12,
        mana: 3,
        spellMana: 2,
        stats: { nexusDamageDealt: 6, spellsCast: 4, alliesSummoned: 5 },
      },
      p4: {
        ...match.seats.p4,
        life: 5,
        mana: 8,
        spellMana: 3,
        stats: { nexusDamageDealt: 12, spellsCast: 9, alliesSummoned: 10 },
      },
    },
  };

  match = {
    ...match,
    battlefield: putFourPlayerBattlefieldObject(
      putFourPlayerBattlefieldObject(
        putFourPlayerBattlefieldObject(match.battlefield!, {
          id: "source-p1",
          defId: sourceDef.defId,
          kind: "unit",
          ownerSeat: "p1",
          controllerSeat: "p1",
          enteredTurn: 0,
          keywords: [],
          combat: sourceBody,
        }),
        {
          id: "eliminated-p2-dragon",
          defId: dragonDef.defId,
          kind: "unit",
          ownerSeat: "p2",
          controllerSeat: "p2",
          enteredTurn: 0,
          keywords: [],
          combat: dragonBody,
        },
      ),
      {
        id: "living-p3-dragon",
        defId: dragonDef.defId,
        kind: "unit",
        ownerSeat: "p3",
        controllerSeat: "p3",
        enteredTurn: 0,
        keywords: [],
        combat: dragonBody,
      },
    ),
  };

  match = {
    ...match,
    battlefield: putFourPlayerBattlefieldObject(match.battlefield!, {
      id: "living-p4-dragon",
      defId: dragonDef.defId,
      kind: "unit",
      ownerSeat: "p4",
      controllerSeat: "p4",
      enteredTurn: 0,
      keywords: [],
      combat: dragonBody,
    }),
  };

  const source = match.battlefield!.objects.find((object) => object.id === "source-p1")!;

  assert.deepEqual(
    fourPlayerMechanicConditionMatches(match, source, { kind: "enemyRace", race: "Dragon", min: 2 }),
    { supported: true, matches: true },
    "enemyRace aggregates all living opponents while ignoring eliminated seats",
  );
  assert.deepEqual(
    fourPlayerMechanicConditionMatches(match, source, { kind: "enemyClass", classKey: "mage", min: 2 }),
    { supported: true, matches: true },
  );
  assert.deepEqual(
    fourPlayerMechanicConditionMatches(match, source, { kind: "enemyUnitsAtLeast", min: 2 }),
    { supported: true, matches: true },
  );

  assert.deepEqual(
    fourPlayerMechanicConditionMatches(match, source, { kind: "opponentNexusBelow", amount: 10 }),
    { supported: true, matches: false },
    "p2 is eliminated, so singular opponent resolves clockwise to living p3 instead of low-life p4",
  );
  assert.deepEqual(
    fourPlayerMechanicConditionMatches(match, source, { kind: "opponentManaAtLeast", amount: 3 }),
    { supported: true, matches: true },
  );
  assert.deepEqual(
    fourPlayerMechanicConditionMatches(match, source, { kind: "opponentSpellManaAtLeast", amount: 2 }),
    { supported: true, matches: true },
  );
  assert.deepEqual(
    fourPlayerMechanicConditionMatches(match, source, { kind: "opponentSpellsCastAtLeast", amount: 4 }),
    { supported: true, matches: true },
  );
  assert.deepEqual(
    fourPlayerMechanicConditionMatches(match, source, { kind: "opponentAlliesSummonedAtLeast", amount: 5 }),
    { supported: true, matches: true },
  );
  assert.deepEqual(
    fourPlayerMechanicConditionMatches(match, source, { kind: "opponentNexusDamageDealtAtLeast", amount: 6 }),
    { supported: true, matches: true },
  );

  const p3Below = {
    ...match,
    seats: {
      ...match.seats,
      p3: { ...match.seats.p3, life: 8 },
    },
  };
  assert.deepEqual(
    fourPlayerMechanicConditionMatches(p3Below, source, { kind: "opponentNexusBelow", amount: 10 }),
    { supported: true, matches: true },
    "clockwise singular opponent threshold follows p3 state",
  );

  assert.deepEqual(
    fourPlayerMechanicConditionMatches(match, source, { kind: "handAtLeast", amount: 1 }),
    { supported: false, matches: false },
    "private hand thresholds remain fail-closed in the match-only evaluator",
  );
  assert.deepEqual(
    fourPlayerMechanicConditionMatches(match, source, { kind: "opponentHandAtLeast", amount: 1 }),
    { supported: false, matches: false },
  );

  console.log("FOUR PLAYER OPPONENT CONDITIONS: PASS — enemy aggregation, clockwise opponent fallback and hand fail-closed semantics");
} finally {
  clearRegisteredCustomCards();
}
