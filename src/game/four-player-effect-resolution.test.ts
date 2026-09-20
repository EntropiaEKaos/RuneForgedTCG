import assert from "node:assert/strict";
import { CARD_EFFECT_KINDS } from "./card-authoring";
import { putFourPlayerBattlefieldObject } from "./four-player-battlefield";
import { resolveFourPlayerEffect } from "./four-player-effect-resolution";
import { createFourPlayerMatchState, FOUR_PLAYER_POISON_LETHAL, FOUR_PLAYER_STARTING_LIFE } from "./four-player-match";
import { FOUR_PLAYER_SUPPORTED_SPELL_EFFECT_KINDS } from "./four-player-spell-contract";
import { assertFourPlayerTargetObject, parseFourPlayerTargetRef } from "./four-player-targeting";
import type { Race } from "./types";

function body(power:number, health:number, races:Race[]=[], classes:string[]=[]) {
  return { basePower:power, power, health, maxHealth:health, races, classes, barrier:false, frostbitten:false };
}

assert.deepEqual(
  [...FOUR_PLAYER_SUPPORTED_SPELL_EFFECT_KINDS].sort(),
  [...CARD_EFFECT_KINDS].sort(),
  "Commander 4P spell/effect contract must track every authorable CARD_EFFECT_KIND",
);

let match = { ...createFourPlayerMatchState("p1"), phase:"main_1" as const };
let battlefield = match.battlefield!;
battlefield = putFourPlayerBattlefieldObject(battlefield,{
  id:"enemy-unit",defId:"enemy-unit",kind:"unit",ownerSeat:"p2",controllerSeat:"p2",enteredTurn:0,combat:body(3,4),
});
battlefield = putFourPlayerBattlefieldObject(battlefield,{
  id:"hexproof-unit",defId:"hexproof-unit",kind:"unit",ownerSeat:"p3",controllerSeat:"p3",enteredTurn:0,keywords:["Hexproof"],combat:body(2,3),
});
battlefield = putFourPlayerBattlefieldObject(battlefield,{
  id:"ally-unit",defId:"ally-unit",kind:"unit",ownerSeat:"p1",controllerSeat:"p1",enteredTurn:0,combat:body(2,2,["Besta"],["Druid"]),
});
battlefield = putFourPlayerBattlefieldObject(battlefield,{
  id:"ally-other",defId:"ally-other",kind:"unit",ownerSeat:"p1",controllerSeat:"p1",enteredTurn:0,combat:body(1,3,["Spirit"],["Mystic"]),
});
match = {...match,battlefield};

assert.deepEqual(parseFourPlayerTargetRef({kind:"player",seat:"p2"}),{kind:"player",seat:"p2"});
assert.equal(parseFourPlayerTargetRef({kind:"player",seat:"p9"}),undefined);
assert.throws(
  ()=>assertFourPlayerTargetObject(match,"p1",{kind:"battlefield",objectId:"ally-unit"},"enemyUnit"),
  /not an enemy unit/,
);
assert.throws(
  ()=>assertFourPlayerTargetObject(match,"p1",{kind:"battlefield",objectId:"hexproof-unit"},"enemyUnit"),
  /Hexproof/,
);

let resolved = resolveFourPlayerEffect(
  match,
  "p1",
  {kind:"damageUnit",amount:3,target:"enemyUnit",also:{kind:"damageNexus",amount:2,target:"none"}},
  {kind:"battlefield",objectId:"enemy-unit"},
);
assert.equal(resolved.match.battlefield?.objects.find((object)=>object.id==="enemy-unit")?.combat?.health,1);
assert.equal(resolved.match.seats.p2.life,FOUR_PLAYER_STARTING_LIFE-2,"chained Nexus damage follows the targeted enemy unit controller");
assert.equal(resolved.match.seats.p3.life,FOUR_PLAYER_STARTING_LIFE);

resolved = resolveFourPlayerEffect(
  resolved.match,
  "p1",
  {kind:"stun",amount:0,target:"enemyUnit"},
  {kind:"battlefield",objectId:"enemy-unit"},
);
assert.equal(resolved.match.battlefield?.objects.find((object)=>object.id==="enemy-unit")?.stunned,true);

resolved = resolveFourPlayerEffect(
  resolved.match,
  "p1",
  {kind:"frostbite",amount:0,target:"enemyUnit"},
  {kind:"battlefield",objectId:"enemy-unit"},
);
assert.equal(resolved.match.battlefield?.objects.find((object)=>object.id==="enemy-unit")?.combat?.frostbitten,true);

const healed = resolveFourPlayerEffect(
  {...resolved.match,seats:{...resolved.match.seats,p1:{...resolved.match.seats.p1,life:24}}},
  "p1",
  {kind:"healNexus",amount:4,target:"none"},
);
assert.equal(healed.match.seats.p1.life,28);

const killed = resolveFourPlayerEffect(
  healed.match,
  "p1",
  {kind:"killUnit",amount:0,target:"enemyUnit"},
  {kind:"battlefield",objectId:"enemy-unit"},
);
assert.equal(killed.match.battlefield?.objects.some((object)=>object.id==="enemy-unit"),false);
assert.equal(killed.destroyed[0]?.destination,"graveyard");

assert.throws(
  ()=>resolveFourPlayerEffect(match,"p1",{kind:"damageNexus",amount:3,target:"none"}),
  /explicit opponent target/,
);
const nexusHit = resolveFourPlayerEffect(
  match,
  "p1",
  {kind:"damageNexus",amount:3,target:"none"},
  {kind:"player",seat:"p4"},
);
assert.equal(nexusHit.match.seats.p4.life,FOUR_PLAYER_STARTING_LIFE-3);
assert.throws(
  ()=>resolveFourPlayerEffect(match,"p1",{kind:"damageNexus",amount:3,target:"none"},{kind:"player",seat:"p1"}),
  /must target an opponent/,
);

const buffed = resolveFourPlayerEffect(
  match,
  "p1",
  {kind:"buffUnit",amount:0,target:"allyUnit",buffPower:2,buffHealth:3},
  {kind:"battlefield",objectId:"ally-unit"},
);
const buffedBody = buffed.match.battlefield?.objects.find((object)=>object.id==="ally-unit")?.combat;
assert.equal(buffedBody?.power,4);
assert.equal(buffedBody?.health,5);
assert.equal(buffedBody?.maxHealth,5);

const alliesBuffed = resolveFourPlayerEffect(
  match,
  "p1",
  {kind:"buffAllies",amount:0,target:"none",buffPower:1,buffHealth:1},
);
assert.equal(alliesBuffed.match.battlefield?.objects.find((object)=>object.id==="ally-unit")?.combat?.power,3);
assert.equal(alliesBuffed.match.battlefield?.objects.find((object)=>object.id==="ally-other")?.combat?.power,2);
assert.equal(alliesBuffed.match.battlefield?.objects.find((object)=>object.id==="enemy-unit")?.combat?.power,3);

const raceBuffed = resolveFourPlayerEffect(
  match,
  "p1",
  {kind:"buffRace",amount:0,target:"none",race:"Besta",buffPower:2,buffHealth:0},
);
assert.equal(raceBuffed.match.battlefield?.objects.find((object)=>object.id==="ally-unit")?.combat?.power,4);
assert.equal(raceBuffed.match.battlefield?.objects.find((object)=>object.id==="ally-other")?.combat?.power,1);

const classBuffed = resolveFourPlayerEffect(
  match,
  "p1",
  {kind:"buffClass",amount:0,target:"none",classKey:"Druid",buffPower:0,buffHealth:2},
);
assert.equal(classBuffed.match.battlefield?.objects.find((object)=>object.id==="ally-unit")?.combat?.health,4);
assert.equal(classBuffed.match.battlefield?.objects.find((object)=>object.id==="ally-other")?.combat?.health,3);

const manaBase = {...match,seats:{...match.seats,p1:{...match.seats.p1,mana:2,maxMana:5}}};
const manaRefunded = resolveFourPlayerEffect(manaBase,"p1",{kind:"manaRefund",amount:4,target:"none"});
assert.equal(manaRefunded.match.seats.p1.mana,5);

const raceDrawFromAlly = resolveFourPlayerEffect(
  match,
  "p1",
  {kind:"draw",amount:1,target:"none",race:"Besta"},
  undefined,
  {sourceRaces:["Spirit"]},
);
assert.equal(raceDrawFromAlly.draws.p1,1,"race-gated draw accepts a matching controlled ally");

const raceDrawFromSource = resolveFourPlayerEffect(
  match,
  "p1",
  {kind:"draw",amount:1,target:"none",race:"Dragon"},
  undefined,
  {sourceRaces:["Dragon"]},
);
assert.equal(raceDrawFromSource.draws.p1,1,"race-gated draw accepts the matching source itself");

const raceDrawMiss = resolveFourPlayerEffect(
  match,
  "p1",
  {kind:"draw",amount:1,target:"none",race:"Dragon"},
  undefined,
  {sourceRaces:["Spirit"]},
);
assert.equal(raceDrawMiss.draws.p1,undefined,"race-gated draw must not fire without source or ally race match");

const raceRefundMiss = resolveFourPlayerEffect(
  manaBase,
  "p1",
  {kind:"manaRefund",amount:3,target:"none",race:"Besta"},
  undefined,
  {sourceRaces:["Spirit"]},
);
assert.equal(raceRefundMiss.match.seats.p1.mana,2,"source-relative manaRefund must fail closed on a race mismatch");

const raceRefundHit = resolveFourPlayerEffect(
  manaBase,
  "p1",
  {kind:"manaRefund",amount:3,target:"none",race:"Besta"},
  undefined,
  {sourceRaces:["Besta"]},
);
assert.equal(raceRefundHit.match.seats.p1.mana,5,"source-relative manaRefund must resolve on a race match");

const raceRefundWithoutSource = resolveFourPlayerEffect(
  manaBase,
  "p1",
  {kind:"manaRefund",amount:3,target:"none",race:"Besta"},
);
assert.equal(raceRefundWithoutSource.match.seats.p1.mana,5,"source-less manaRefund preserves certified 1v1 fallback semantics");

const barriered = resolveFourPlayerEffect(
  buffed.match,
  "p1",
  {kind:"grantBarrier",amount:0,target:"allyUnit"},
  {kind:"battlefield",objectId:"ally-unit"},
);
const barrierObject = barriered.match.battlefield?.objects.find((object)=>object.id==="ally-unit");
assert.equal(barrierObject?.combat?.barrier,true);
assert.equal(barrierObject?.keywords.includes("Barrier"),true);

const keyworded = resolveFourPlayerEffect(
  barriered.match,
  "p1",
  {kind:"grantKeyword",amount:0,target:"allyUnit",keyword:"Flying"},
  {kind:"battlefield",objectId:"ally-unit"},
);
const keywordObject = keyworded.match.battlefield?.objects.find((object)=>object.id==="ally-unit");
assert.equal(keywordObject?.keywords.filter((keyword)=>keyword==="Flying").length,1);

const aoeBase = {
  ...match,
  battlefield: putFourPlayerBattlefieldObject(match.battlefield!,{
    id:"enemy-p4",defId:"enemy-p4",kind:"unit",ownerSeat:"p4",controllerSeat:"p4",enteredTurn:0,combat:body(1,2),
  }),
};
const aoe = resolveFourPlayerEffect(aoeBase,"p1",{kind:"aoeEnemy",amount:2,target:"none"});
assert.equal(aoe.match.battlefield?.objects.some((object)=>object.id==="enemy-p4"),false);
assert.equal(aoe.match.battlefield?.objects.find((object)=>object.id==="enemy-unit")?.combat?.health,2);
assert.equal(aoe.match.battlefield?.objects.find((object)=>object.id==="ally-unit")?.combat?.health,2);
assert.equal(aoe.match.battlefield?.objects.find((object)=>object.id==="hexproof-unit")?.combat?.health,1,"AoE is non-targeted and bypasses Hexproof");

const poisonBase = {
  ...match,
  seats:{...match.seats,p2:{...match.seats.p2,poisonCounters:FOUR_PLAYER_POISON_LETHAL-1}},
};
const poisoned = resolveFourPlayerEffect(
  poisonBase,
  "p1",
  {kind:"poison",amount:1,target:"none"},
  {kind:"player",seat:"p2"},
);
assert.equal(poisoned.match.seats.p2.poisonCounters,FOUR_PLAYER_POISON_LETHAL);
assert.equal(poisoned.match.seats.p2.eliminated,true);
assert.throws(
  ()=>resolveFourPlayerEffect(match,"p1",{kind:"poison",amount:1,target:"none"}),
  /explicit opponent target/,
);

const drawIntent = resolveFourPlayerEffect(match,"p1",{kind:"draw",amount:2,target:"none"});
assert.equal(drawIntent.draws.p1,2);
assert.equal(drawIntent.match,match,"draw intent must not leak private-zone mutation into public match state");

const summoned = resolveFourPlayerEffect(
  match,
  "p1",
  {kind:"summonToken",amount:2,target:"none",tokenDefId:"forest_cub_token"},
  undefined,
  {tokenNamespace:"stack:test-token"},
);
const tokens = summoned.match.battlefield?.objects.filter((object)=>object.kind==="token") ?? [];
assert.equal(tokens.length,2);
assert.deepEqual(tokens.map((token)=>token.id),[
  "token:p1:stack:test-token:1",
  "token:p1:stack:test-token:2",
]);
assert.ok(tokens.every((token)=>token.defId==="forest_cub_token"&&token.ownerSeat==="p1"&&token.controllerSeat==="p1"));
assert.ok(tokens.every((token)=>token.combat?.power===1&&token.combat?.health===1));

const selfBuffed = resolveFourPlayerEffect(
  match,
  "p1",
  {kind:"buffSelf",amount:0,target:"self",buffPower:2,buffHealth:1},
  undefined,
  {sourceTargetId:"ally-unit"},
);
const selfBuffedBody = selfBuffed.match.battlefield?.objects.find((object)=>object.id==="ally-unit")?.combat;
assert.equal(selfBuffedBody?.power,4);
assert.equal(selfBuffedBody?.health,3);
assert.equal(selfBuffedBody?.maxHealth,3);
assert.equal(
  selfBuffed.match.battlefield?.objects.find((object)=>object.id==="ally-other")?.combat?.power,
  1,
  "buffSelf must not leak to another allied combat body",
);

const inertSelfBuff = resolveFourPlayerEffect(
  match,
  "p1",
  {kind:"buffSelf",amount:0,target:"self",buffPower:2,buffHealth:1},
);
assert.equal(
  inertSelfBuff.match.battlefield?.objects.find((object)=>object.id==="ally-unit")?.combat?.power,
  2,
  "source-less buffSelf preserves the 1v1 inert spell fallback",
);

const uniqueRaceDraw = resolveFourPlayerEffect(match,"p1",{kind:"drawOnSummon",amount:1,target:"none"});
assert.equal(uniqueRaceDraw.draws.p1,2,"drawOnSummon counts unique races among living controlled combat bodies");
assert.deepEqual(uniqueRaceDraw.zoneActions,[{kind:"draw",seat:"p1",amount:2}]);

const filteredRaceDraw = resolveFourPlayerEffect(
  match,
  "p1",
  {kind:"drawOnSummon",amount:2,target:"none",race:"Besta"},
);
assert.equal(filteredRaceDraw.draws.p1,2,"race-filtered drawOnSummon multiplies matching controlled bodies by amount");

const cappedRaceBoard = {
  ...match,
  battlefield: putFourPlayerBattlefieldObject(match.battlefield!,{
    id:"ally-besta-two",defId:"ally-besta-two",kind:"token",ownerSeat:"p1",controllerSeat:"p1",enteredTurn:0,combat:body(1,1,["Besta"]),
  }),
};
const cappedRaceDraw = resolveFourPlayerEffect(
  cappedRaceBoard,
  "p1",
  {kind:"drawOnSummon",amount:3,target:"none",race:"Besta"},
);
assert.equal(cappedRaceDraw.draws.p1,4,"race-filtered drawOnSummon preserves the 1v1 cap of four cards");

console.log("FOUR PLAYER TARGETING + EFFECT AUTHORITY: PASS — player/unit targets, Hexproof, damage, chained Nexus, heal, stun, frostbite and kill");
