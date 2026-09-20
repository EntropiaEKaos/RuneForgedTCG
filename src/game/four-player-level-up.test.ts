import assert from "node:assert/strict";
import { getCard } from "./cards";
import { putFourPlayerBattlefieldObject } from "./four-player-battlefield";
import { createFourPlayerCombatBodySnapshot } from "./four-player-combat-body";
import { clearRegisteredCustomCards, registerCustomCards } from "./custom-registry";
import {
  advanceFourPlayerLevelUps,
  fourPlayerChampionProgress,
} from "./four-player-level-up";
import { createFourPlayerMatchState } from "./four-player-match";
import {
  queueFourPlayerLevelUpTriggers,
  resolveFourPlayerTriggeredAbility,
} from "./four-player-triggers";
import type { CardDef } from "./types";

const base: CardDef = {
  defId: "fourp_level_base",
  name: "Four Player Level Base",
  region: "Tidecall",
  type: "Unit",
  cost: 3,
  power: 2,
  health: 3,
  race: "Spirit",
  keywords: [],
  description: "4P level-up fixture.",
  rarity: "Legend",
  emoji: "L",
  isChampion: true,
  levelUp: { type: "spellsCast", amount: 1, toDefId: "fourp_level_evolved", hint: "Cast one spell" },
};
const evolved: CardDef = {
  defId: "fourp_level_evolved",
  name: "Four Player Level Evolved",
  region: "Tidecall",
  type: "Unit",
  cost: 3,
  power: 5,
  health: 6,
  race: "Spirit",
  keywords: ["Flying"],
  description: "4P evolved fixture.",
  rarity: "Legend",
  emoji: "E",
  isChampion: true,
  collectible: false,
  trigger: { when: "onLevelUp", effect: { kind: "draw", amount: 1, target: "none" } },
};

clearRegisteredCustomCards();
registerCustomCards([base, evolved]);
try {
  const baseBody = createFourPlayerCombatBodySnapshot(base)!;
  let match = createFourPlayerMatchState("p1");
  match = {
    ...match,
    seats: {
      ...match.seats,
      p1: {
        ...match.seats.p1,
        stats: { ...match.seats.p1.stats, spellsCast: 1 },
      },
    },
    battlefield: putFourPlayerBattlefieldObject(match.battlefield!, {
      id: "physical-champion",
      defId: base.defId,
      kind: "unit",
      ownerSeat: "p1",
      controllerSeat: "p1",
      enteredTurn: 0,
      keywords: ["Haste"],
      combat: {
        ...baseBody,
        power: baseBody.power + 2,
        maxHealth: baseBody.maxHealth + 1,
        health: baseBody.health - 1,
      },
      nexusStrikes: 1,
      equipment: [{
        instanceId: "eq-1",
        defId: "virtual-eq",
        ownerSeat: "p1",
        physical: false,
        buffPower: 0,
        buffHealth: 0,
        keywords: ["Barrier"],
      }],
    }),
  };

  const before = match.battlefield!.objects[0]!;
  const progress = fourPlayerChampionProgress(match, before);
  assert.deepEqual(progress, { current: 1, goal: 1, hint: "Cast one spell" });

  const leveled = advanceFourPlayerLevelUps(match);
  assert.equal(leveled.leveled.length, 1);
  const after = leveled.match.battlefield!.objects[0]!;
  const nextBody = createFourPlayerCombatBodySnapshot(evolved)!;
  assert.equal(after.id, before.id, "level-up preserves physical instance identity");
  assert.equal(after.defId, evolved.defId);
  assert.equal(after.combat?.power, nextBody.power + 2, "durable power delta survives transformation");
  assert.equal(after.combat?.maxHealth, nextBody.maxHealth + 1, "durable max-health delta survives transformation");
  assert.equal(after.combat?.health, (baseBody.health - 1) + ((nextBody.maxHealth + 1) - (baseBody.maxHealth + 1)), "existing damage is preserved across the new max health");
  assert.equal(after.nexusStrikes, 1, "per-instance Nexus-strike progress survives transformation");
  assert.equal(after.keywords.includes("Flying"), true, "new printed keywords are applied");
  assert.equal(after.keywords.includes("Haste"), true, "gained durable keywords survive");
  assert.equal(after.keywords.includes("Barrier"), true, "Equipment keywords are re-merged");
  assert.equal(after.combat?.barrier, true, "Barrier is refreshed from the transformed durable keyword set");

  const queued = queueFourPlayerLevelUpTriggers(leveled.match, leveled.leveled, "level-test");
  assert.equal(queued.queued.length, 1);
  assert.equal((queued.queued[0]!.payload as { when?: string }).when, "onLevelUp");
  const resolved = resolveFourPlayerTriggeredAbility(queued.match, queued.queued[0]!);
  assert.equal(resolved.draws.p1, 1, "evolved form onLevelUp trigger resolves on the shared 4P stack");

  const cases = [
    { defId: "ember_champion", stat: "nexusDamageDealt" as const, amount: getCard("ember_champion").levelUp!.amount },
    { defId: "tide_champion", stat: "spellsCast" as const, amount: getCard("tide_champion").levelUp!.amount },
    { defId: "forest_champion", stat: "alliesSummoned" as const, amount: getCard("forest_champion").levelUp!.amount },
  ];
  for (const item of cases) {
    const definition = getCard(item.defId);
    const body = createFourPlayerCombatBodySnapshot(definition)!;
    let probe = createFourPlayerMatchState("p1");
    probe = {
      ...probe,
      seats: {
        ...probe.seats,
        p1: {
          ...probe.seats.p1,
          stats: { ...probe.seats.p1.stats, [item.stat]: item.amount },
        },
      },
      battlefield: putFourPlayerBattlefieldObject(probe.battlefield!, {
        id: `probe-${item.defId}`,
        defId: item.defId,
        kind: "unit",
        ownerSeat: "p1",
        controllerSeat: "p1",
        enteredTurn: 0,
        keywords: definition.keywords ?? [],
        combat: body,
      }),
    };
    assert.equal(fourPlayerChampionProgress(probe, probe.battlefield!.objects[0]!)?.current, item.amount);
  }

  const strikeDef = getCard("storm_champion");
  let strikeProbe = createFourPlayerMatchState("p1");
  strikeProbe = {
    ...strikeProbe,
    battlefield: putFourPlayerBattlefieldObject(strikeProbe.battlefield!, {
      id: "strike-probe",
      defId: strikeDef.defId,
      kind: "unit",
      ownerSeat: "p1",
      controllerSeat: "p1",
      enteredTurn: 0,
      keywords: strikeDef.keywords ?? [],
      combat: createFourPlayerCombatBodySnapshot(strikeDef)!,
      nexusStrikes: strikeDef.levelUp!.amount,
    }),
  };
  assert.equal(
    fourPlayerChampionProgress(strikeProbe, strikeProbe.battlefield!.objects[0]!)?.current,
    strikeDef.levelUp!.amount,
    "nexusStrikes uses physical-instance progress instead of seat-global stats",
  );

  console.log("FOUR PLAYER LEVEL UP: PASS — counters, physical transformation, durable state and onLevelUp stack trigger");
} finally {
  clearRegisteredCustomCards();
}
