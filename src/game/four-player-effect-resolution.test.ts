import assert from "node:assert/strict";
import { putFourPlayerBattlefieldObject } from "./four-player-battlefield";
import { resolveFourPlayerEffect } from "./four-player-effect-resolution";
import { createFourPlayerMatchState, FOUR_PLAYER_STARTING_LIFE } from "./four-player-match";
import { assertFourPlayerTargetObject, parseFourPlayerTargetRef } from "./four-player-targeting";

function body(power:number, health:number) {
  return { basePower:power, power, health, maxHealth:health, races:[], classes:[], barrier:false, frostbitten:false };
}

let match = { ...createFourPlayerMatchState("p1"), phase:"main_1" as const };
let battlefield = match.battlefield!;
battlefield = putFourPlayerBattlefieldObject(battlefield,{
  id:"enemy-unit",defId:"enemy-unit",kind:"unit",ownerSeat:"p2",controllerSeat:"p2",enteredTurn:0,combat:body(3,4),
});
battlefield = putFourPlayerBattlefieldObject(battlefield,{
  id:"hexproof-unit",defId:"hexproof-unit",kind:"unit",ownerSeat:"p3",controllerSeat:"p3",enteredTurn:0,keywords:["Hexproof"],combat:body(2,3),
});
battlefield = putFourPlayerBattlefieldObject(battlefield,{
  id:"ally-unit",defId:"ally-unit",kind:"unit",ownerSeat:"p1",controllerSeat:"p1",enteredTurn:0,combat:body(2,2),
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

console.log("FOUR PLAYER TARGETING + EFFECT AUTHORITY: PASS — player/unit targets, Hexproof, damage, chained Nexus, heal, stun, frostbite and kill");
