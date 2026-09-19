import assert from "node:assert/strict";
import { putFourPlayerBattlefieldObject } from "./four-player-battlefield";
import { createFourPlayerCombatState, declareFourPlayerAttacker, declareFourPlayerBlocker } from "./four-player-combat";
import { resolveFourPlayerCombat } from "./four-player-combat-resolution";
import { createFourPlayerMatchState, FOUR_PLAYER_STARTING_LIFE } from "./four-player-match";

function body(power:number, health:number) {
  return { basePower:power, power, health, maxHealth:health, races:[], classes:[], barrier:false, frostbitten:false };
}

let match = { ...createFourPlayerMatchState("p1"), phase:"combat" as const };
let battlefield = match.battlefield!;
battlefield = putFourPlayerBattlefieldObject(battlefield,{id:"a-direct",defId:"a-direct",kind:"unit",ownerSeat:"p1",enteredTurn:0,combat:body(4,4)});
battlefield = putFourPlayerBattlefieldObject(battlefield,{id:"a-blocked",defId:"a-blocked",kind:"unit",ownerSeat:"p1",enteredTurn:0,combat:body(3,4)});
battlefield = putFourPlayerBattlefieldObject(battlefield,{id:"b-p3",defId:"b-p3",kind:"unit",ownerSeat:"p3",enteredTurn:0,combat:body(2,2)});
let combat = createFourPlayerCombatState("p1");
combat = declareFourPlayerAttacker(combat,"a-direct","p2");
combat = declareFourPlayerAttacker(combat,"a-blocked","p3");
combat = declareFourPlayerBlocker(combat,"p3","b-p3","a-blocked");
match = {...match,battlefield,combat};

const resolved = resolveFourPlayerCombat(match);
assert.equal(resolved.match.seats.p2.life,FOUR_PLAYER_STARTING_LIFE-4);
assert.equal(resolved.match.seats.p3.life,FOUR_PLAYER_STARTING_LIFE);
assert.equal(resolved.match.battlefield?.objects.find((object)=>object.id==="a-blocked")?.combat?.health,2);
assert.equal(resolved.match.battlefield?.objects.some((object)=>object.id==="b-p3"),false);
assert.equal(resolved.destroyed.find((entry)=>entry.id==="b-p3")?.destination,"graveyard");
assert.equal(resolved.match.combat.attackers.length,0);
assert.equal(resolved.match.combat.blockers.length,0);

let tradeMatch = { ...createFourPlayerMatchState("p1"), phase:"combat" as const };
let tradeBoard = tradeMatch.battlefield!;
tradeBoard = putFourPlayerBattlefieldObject(tradeBoard,{id:"trade-a",defId:"trade-a",kind:"unit",ownerSeat:"p1",enteredTurn:0,combat:body(1,1)});
tradeBoard = putFourPlayerBattlefieldObject(tradeBoard,{id:"trade-b",defId:"trade-b",kind:"unit",ownerSeat:"p2",enteredTurn:0,combat:body(1,1)});
let tradeCombat = createFourPlayerCombatState("p1");
tradeCombat = declareFourPlayerAttacker(tradeCombat,"trade-a","p2");
tradeCombat = declareFourPlayerBlocker(tradeCombat,"p2","trade-b","trade-a");
tradeMatch = {...tradeMatch,battlefield:tradeBoard,combat:tradeCombat};
const tradeResolved = resolveFourPlayerCombat(tradeMatch);
assert.equal(tradeResolved.match.battlefield?.objects.some((object)=>object.id==="trade-a"),false);
assert.equal(tradeResolved.match.battlefield?.objects.some((object)=>object.id==="trade-b"),false);
assert.equal(tradeResolved.destroyed.filter((entry)=>entry.id==="trade-a"||entry.id==="trade-b").length,2);

let keywordMatch = { ...createFourPlayerMatchState("p1"), phase:"combat" as const };
let keywordBoard = keywordMatch.battlefield!;
keywordBoard = putFourPlayerBattlefieldObject(keywordBoard,{
  id:"poison-life",defId:"poison-life",kind:"unit",ownerSeat:"p1",enteredTurn:0,
  keywords:["Poisonous","Lifesteal","DoubleStrike"],combat:body(2,3),
});
let keywordCombat = createFourPlayerCombatState("p1");
keywordCombat = declareFourPlayerAttacker(keywordCombat,"poison-life","p4");
keywordMatch = {
  ...keywordMatch,
  seats:{...keywordMatch.seats,p1:{...keywordMatch.seats.p1,life:25}},
  battlefield:keywordBoard,
  combat:keywordCombat,
};
const keywordResolved = resolveFourPlayerCombat(keywordMatch);
assert.equal(keywordResolved.match.seats.p4.life,FOUR_PLAYER_STARTING_LIFE-4);
assert.equal(keywordResolved.match.seats.p4.poisonCounters,4);
assert.equal(keywordResolved.match.seats.p1.life,29);

let generalMatch = { ...createFourPlayerMatchState("p1"), phase:"combat" as const };
generalMatch = {
  ...generalMatch,
  generals:{...generalMatch.generals,p1:{...generalMatch.generals.p1,location:"battlefield"}},
};
let generalBoard = generalMatch.battlefield!;
generalBoard = putFourPlayerBattlefieldObject(generalBoard,{
  id:"general:p1:1",defId:"general-p1",kind:"general",ownerSeat:"p1",enteredTurn:0,combat:body(3,2),
});
generalBoard = putFourPlayerBattlefieldObject(generalBoard,{
  id:"big-blocker",defId:"big-blocker",kind:"unit",ownerSeat:"p2",enteredTurn:0,combat:body(5,5),
});
let generalCombat = createFourPlayerCombatState("p1");
generalCombat = declareFourPlayerAttacker(generalCombat,"general:p1:1","p2");
generalCombat = declareFourPlayerBlocker(generalCombat,"p2","big-blocker","general:p1:1");
generalMatch = {...generalMatch,battlefield:generalBoard,combat:generalCombat};
const generalResolved = resolveFourPlayerCombat(generalMatch);
assert.equal(generalResolved.match.generals.p1.location,"general_zone");
assert.equal(generalResolved.match.battlefield?.objects.some((object)=>object.id==="general:p1:1"),false);
assert.equal(generalResolved.destroyed.find((entry)=>entry.id==="general:p1:1")?.destination,"general_zone");

console.log("FOUR PLAYER COMBAT RESOLUTION: PASS — split Nexus damage, blockers, graveyard destinations, poison/lifesteal and General return");
