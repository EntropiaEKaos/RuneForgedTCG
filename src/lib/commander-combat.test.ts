import assert from "node:assert/strict";
import { putFourPlayerBattlefieldObject } from "../game/four-player-battlefield";
import { collectibleCards } from "../game/cards";
import { canFourPlayerCounterStackItem } from "../game/four-player-reactions";
import {
  COMMANDER_PRIORITY_ACTIVE_WINDOW_MS,
  COMMANDER_PRIORITY_REACTION_WINDOW_MS,
  type CommanderCombatEnvelope,
  commanderCombatPersistence,
  commanderPriorityDeadlineAt,
  commanderPriorityExpired,
  createCommanderCombatEnvelope,
  processCommanderCombatCommand,
  processCommanderPriorityTimeout,
  projectCommanderCombatState,
} from "./commander-combat";

async function main() {
  const generals = collectibleCards()
    .filter((card) => card.collectible !== false && (card.isChampion || card.isLegend))
    .slice(0, 4);
  assert.equal(generals.length, 4, "fixture requires four collectible Champion/Legend cards");

  const pool = collectibleCards().filter((card) => card.collectible !== false).slice(0, 24);
  assert.ok(pool.length >= 20, "fixture requires a broad collectible pool");
  const playable = collectibleCards().find((card) =>
    card.collectible !== false
    && ["Unit", "Enchantment", "Artifact", "Sentinela"].includes(card.type)
    && card.cost <= 10,
  );
  assert.ok(playable, "fixture requires a stageable physical card");

  const seats = generals.map((general, index) => ({
    seat: index as 0 | 1 | 2 | 3,
    playerId: 100 + index,
    playerName: `Commander P${index + 1}`,
    deckCards: Array.from({ length: 60 }, () => playable.defId),
    generalDefId: general.defId,
  }));

  const initial = await createCommanderCombatEnvelope("commander:test-room", 5, 0x12345678, seats);
  assert.equal(initial.protocol.revision, 5);
  assert.equal(initial.match.turn.activeSeat, "p1");
  assert.equal(initial.zones.p1.hand.length, 5);
  assert.equal(initial.zones.p1.deck.length, 55);
  assert.equal(initial.match.battlefield?.objects.length, 0);

  const activeClockBase = 1_000_000;
  assert.equal(
    commanderPriorityDeadlineAt(initial, activeClockBase),
    activeClockBase + COMMANDER_PRIORITY_ACTIVE_WINDOW_MS,
    "active-seat priority receives the longer action window",
  );
  assert.equal(commanderPriorityExpired(initial, activeClockBase, activeClockBase + COMMANDER_PRIORITY_ACTIVE_WINDOW_MS - 1), false);
  assert.equal(commanderPriorityExpired(initial, activeClockBase, activeClockBase + COMMANDER_PRIORITY_ACTIVE_WINDOW_MS), true);
  assert.throws(
    () => processCommanderPriorityTimeout(initial, activeClockBase, activeClockBase + COMMANDER_PRIORITY_ACTIVE_WINDOW_MS - 1),
    /deadline has not expired/,
    "server timeout must fail closed before the authoritative deadline",
  );
  const activeTimedOut = processCommanderPriorityTimeout(
    initial,
    activeClockBase,
    activeClockBase + COMMANDER_PRIORITY_ACTIVE_WINDOW_MS,
  );
  assert.equal(activeTimedOut.protocol.revision, 6);
  assert.equal(activeTimedOut.match.resolution.priority.holder, "p2");
  assert.equal(activeTimedOut.match.resolution.priority.consecutivePasses, 1);

  const p1 = projectCommanderCombatState(initial, 0);
  assert.equal(p1.revision, 5);
  assert.equal(p1.viewerSeat, 0);
  assert.equal(p1.seats[0].hand?.length, 5, "viewer receives own hand identities");
  assert.match(p1.seats[0].hand?.[0]?.instanceId ?? "", /^p1:card:\d+$/);
  assert.ok(p1.seats[0].hand?.[0]?.defId);
  assert.equal(p1.seats[1].hand, undefined, "viewer must not receive opponent hand identities");
  assert.equal("deck" in p1.seats[0], false, "future deck identities must never be projected");

  const playableEnvelope = {
    ...initial,
    match: {
      ...initial.match,
      phase: "main_1" as const,
      seats: {
        ...initial.match.seats,
        p1: { ...initial.match.seats.p1, mana: 10, maxMana: 10 },
      },
    },
  };
  const cardInstance = playableEnvelope.zones.p1.hand[0]!;
  assert.throws(
    () => processCommanderCombatCommand(playableEnvelope, 100, 0, {
      commandId: "cmd-play-forged",
      expectedRevision: 5,
      type: "play_card",
      payload: { instanceId: "p1:card:9999" },
    }),
    /is not in p1's hand/,
    "server must reject forged card instance ids",
  );
  const played = processCommanderCombatCommand(playableEnvelope, 100, 0, {
    commandId: "cmd-play-1",
    expectedRevision: 5,
    type: "play_card",
    payload: { instanceId: cardInstance.instanceId, defId: "__ignored-client-def__", cost: 0 },
  });
  assert.equal(played.protocol.revision, 6);
  assert.equal(played.zones.p1.hand.length, 4);
  assert.equal(played.zones.p1.hand.some((card) => card.instanceId === cardInstance.instanceId), false);
  assert.equal(played.match.resolution.stack.items.at(-1)?.kind, "card_cast");
  assert.equal(
    (played.match.resolution.stack.items.at(-1)?.payload as { defId?: string })?.defId,
    playable.defId,
    "server must derive defId from the authoritative hand instance",
  );
  assert.equal(played.match.seats.p1.mana, 10 - playable.cost);
  assert.equal(played.match.resolution.priority.holder, "p2");

  const burn = collectibleCards().find((card) =>
    card.collectible !== false && card.type === "Spell" && card.cost <= 10 && card.spell?.kind === "damageNexus" && !(card.customKeywords ?? []).includes("uncounterable")
  );
  assert.ok(burn, "fixture requires a direct damage Spell");
  const spellSeats = generals.map((general, index) => ({
    seat: index as 0 | 1 | 2 | 3,
    playerId: 100 + index,
    playerName: `Commander Spell P${index + 1}`,
    deckCards: Array.from({ length: 60 }, () => burn.defId),
    generalDefId: general.defId,
  }));
  const spellInitial = await createCommanderCombatEnvelope("commander:spell-room", 20, 0x87654321, spellSeats);
  const spellEnvelope = {
    ...spellInitial,
    match: {
      ...spellInitial.match,
      phase: "main_1" as const,
      seats: { ...spellInitial.match.seats, p1: { ...spellInitial.match.seats.p1, mana: 10, maxMana: 10 } },
    },
  };
  const spellInstance = spellEnvelope.zones.p1.hand[0]!;
  let spellPlayed = processCommanderCombatCommand(spellEnvelope, 100, 0, {
    commandId: "cmd-spell-play",
    expectedRevision: 20,
    type: "play_card",
    payload: { instanceId: spellInstance.instanceId, target: { kind:"player", seat:"p2" }, effect:{kind:"killUnit"} },
  });
  assert.equal(spellPlayed.match.resolution.stack.items.at(-1)?.kind,"spell_cast");
  assert.equal(spellPlayed.zones.p1.hand.some((card)=>card.instanceId===spellInstance.instanceId),false);
  spellPlayed = processCommanderCombatCommand(spellPlayed, 101, 1, { commandId:"cmd-spell-pass-p2", expectedRevision:21, type:"pass_priority" });
  spellPlayed = processCommanderCombatCommand(spellPlayed, 102, 2, { commandId:"cmd-spell-pass-p3", expectedRevision:22, type:"pass_priority" });
  spellPlayed = processCommanderCombatCommand(spellPlayed, 103, 3, { commandId:"cmd-spell-pass-p4", expectedRevision:23, type:"pass_priority" });
  spellPlayed = processCommanderCombatCommand(spellPlayed, 100, 0, { commandId:"cmd-spell-pass-p1", expectedRevision:24, type:"pass_priority" });
  assert.equal(spellPlayed.match.seats.p2.life, 30 - burn.spell!.amount);
  assert.equal(spellPlayed.zones.p1.graveyard.some((card)=>card.instanceId===spellInstance.instanceId),true);
  assert.equal(spellPlayed.match.resolution.stack.items.length,0);

  const counter = collectibleCards().find((card) =>
    card.collectible !== false
    && card.type === "Spell"
    && card.speed === "Burst"
    && card.cost <= 10
    && card.spell?.kind === "negateSpell"
    && canFourPlayerCounterStackItem(card, {
      id: "fixture-pending-spell",
      controller: "p1",
      kind: "spell_cast",
      payload: { defId: burn.defId, cardType: "Spell" },
    }),
  );
  assert.ok(counter, "fixture requires a compatible Burst negateSpell");
  const reactionSeats = generals.map((general, index) => ({
    seat: index as 0 | 1 | 2 | 3,
    playerId: 100 + index,
    playerName: `Commander Reaction P${index + 1}`,
    deckCards: Array.from({ length: 60 }, () => index === 1 ? counter.defId : burn.defId),
    generalDefId: general.defId,
  }));
  const reactionInitial = await createCommanderCombatEnvelope("commander:reaction-room", 50, 0x31415926, reactionSeats);
  let reactionEnvelope: CommanderCombatEnvelope = {
    ...reactionInitial,
    match: {
      ...reactionInitial.match,
      phase: "main_1" as const,
      seats: {
        ...reactionInitial.match.seats,
        p1: { ...reactionInitial.match.seats.p1, mana: 10, maxMana: 10 },
        p2: { ...reactionInitial.match.seats.p2, mana: 10, maxMana: 10 },
      },
    },
  };
  const reactionBurn = reactionEnvelope.zones.p1.hand[0]!;
  reactionEnvelope = processCommanderCombatCommand(reactionEnvelope, 100, 0, {
    commandId: "cmd-reaction-burn",
    expectedRevision: 50,
    type: "play_card",
    payload: { instanceId: reactionBurn.instanceId, target: { kind: "player", seat: "p2" } },
  });
  const pendingId = reactionEnvelope.match.resolution.stack.items.at(-1)!.id;
  const p2ReactionProjection = projectCommanderCombatState(reactionEnvelope, 1);
  assert.equal(p2ReactionProjection.stack.length, 1);
  assert.equal(p2ReactionProjection.stack[0]?.actionKind, "spell");
  assert.equal(p2ReactionProjection.stack[0]?.defId, burn.defId);
  assert.equal(p2ReactionProjection.prioritySeat, 1);
  const reactionClockBase = 2_000_000;
  assert.equal(
    commanderPriorityDeadlineAt(reactionEnvelope, reactionClockBase),
    reactionClockBase + COMMANDER_PRIORITY_REACTION_WINDOW_MS,
    "open stack priority receives the shorter reaction window",
  );
  const reactionTimedOut = processCommanderPriorityTimeout(
    reactionEnvelope,
    reactionClockBase,
    reactionClockBase + COMMANDER_PRIORITY_REACTION_WINDOW_MS,
  );
  assert.equal(reactionTimedOut.protocol.revision, 52);
  assert.equal(reactionTimedOut.match.resolution.priority.holder, "p3");
  assert.equal(reactionTimedOut.match.resolution.stack.items.length, 1, "one timeout passes priority without skipping unresolved stack order");

  const reactionCounter = reactionEnvelope.zones.p2.hand[0]!;
  reactionEnvelope = processCommanderCombatCommand(reactionEnvelope, 101, 1, {
    commandId: "cmd-reaction-counter",
    expectedRevision: 51,
    type: "play_card",
    payload: { instanceId: reactionCounter.instanceId, stackTargetId: pendingId },
  });
  assert.equal(reactionEnvelope.match.resolution.stack.items.length, 2);
  assert.equal(reactionEnvelope.match.resolution.priority.holder, "p3");

  reactionEnvelope = processCommanderCombatCommand(reactionEnvelope, 102, 2, { commandId: "cmd-reaction-pass-p3", expectedRevision: 52, type: "pass_priority" });
  reactionEnvelope = processCommanderCombatCommand(reactionEnvelope, 103, 3, { commandId: "cmd-reaction-pass-p4", expectedRevision: 53, type: "pass_priority" });
  reactionEnvelope = processCommanderCombatCommand(reactionEnvelope, 100, 0, { commandId: "cmd-reaction-pass-p1", expectedRevision: 54, type: "pass_priority" });
  reactionEnvelope = processCommanderCombatCommand(reactionEnvelope, 101, 1, { commandId: "cmd-reaction-pass-p2", expectedRevision: 55, type: "pass_priority" });

  assert.equal(reactionEnvelope.protocol.revision, 56);
  assert.equal(reactionEnvelope.match.seats.p2.life, 30, "countered burn must not damage the target");
  assert.equal(reactionEnvelope.match.resolution.stack.items.length, 0, "counter resolution must consume the target stack object");
  assert.equal(reactionEnvelope.zones.p1.graveyard.some((card) => card.instanceId === reactionBurn.instanceId), true, "countered spell goes to owner graveyard");
  assert.equal(reactionEnvelope.zones.p2.graveyard.some((card) => card.instanceId === reactionCounter.instanceId), true, "resolved counter goes to owner graveyard");

  // Counter-the-counter: P3 answers P2's counter, so the original P1 spell survives and resolves later.
  const counterChainSeats = generals.map((general, index) => ({
    seat: index as 0 | 1 | 2 | 3,
    playerId: 100 + index,
    playerName: `Commander Counter Chain P${index + 1}`,
    deckCards: Array.from({ length: 60 }, () => index === 1 || index === 2 ? counter.defId : burn.defId),
    generalDefId: general.defId,
  }));
  const chainInitial = await createCommanderCombatEnvelope("commander:counter-chain-room", 60, 0x27182818, counterChainSeats);
  let chainEnvelope: CommanderCombatEnvelope = {
    ...chainInitial,
    match: {
      ...chainInitial.match,
      phase: "main_1" as const,
      seats: {
        ...chainInitial.match.seats,
        p1: { ...chainInitial.match.seats.p1, mana: 10, maxMana: 10 },
        p2: { ...chainInitial.match.seats.p2, mana: 10, maxMana: 10 },
        p3: { ...chainInitial.match.seats.p3, mana: 10, maxMana: 10 },
      },
    },
  };
  const chainBurn = chainEnvelope.zones.p1.hand[0]!;
  chainEnvelope = processCommanderCombatCommand(chainEnvelope, 100, 0, {
    commandId: "cmd-chain-burn", expectedRevision: 60, type: "play_card",
    payload: { instanceId: chainBurn.instanceId, target: { kind: "player", seat: "p2" } },
  });
  const chainBurnStackId = chainEnvelope.match.resolution.stack.items.at(-1)!.id;
  const p2Counter = chainEnvelope.zones.p2.hand[0]!;
  chainEnvelope = processCommanderCombatCommand(chainEnvelope, 101, 1, {
    commandId: "cmd-chain-counter-p2", expectedRevision: 61, type: "play_card",
    payload: { instanceId: p2Counter.instanceId, stackTargetId: chainBurnStackId },
  });
  const p2CounterStackId = chainEnvelope.match.resolution.stack.items.at(-1)!.id;
  const p3Counter = chainEnvelope.zones.p3.hand[0]!;
  chainEnvelope = processCommanderCombatCommand(chainEnvelope, 102, 2, {
    commandId: "cmd-chain-counter-p3", expectedRevision: 62, type: "play_card",
    payload: { instanceId: p3Counter.instanceId, stackTargetId: p2CounterStackId },
  });
  assert.equal(chainEnvelope.match.resolution.stack.items.length, 3, "three objects must coexist before the counter-chain pass cycle");

  chainEnvelope = processCommanderCombatCommand(chainEnvelope, 103, 3, { commandId: "cmd-chain-pass-p4-a", expectedRevision: 63, type: "pass_priority" });
  chainEnvelope = processCommanderCombatCommand(chainEnvelope, 100, 0, { commandId: "cmd-chain-pass-p1-a", expectedRevision: 64, type: "pass_priority" });
  chainEnvelope = processCommanderCombatCommand(chainEnvelope, 101, 1, { commandId: "cmd-chain-pass-p2-a", expectedRevision: 65, type: "pass_priority" });
  chainEnvelope = processCommanderCombatCommand(chainEnvelope, 102, 2, { commandId: "cmd-chain-pass-p3-a", expectedRevision: 66, type: "pass_priority" });

  assert.equal(chainEnvelope.protocol.revision, 67);
  assert.equal(chainEnvelope.match.resolution.stack.items.length, 1, "counter-of-counter must remove P2 counter and leave the original spell");
  assert.equal(chainEnvelope.match.resolution.stack.items[0]?.id, chainBurnStackId);
  assert.equal(chainEnvelope.zones.p2.graveyard.some((card) => card.instanceId === p2Counter.instanceId), true, "countered counter goes to its owner's graveyard");
  assert.equal(chainEnvelope.zones.p3.graveyard.some((card) => card.instanceId === p3Counter.instanceId), true, "counter-of-counter resolves to its owner's graveyard");
  assert.equal(chainEnvelope.match.seats.p2.life, 30, "original burn remains pending after counter-of-counter resolves");

  chainEnvelope = processCommanderCombatCommand(chainEnvelope, 100, 0, { commandId: "cmd-chain-pass-p1-b", expectedRevision: 67, type: "pass_priority" });
  chainEnvelope = processCommanderCombatCommand(chainEnvelope, 101, 1, { commandId: "cmd-chain-pass-p2-b", expectedRevision: 68, type: "pass_priority" });
  chainEnvelope = processCommanderCombatCommand(chainEnvelope, 102, 2, { commandId: "cmd-chain-pass-p3-b", expectedRevision: 69, type: "pass_priority" });
  chainEnvelope = processCommanderCombatCommand(chainEnvelope, 103, 3, { commandId: "cmd-chain-pass-p4-b", expectedRevision: 70, type: "pass_priority" });

  assert.equal(chainEnvelope.protocol.revision, 71);
  assert.equal(chainEnvelope.match.resolution.stack.items.length, 0);
  assert.equal(chainEnvelope.match.seats.p2.life, 30 - burn.spell!.amount, "original spell resolves after its counter is itself countered");
  assert.equal(chainEnvelope.zones.p1.graveyard.some((card) => card.instanceId === chainBurn.instanceId), true);

  const recallSpell = collectibleCards().find((card) =>
    card.collectible !== false
    && card.type === "Spell"
    && card.cost <= 10
    && (card.speed === "Fast" || card.speed === "Burst")
    && card.spell?.kind === "recall",
  );
  const recallTargetDef = collectibleCards().find((card) => card.collectible !== false && card.type === "Unit");
  assert.ok(recallSpell, "fixture requires a Fast/Burst recall spell");
  assert.ok(recallTargetDef, "fixture requires a recallable Unit");
  const recallSeats = generals.map((general, index) => ({
    seat: index as 0 | 1 | 2 | 3,
    playerId: 100 + index,
    playerName: `Commander Recall P${index + 1}`,
    deckCards: Array.from({ length: 60 }, () => index === 0 ? recallSpell.defId : recallTargetDef.defId),
    generalDefId: general.defId,
  }));
  const recallInitial = await createCommanderCombatEnvelope("commander:recall-room", 80, 0x13572468, recallSeats);
  const recalledCard = recallInitial.zones.p2.hand[0]!;
  let recallEnvelope: CommanderCombatEnvelope = {
    ...recallInitial,
    zones: {
      ...recallInitial.zones,
      p2: { ...recallInitial.zones.p2, hand: recallInitial.zones.p2.hand.slice(1) },
    },
    match: {
      ...recallInitial.match,
      phase: "main_1" as const,
      seats: {
        ...recallInitial.match.seats,
        p1: { ...recallInitial.match.seats.p1, mana: 10, maxMana: 10 },
      },
      battlefield: putFourPlayerBattlefieldObject(recallInitial.match.battlefield!, {
        id: recalledCard.instanceId,
        defId: recalledCard.defId,
        kind: "unit",
        ownerSeat: "p2",
        controllerSeat: "p2",
        enteredTurn: 0,
      }),
    },
  };
  const recallCaster = recallEnvelope.zones.p1.hand[0]!;
  recallEnvelope = processCommanderCombatCommand(recallEnvelope, 100, 0, {
    commandId: "cmd-recall-cast",
    expectedRevision: 80,
    type: "play_card",
    payload: { instanceId: recallCaster.instanceId, target: { kind: "battlefield", objectId: recalledCard.instanceId } },
  });
  recallEnvelope = processCommanderCombatCommand(recallEnvelope, 101, 1, { commandId: "cmd-recall-pass-p2", expectedRevision: 81, type: "pass_priority" });
  recallEnvelope = processCommanderCombatCommand(recallEnvelope, 102, 2, { commandId: "cmd-recall-pass-p3", expectedRevision: 82, type: "pass_priority" });
  recallEnvelope = processCommanderCombatCommand(recallEnvelope, 103, 3, { commandId: "cmd-recall-pass-p4", expectedRevision: 83, type: "pass_priority" });
  recallEnvelope = processCommanderCombatCommand(recallEnvelope, 100, 0, { commandId: "cmd-recall-pass-p1", expectedRevision: 84, type: "pass_priority" });
  assert.equal(recallEnvelope.protocol.revision, 85);
  assert.equal(recallEnvelope.match.battlefield?.objects.some((object) => object.id === recalledCard.instanceId), false);
  assert.equal(recallEnvelope.zones.p2.hand.some((card) => card.instanceId === recalledCard.instanceId), true, "recalled unit must return to its owner's hand");

  const millSpell = collectibleCards().find((card) =>
    card.collectible !== false
    && card.type === "Spell"
    && card.cost <= 10
    && (card.speed === "Fast" || card.speed === "Burst")
    && card.spell?.kind === "mill",
  );
  assert.ok(millSpell, "fixture requires a Fast/Burst mill spell");
  const millSeats = generals.map((general, index) => ({
    seat: index as 0 | 1 | 2 | 3,
    playerId: 100 + index,
    playerName: `Commander Mill P${index + 1}`,
    deckCards: Array.from({ length: 60 }, () => index === 0 ? millSpell.defId : recallTargetDef.defId),
    generalDefId: general.defId,
  }));
  const millInitial = await createCommanderCombatEnvelope("commander:mill-room", 90, 0x24681357, millSeats);
  let millEnvelope: CommanderCombatEnvelope = {
    ...millInitial,
    match: {
      ...millInitial.match,
      phase: "main_1" as const,
      seats: {
        ...millInitial.match.seats,
        p1: { ...millInitial.match.seats.p1, mana: 10, maxMana: 10 },
      },
    },
  };
  const millCaster = millEnvelope.zones.p1.hand[0]!;
  const p2DeckBeforeMill = millEnvelope.zones.p2.deck.length;
  millEnvelope = processCommanderCombatCommand(millEnvelope, 100, 0, {
    commandId: "cmd-mill-cast",
    expectedRevision: 90,
    type: "play_card",
    payload: { instanceId: millCaster.instanceId, target: { kind: "player", seat: "p2" } },
  });
  millEnvelope = processCommanderCombatCommand(millEnvelope, 101, 1, { commandId: "cmd-mill-pass-p2", expectedRevision: 91, type: "pass_priority" });
  millEnvelope = processCommanderCombatCommand(millEnvelope, 102, 2, { commandId: "cmd-mill-pass-p3", expectedRevision: 92, type: "pass_priority" });
  millEnvelope = processCommanderCombatCommand(millEnvelope, 103, 3, { commandId: "cmd-mill-pass-p4", expectedRevision: 93, type: "pass_priority" });
  millEnvelope = processCommanderCombatCommand(millEnvelope, 100, 0, { commandId: "cmd-mill-pass-p1", expectedRevision: 94, type: "pass_priority" });
  assert.equal(millEnvelope.protocol.revision, 95);
  assert.equal(millEnvelope.zones.p2.deck.length, p2DeckBeforeMill - millSpell.spell!.amount);
  assert.equal(millEnvelope.zones.p2.graveyard.length, millSpell.spell!.amount);

  const drawSpell = collectibleCards().find((card)=>card.defId==="tide_draw");
  assert.ok(drawSpell?.spell?.kind==="draw","fixture requires tide_draw");
  const drawSeats = generals.map((general,index)=>({
    seat:index as 0|1|2|3,
    playerId:100+index,
    playerName:`Commander Draw P${index+1}`,
    deckCards:Array.from({length:60},()=>drawSpell.defId),
    generalDefId:general.defId,
  }));
  const drawInitial = await createCommanderCombatEnvelope("commander:draw-room",30,0x44556677,drawSeats);
  let drawEnvelope: CommanderCombatEnvelope = {
    ...drawInitial,
    match:{...drawInitial.match,phase:"main_1" as const,seats:{...drawInitial.match.seats,p1:{...drawInitial.match.seats.p1,mana:10,maxMana:10}}},
  };
  const drawInstance = drawEnvelope.zones.p1.hand[0]!;
  drawEnvelope = processCommanderCombatCommand(drawEnvelope,100,0,{commandId:"cmd-draw-play",expectedRevision:30,type:"play_card",payload:{instanceId:drawInstance.instanceId}});
  drawEnvelope = processCommanderCombatCommand(drawEnvelope,101,1,{commandId:"cmd-draw-p2",expectedRevision:31,type:"pass_priority"});
  drawEnvelope = processCommanderCombatCommand(drawEnvelope,102,2,{commandId:"cmd-draw-p3",expectedRevision:32,type:"pass_priority"});
  drawEnvelope = processCommanderCombatCommand(drawEnvelope,103,3,{commandId:"cmd-draw-p4",expectedRevision:33,type:"pass_priority"});
  drawEnvelope = processCommanderCombatCommand(drawEnvelope,100,0,{commandId:"cmd-draw-p1",expectedRevision:34,type:"pass_priority"});
  assert.equal(drawEnvelope.zones.p1.hand.length,4+drawSpell.spell.amount);
  assert.equal(drawEnvelope.zones.p1.deck.length,55-drawSpell.spell.amount);
  assert.equal(drawEnvelope.zones.p1.graveyard.some((card)=>card.instanceId===drawInstance.instanceId),true);

  const tokenSpell = collectibleCards().find((card)=>card.defId==="forest_summon_pack");
  assert.ok(tokenSpell?.spell?.kind==="summonToken","fixture requires forest_summon_pack");
  const tokenSeats = generals.map((general,index)=>({
    seat:index as 0|1|2|3,
    playerId:100+index,
    playerName:`Commander Token P${index+1}`,
    deckCards:Array.from({length:60},()=>tokenSpell.defId),
    generalDefId:general.defId,
  }));
  const tokenInitial = await createCommanderCombatEnvelope("commander:token-room",40,0x55667788,tokenSeats);
  let tokenEnvelope: CommanderCombatEnvelope = {
    ...tokenInitial,
    match:{...tokenInitial.match,phase:"main_1" as const,seats:{...tokenInitial.match.seats,p1:{...tokenInitial.match.seats.p1,mana:10,maxMana:10}}},
  };
  const tokenInstance = tokenEnvelope.zones.p1.hand[0]!;
  tokenEnvelope = processCommanderCombatCommand(tokenEnvelope,100,0,{commandId:"cmd-token-play",expectedRevision:40,type:"play_card",payload:{instanceId:tokenInstance.instanceId}});
  tokenEnvelope = processCommanderCombatCommand(tokenEnvelope,101,1,{commandId:"cmd-token-p2",expectedRevision:41,type:"pass_priority"});
  tokenEnvelope = processCommanderCombatCommand(tokenEnvelope,102,2,{commandId:"cmd-token-p3",expectedRevision:42,type:"pass_priority"});
  tokenEnvelope = processCommanderCombatCommand(tokenEnvelope,103,3,{commandId:"cmd-token-p4",expectedRevision:43,type:"pass_priority"});
  tokenEnvelope = processCommanderCombatCommand(tokenEnvelope,100,0,{commandId:"cmd-token-p1",expectedRevision:44,type:"pass_priority"});
  const summonedTokens = tokenEnvelope.match.battlefield?.objects.filter((object)=>object.kind==="token"&&object.ownerSeat==="p1") ?? [];
  assert.equal(summonedTokens.length,2);
  assert.ok(summonedTokens.every((token)=>token.defId==="forest_cub_token"));
  assert.equal(new Set(summonedTokens.map((token)=>token.id)).size,2);
  assert.equal(tokenEnvelope.zones.p1.graveyard.some((card)=>card.instanceId===tokenInstance.instanceId),true);

  let combatBoard = putFourPlayerBattlefieldObject(initial.match.battlefield!, {
    id: "battle:p1:attacker",
    defId: "fixture-attacker",
    kind: "unit",
    ownerSeat: "p1",
    enteredTurn: 0,
    combat: { basePower:3, power:3, health:4, maxHealth:4, races:[], classes:[], barrier:false, frostbitten:false },
  });
  combatBoard = putFourPlayerBattlefieldObject(combatBoard, {
    id: "battle:p2:blocker",
    defId: "fixture-blocker",
    kind: "unit",
    ownerSeat: "p2",
    enteredTurn: 0,
    combat: { basePower:2, power:2, health:2, maxHealth:2, races:[], classes:[], barrier:false, frostbitten:false },
  });
  const combatEnvelope = { ...initial, match: { ...initial.match, phase: "combat" as const, battlefield: combatBoard } };
  assert.throws(
    () => processCommanderCombatCommand(combatEnvelope, 100, 0, {
      commandId: "cmd-forged-attacker",
      expectedRevision: 5,
      type: "declare_attacker",
      payload: { unitId: "forged-client-id", defendingSeat: 1 },
    }),
    /is not present/,
    "attack declarations must reject forged battlefield ids",
  );
  const attacked = processCommanderCombatCommand(combatEnvelope, 100, 0, {
    commandId: "cmd-attack-p2",
    expectedRevision: 5,
    type: "declare_attacker",
    payload: { unitId: "battle:p1:attacker", defendingSeat: 1, controller: "forged" },
  });
  assert.equal(attacked.protocol.revision, 6);
  assert.equal(attacked.match.combat.attackers[0]?.defendingSeat, "p2");
  assert.equal(attacked.match.battlefield?.objects.find((object) => object.id === "battle:p1:attacker")?.attackedThisTurn, true);

  const attackPassed = processCommanderCombatCommand(attacked, 100, 0, {
    commandId: "cmd-pass-after-attack",
    expectedRevision: 6,
    type: "pass_priority",
  });
  const blocked = processCommanderCombatCommand(attackPassed, 101, 1, {
    commandId: "cmd-block",
    expectedRevision: 7,
    type: "declare_blocker",
    payload: { unitId: "battle:p2:blocker", attackerId: "battle:p1:attacker", controller: "forged" },
  });
  assert.equal(blocked.protocol.revision, 8);
  assert.equal(blocked.match.combat.blockers[0]?.controller, "p2");

  const p2Passed = processCommanderCombatCommand(blocked, 101, 1, {
    commandId: "cmd-p2-pass-combat",
    expectedRevision: 8,
    type: "pass_priority",
  });
  const p3Passed = processCommanderCombatCommand(p2Passed, 102, 2, {
    commandId: "cmd-p3-pass-combat",
    expectedRevision: 9,
    type: "pass_priority",
  });
  const combatResolved = processCommanderCombatCommand(p3Passed, 103, 3, {
    commandId: "cmd-p4-pass-combat",
    expectedRevision: 10,
    type: "pass_priority",
  });
  assert.equal(combatResolved.protocol.revision, 11);
  assert.equal(combatResolved.match.phase, "main_2");
  assert.equal(combatResolved.match.battlefield?.objects.find((object) => object.id === "battle:p1:attacker")?.combat?.health, 2);
  assert.equal(combatResolved.match.battlefield?.objects.some((object) => object.id === "battle:p2:blocker"), false);
  assert.equal(combatResolved.zones.p2.graveyard.some((card) => card.instanceId === "battle:p2:blocker"), true);

  const passed = processCommanderCombatCommand(initial, 100, 0, {
    commandId: "cmd-pass-1",
    expectedRevision: 5,
    type: "pass_priority",
  });
  assert.equal(passed.protocol.revision, 6);
  assert.equal(passed.match.resolution.priority.holder, "p2");

  assert.throws(
    () => processCommanderCombatCommand(passed, 100, 0, {
      commandId: "cmd-stale",
      expectedRevision: 5,
      type: "pass_priority",
    }),
    /Expected Commander revision 6/,
    "stale room revisions must fail closed",
  );

  const conceded = processCommanderCombatCommand(passed, 101, 1, {
    commandId: "cmd-concede-p2",
    expectedRevision: 6,
    type: "concede",
  });
  assert.equal(conceded.protocol.revision, 7);
  assert.equal(conceded.match.seats.p2.eliminated, true);

  const persisted = commanderCombatPersistence(conceded);
  assert.equal(persisted.version, 7);
  assert.equal(persisted.state, "playing");
  assert.equal(persisted.gameState.kind, "commander_4p_combat_v1");

  console.log("COMMANDER 4P COMBAT BRIDGE: PASS — projection privacy + revision CAS + authoritative command reduction");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
