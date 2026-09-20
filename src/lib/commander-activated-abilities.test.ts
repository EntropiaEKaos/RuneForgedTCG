import assert from "node:assert/strict";
import { putFourPlayerBattlefieldObject } from "../game/four-player-battlefield";
import { collectibleCards } from "../game/cards";
import { createFourPlayerCombatBodySnapshot } from "../game/four-player-combat-body";
import {
  createCommanderCombatEnvelope,
  processCommanderCombatCommand,
  projectCommanderCombatState,
  type CommanderCombatEnvelope,
} from "./commander-combat";

async function main() {
  const generals = collectibleCards()
    .filter((card) => card.collectible !== false && card.type === "Unit" && (card.isChampion || card.isLegend))
    .slice(0, 4);
  assert.equal(generals.length, 4, "fixture requires four Unit General candidates");

  const sourceDef = collectibleCards().find((card) =>
    card.collectible !== false
    && card.type === "Unit"
    && Boolean(card.activatedAbilities?.some((ability) =>
      ability.effect?.kind === "damageUnit"
      && ability.effect.target === "enemyUnit"
      && !ability.cost?.spellMana
      && (ability.cost?.mana ?? 0) <= 10
    )),
  );
  assert.ok(sourceDef, "fixture requires a 4P-compatible activated Unit");
  const abilityIndex = sourceDef.activatedAbilities!.findIndex((ability) =>
    ability.effect?.kind === "damageUnit" && ability.effect.target === "enemyUnit" && !ability.cost?.spellMana
  );
  const ability = sourceDef.activatedAbilities![abilityIndex]!;
  const sourceBody = createFourPlayerCombatBodySnapshot(sourceDef);
  assert.ok(sourceBody);

  const targetDef = collectibleCards().find((card) =>
    card.collectible !== false
    && card.type === "Unit"
    && !card.keywords?.includes("Hexproof")
    && (card.health ?? 0) > (ability.effect?.amount ?? 0)
  );
  assert.ok(targetDef);
  const targetBody = createFourPlayerCombatBodySnapshot(targetDef);
  assert.ok(targetBody);

  const seats = generals.map((general, index) => ({
    seat: index as 0 | 1 | 2 | 3,
    playerId: 600 + index,
    playerName: `Commander Ability P${index + 1}`,
    deckCards: Array.from({ length: 60 }, () => index === 0 ? sourceDef.defId : targetDef.defId),
    generalDefId: general.defId,
  }));
  const initial = await createCommanderCombatEnvelope("commander:ability-room", 300, 0x41424344, seats);
  const sourceCard = initial.zones.p1.hand[0]!;
  const targetCard = initial.zones.p2.hand[0]!;

  let battlefield = putFourPlayerBattlefieldObject(initial.match.battlefield!, {
    id: sourceCard.instanceId,
    defId: sourceCard.defId,
    kind: "unit",
    ownerSeat: "p1",
    controllerSeat: "p1",
    enteredTurn: 0,
    keywords: sourceDef.keywords ?? [],
    combat: sourceBody,
  });
  battlefield = putFourPlayerBattlefieldObject(battlefield, {
    id: targetCard.instanceId,
    defId: targetCard.defId,
    kind: "unit",
    ownerSeat: "p2",
    controllerSeat: "p2",
    enteredTurn: 0,
    keywords: targetDef.keywords ?? [],
    combat: targetBody,
  });

  let envelope: CommanderCombatEnvelope = {
    ...initial,
    zones: {
      ...initial.zones,
      p1: { ...initial.zones.p1, hand: initial.zones.p1.hand.slice(1) },
      p2: { ...initial.zones.p2, hand: initial.zones.p2.hand.slice(1) },
    },
    match: {
      ...initial.match,
      phase: "main_1",
      battlefield,
      seats: {
        ...initial.match.seats,
        p1: { ...initial.match.seats.p1, mana: 10, maxMana: 10 },
      },
    },
  };

  const projected = projectCommanderCombatState(envelope, 0);
  const option = projected.abilities.find((entry) =>
    entry.sourceId === sourceCard.instanceId
    && entry.timing === "main"
    && entry.abilityIndex === abilityIndex
  );
  assert.ok(option, "Commander projection must expose legal authoritative ability options only to the priority holder");

  envelope = processCommanderCombatCommand(envelope, 600, 0, {
    commandId: "cmd-ability-stage",
    expectedRevision: 300,
    type: "activate_ability",
    payload: {
      sourceId: sourceCard.instanceId,
      abilityIndex,
      timing: "main",
      target: { kind: "battlefield", objectId: targetCard.instanceId },
      effect: { kind: "killUnit", amount: 999, target: "enemyUnit" },
      manaCost: 0,
    },
  });
  assert.equal(envelope.protocol.revision, 301);
  assert.equal(envelope.match.resolution.stack.items.at(-1)?.kind, "ability_activation");
  assert.equal(
    (envelope.match.resolution.stack.items.at(-1)?.payload as { effect?: { kind?: string } }).effect?.kind,
    ability.effect?.kind,
    "bridge must derive ability effect from authoritative source definition instead of client payload",
  );
  assert.equal(envelope.match.seats.p1.mana, 10 - (ability.cost?.mana ?? 0));
  assert.equal(envelope.match.resolution.priority.holder, "p2");

  envelope = processCommanderCombatCommand(envelope, 601, 1, { commandId: "cmd-ability-pass-p2", expectedRevision: 301, type: "pass_priority" });
  envelope = processCommanderCombatCommand(envelope, 602, 2, { commandId: "cmd-ability-pass-p3", expectedRevision: 302, type: "pass_priority" });
  envelope = processCommanderCombatCommand(envelope, 603, 3, { commandId: "cmd-ability-pass-p4", expectedRevision: 303, type: "pass_priority" });
  envelope = processCommanderCombatCommand(envelope, 600, 0, { commandId: "cmd-ability-pass-p1", expectedRevision: 304, type: "pass_priority" });

  assert.equal(envelope.protocol.revision, 305);
  assert.equal(envelope.match.resolution.stack.items.length, 0);
  assert.equal(
    envelope.match.battlefield?.objects.find((object) => object.id === targetCard.instanceId)?.combat?.health,
    targetBody.health - (ability.effect?.amount ?? 0),
  );
  assert.equal(projectCommanderCombatState(envelope, 0).abilities.some((entry) => entry.sourceId === sourceCard.instanceId), false, "used ability must disappear from the same-round option surface");
}

void main().then(() => {
  console.log("COMMANDER 4P ACTIVATED ABILITY BRIDGE: PASS — authoritative projection, anti-forgery payload, stack resolution and usage budget");
});
