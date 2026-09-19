import assert from "node:assert/strict";
import type { ReactionActivatedAbility } from "./activated-ability-types";
import {
  fourPlayerActivatedAbilityOptions,
  stageFourPlayerActivatedAbility,
} from "./four-player-activated-abilities";
import { putFourPlayerBattlefieldObject } from "./four-player-battlefield";
import { createFourPlayerCardZones } from "./four-player-card-zones";
import { resolveFourPlayerCardCast, stageFourPlayerCardCast } from "./four-player-card-play";
import { collectibleCards, getCard } from "./cards";
import { createFourPlayerCombatBodySnapshot } from "./four-player-combat-body";
import { passFourPlayerFlow, submitFourPlayerAction } from "./four-player-flow";
import { createFourPlayerMatchState, type FourPlayerMatchState } from "./four-player-match";
import { pumpFourPlayerServer } from "./four-player-server-pump";

function passAllLiving(match: FourPlayerMatchState): FourPlayerMatchState {
  let next = match;
  for (let index = 0; index < 4; index += 1) {
    next = { ...next, resolution: passFourPlayerFlow(next.resolution) };
  }
  return next;
}

const sourceDef = collectibleCards().find((card) =>
  card.collectible !== false
  && card.type === "Unit"
  && Boolean(card.activatedAbilities?.some((ability) =>
    ability.effect?.kind === "damageUnit"
    && ability.effect.target === "enemyUnit"
    && (ability.cost?.mana ?? 0) <= 10
    && !ability.cost?.spellMana
  )),
);
assert.ok(sourceDef, "fixture requires a Unit with a regular-mana enemy-unit activated ability");
const abilityIndex = sourceDef.activatedAbilities!.findIndex((ability) =>
  ability.effect?.kind === "damageUnit" && ability.effect.target === "enemyUnit" && !ability.cost?.spellMana
);
const ability = sourceDef.activatedAbilities![abilityIndex]!;
const sourceBody = createFourPlayerCombatBodySnapshot(sourceDef);
assert.ok(sourceBody, "activated source must have a combat body");

const targetDef = collectibleCards().find((card) =>
  card.collectible !== false
  && card.type === "Unit"
  && !card.keywords?.includes("Hexproof")
  && (card.health ?? 0) > (ability.effect?.amount ?? 0)
);
assert.ok(targetDef, "fixture requires a living non-Hexproof target");
const targetBody = createFourPlayerCombatBodySnapshot(targetDef);
assert.ok(targetBody, "target must have a combat body");

const emptyZones = createFourPlayerCardZones({
  p1: [sourceDef.defId],
  p2: [targetDef.defId],
  p3: [targetDef.defId],
  p4: [targetDef.defId],
}, 0);

let mainMatch: FourPlayerMatchState = { ...createFourPlayerMatchState("p1", undefined, 10), phase: "main_1" };
mainMatch = {
  ...mainMatch,
  battlefield: putFourPlayerBattlefieldObject(mainMatch.battlefield!, {
    id: "ability-source-p1",
    defId: sourceDef.defId,
    kind: "unit",
    ownerSeat: "p1",
    controllerSeat: "p1",
    enteredTurn: 0,
    keywords: sourceDef.keywords ?? [],
    combat: sourceBody,
  }),
};
mainMatch = {
  ...mainMatch,
  battlefield: putFourPlayerBattlefieldObject(mainMatch.battlefield!, {
    id: "ability-target-p2",
    defId: targetDef.defId,
    kind: "unit",
    ownerSeat: "p2",
    controllerSeat: "p2",
    enteredTurn: 0,
    keywords: targetDef.keywords ?? [],
    combat: targetBody,
  }),
};

const mainOptions = fourPlayerActivatedAbilityOptions(mainMatch, emptyZones, "p1");
assert.equal(
  mainOptions.some((option) => option.sourceId === "ability-source-p1" && option.abilityIndex === abilityIndex && option.timing === "main"),
  true,
  "priority holder must receive authoritative main activated ability options",
);

const stagedMain = stageFourPlayerActivatedAbility(
  mainMatch,
  emptyZones,
  "p1",
  "ability-source-p1",
  "main",
  abilityIndex,
  "e-main-ability",
  { kind: "battlefield", objectId: "ability-target-p2" },
);
assert.equal(stagedMain.stackItem.kind, "ability_activation");
assert.equal(stagedMain.match.seats.p1.mana, mainMatch.seats.p1.mana - (ability.cost?.mana ?? 0));
if (ability.cost?.exhaustSelf) {
  assert.equal(stagedMain.match.battlefield?.objects.find((object) => object.id === "ability-source-p1")?.attackedThisTurn, true);
}

let mainOnStack: FourPlayerMatchState = {
  ...stagedMain.match,
  resolution: submitFourPlayerAction(stagedMain.match.resolution, stagedMain.stackItem),
};
mainOnStack = passAllLiving(mainOnStack);
const mainPump = pumpFourPlayerServer(mainOnStack);
assert.equal(mainPump.resolved[0]?.kind, "ability_activation");
assert.equal(
  mainPump.match.battlefield?.objects.find((object) => object.id === "ability-target-p2")?.combat?.health,
  targetBody.health - (ability.effect?.amount ?? 0),
);
assert.throws(
  () => stageFourPlayerActivatedAbility(
    mainPump.match,
    stagedMain.zones,
    "p1",
    "ability-source-p1",
    "main",
    abilityIndex,
    "e-main-repeat",
    { kind: "battlefield", objectId: "ability-target-p2" },
  ),
  /per-round use limit|already exhausted/,
);

// Modal choice is mandatory and the chosen mode is snapshotted from the catalog.
const originalMainAbilities = sourceDef.activatedAbilities;
const modalIndex = originalMainAbilities?.length ?? 0;
sourceDef.activatedAbilities = [
  ...(originalMainAbilities ?? []),
  {
    description: "Choose a current",
    cost: { mana: 0 },
    maxUsesPerRound: 1,
    modes: [
      { id: "draw-mode", description: "Draw", effect: { kind: "draw", amount: 1, target: "none" } },
      { id: "heal-mode", description: "Heal", effect: { kind: "healNexus", amount: 1, target: "none" } },
    ],
  },
  {
    description: "Spell-mana probe",
    cost: { spellMana: 1 },
    maxUsesPerRound: 1,
    effect: { kind: "draw", amount: 1, target: "none" },
  },
];
try {
  assert.throws(
    () => stageFourPlayerActivatedAbility(
      mainPump.match,
      stagedMain.zones,
      "p1",
      "ability-source-p1",
      "main",
      modalIndex,
      "e-modal-missing",
    ),
    /requires a modeId/,
  );
  const stagedModal = stageFourPlayerActivatedAbility(
    mainPump.match,
    stagedMain.zones,
    "p1",
    "ability-source-p1",
    "main",
    modalIndex,
    "e-modal-heal",
    undefined,
    undefined,
    "heal-mode",
  );
  const modalPayload = stagedModal.stackItem.payload as { modeId?: string; effect?: { kind?: string } };
  assert.equal(modalPayload.modeId, "heal-mode");
  assert.equal(modalPayload.effect?.kind, "healNexus");
  const spellManaReady: FourPlayerMatchState = {
    ...mainPump.match,
    seats: {
      ...mainPump.match.seats,
      p1: { ...mainPump.match.seats.p1, spellMana: 1 },
    },
  };
  const stagedSpellMana = stageFourPlayerActivatedAbility(
    spellManaReady,
    stagedMain.zones,
    "p1",
    "ability-source-p1",
    "main",
    modalIndex + 1,
    "e-spell-mana-paid",
  );
  assert.equal(stagedSpellMana.match.seats.p1.spellMana, 0);
  assert.equal(stagedSpellMana.match.seats.p1.mana, spellManaReady.seats.p1.mana);
  const spellManaMissing: FourPlayerMatchState = {
    ...mainPump.match,
    seats: {
      ...mainPump.match.seats,
      p1: { ...mainPump.match.seats.p1, mana: 10, spellMana: 0 },
    },
  };
  assert.throws(
    () => stageFourPlayerActivatedAbility(
      spellManaMissing,
      stagedMain.zones,
      "p1",
      "ability-source-p1",
      "main",
      modalIndex + 1,
      "e-spell-mana-missing",
    ),
    /Not enough spell mana/,
    "regular mana must never pay an explicit spellMana ability cost",
  );
} finally {
  sourceDef.activatedAbilities = originalMainAbilities;
}

// Physical Sentinela casts snapshot loyalty, and all its classic abilities share one activation budget.
const sentinelaDef = getCard("sent_marinna");
assert.equal(sentinelaDef.type, "Sentinela");
assert.ok(sentinelaDef.sentinela);
const sentinelaZones = createFourPlayerCardZones({
  p1: [sentinelaDef.defId],
  p2: [targetDef.defId],
  p3: [targetDef.defId],
  p4: [targetDef.defId],
}, 1);
const sentinelaBase: FourPlayerMatchState = { ...createFourPlayerMatchState("p1", undefined, 10), phase: "main_1" };
const stagedSentinelaCard = stageFourPlayerCardCast(
  sentinelaBase,
  sentinelaZones,
  "p1",
  sentinelaZones.p1.hand[0]!.instanceId,
  "e-sentinela-card",
);
const resolvedSentinelaCard = resolveFourPlayerCardCast(stagedSentinelaCard.match, stagedSentinelaCard.stackItem);
const sentinelaSource = resolvedSentinelaCard.match.battlefield?.objects.find((object) => object.kind === "sentinela");
assert.equal(sentinelaSource?.loyalty, sentinelaDef.sentinela!.startingLoyalty);

const sentinelaReady: FourPlayerMatchState = {
  ...resolvedSentinelaCard.match,
  resolution: createFourPlayerMatchState("p1").resolution,
};
const stagedSentinelaAbility = stageFourPlayerActivatedAbility(
  sentinelaReady,
  stagedSentinelaCard.zones,
  "p1",
  sentinelaSource!.id,
  "main",
  0,
  "e-sentinela-ability",
);
assert.equal(
  stagedSentinelaAbility.match.battlefield?.objects.find((object) => object.id === sentinelaSource!.id)?.loyalty,
  sentinelaDef.sentinela!.startingLoyalty + sentinelaDef.sentinela!.abilities[0]!.cost,
);
assert.throws(
  () => stageFourPlayerActivatedAbility(
    stagedSentinelaAbility.match,
    stagedSentinelaAbility.zones,
    "p1",
    sentinelaSource!.id,
    "main",
    1,
    "e-sentinela-second",
    { kind: "battlefield", objectId: "ability-target-p2" },
  ),
  /already activated this round/,
);

// Selected discard costs move exactly the selected physical hand card to graveyard at activation time.
const discardDef = getCard("rfalpha_reanimator_memory_smuggler");
assert.ok(discardDef.activatedAbilities?.[0]?.cost?.discardFromHand === 1);
const discardBody = createFourPlayerCombatBodySnapshot(discardDef);
assert.ok(discardBody);
let discardMatch: FourPlayerMatchState = { ...createFourPlayerMatchState("p1", undefined, 10), phase: "main_1" };
discardMatch = {
  ...discardMatch,
  battlefield: putFourPlayerBattlefieldObject(discardMatch.battlefield!, {
    id: "discard-source",
    defId: discardDef.defId,
    kind: "unit",
    ownerSeat: "p1",
    controllerSeat: "p1",
    enteredTurn: 0,
    keywords: discardDef.keywords ?? [],
    combat: discardBody,
  }),
};
const discardZones = createFourPlayerCardZones({
  p1: [targetDef.defId, targetDef.defId],
  p2: [targetDef.defId],
  p3: [targetDef.defId],
  p4: [targetDef.defId],
}, 1);
const discardedCard = discardZones.p1.hand[0]!;
const stagedDiscard = stageFourPlayerActivatedAbility(
  discardMatch,
  discardZones,
  "p1",
  "discard-source",
  "main",
  0,
  "e-discard-ability",
  undefined,
  undefined,
  undefined,
  [discardedCard.instanceId],
);
assert.equal(stagedDiscard.zones.p1.hand.some((card) => card.instanceId === discardedCard.instanceId), false);
assert.equal(stagedDiscard.zones.p1.graveyard.some((card) => card.instanceId === discardedCard.instanceId), true);

// Reaction activated abilities use the same circular LIFO stack and can negate only the opposing top spell.
const originalReactionAbilities = sourceDef.reactionActivatedAbilities;
const negateAbility: ReactionActivatedAbility = {
  description: "Deny from the battlefield",
  respondsTo: ["spell"],
  cost: { mana: 1 },
  maxUsesPerRound: 1,
  effect: { kind: "negateSpell", amount: 0, target: "spellOnStack" },
};
sourceDef.reactionActivatedAbilities = [negateAbility];
try {
  const pendingSpellDef = collectibleCards().find((card) =>
    card.collectible !== false
    && card.type === "Spell"
    && card.spell
    && !card.customKeywords?.includes("uncounterable")
  );
  assert.ok(pendingSpellDef?.spell, "fixture requires a counterable Spell");

  let reactionMatch: FourPlayerMatchState = { ...createFourPlayerMatchState("p1", undefined, 10), phase: "main_1" };
  reactionMatch = {
    ...reactionMatch,
    battlefield: putFourPlayerBattlefieldObject(reactionMatch.battlefield!, {
      id: "reaction-source-p2",
      defId: sourceDef.defId,
      kind: "unit",
      ownerSeat: "p2",
      controllerSeat: "p2",
      enteredTurn: 0,
      keywords: sourceDef.keywords ?? [],
      combat: sourceBody,
    }),
  };
  const pendingSpell = {
    id: "pending-spell-p1",
    controller: "p1" as const,
    kind: "spell_cast",
    payload: {
      instanceId: "spell-instance-p1",
      defId: pendingSpellDef.defId,
      ownerSeat: "p1" as const,
      cardType: "Spell" as const,
      effect: structuredClone(pendingSpellDef.spell),
    },
  };
  reactionMatch = {
    ...reactionMatch,
    resolution: submitFourPlayerAction(reactionMatch.resolution, pendingSpell),
  };
  assert.equal(reactionMatch.resolution.priority.holder, "p2");

  const reactionOptions = fourPlayerActivatedAbilityOptions(reactionMatch, emptyZones, "p2");
  assert.equal(
    reactionOptions.some((option) =>
      option.sourceId === "reaction-source-p2"
      && option.timing === "reaction"
      && option.stackTargetId === pendingSpell.id
    ),
    true,
  );

  const stagedReaction = stageFourPlayerActivatedAbility(
    reactionMatch,
    emptyZones,
    "p2",
    "reaction-source-p2",
    "reaction",
    0,
    "e-reaction-ability",
    undefined,
    pendingSpell.id,
  );
  assert.equal(stagedReaction.match.seats.p2.mana, reactionMatch.seats.p2.mana - 1);
  let reactionOnStack: FourPlayerMatchState = {
    ...stagedReaction.match,
    resolution: submitFourPlayerAction(stagedReaction.match.resolution, stagedReaction.stackItem),
  };
  reactionOnStack = passAllLiving(reactionOnStack);
  const reactionPump = pumpFourPlayerServer(reactionOnStack);
  assert.equal(reactionPump.resolved[0]?.id, stagedReaction.stackItem.id);
  assert.equal(reactionPump.counteredStackItems?.[0]?.id, pendingSpell.id);
  assert.equal(reactionPump.match.resolution.stack.items.length, 0);
} finally {
  sourceDef.reactionActivatedAbilities = originalReactionAbilities;
}

console.log("FOUR PLAYER ACTIVATED ABILITIES: PASS — main/reaction stack, costs, modes budget, Sentinela loyalty and negate authority");