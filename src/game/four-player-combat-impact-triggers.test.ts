import assert from "node:assert/strict";
import { putFourPlayerBattlefieldObject } from "./four-player-battlefield";
import { createFourPlayerCombatBodySnapshot } from "./four-player-combat-body";
import { createFourPlayerCombatState, declareFourPlayerAttacker, declareFourPlayerBlocker } from "./four-player-combat";
import { clearRegisteredCustomCards, registerCustomCards } from "./custom-registry";
import { passFourPlayerFlow } from "./four-player-flow";
import { createFourPlayerMatchState, type FourPlayerMatchState } from "./four-player-match";
import { pumpFourPlayerServer } from "./four-player-server-pump";
import type { CardDef } from "./types";

function passAll(match: FourPlayerMatchState): FourPlayerMatchState {
  let next=match;
  const living=4-next.turn.eliminatedSeats.length;
  for(let i=0;i<living;i+=1) next={...next,resolution:passFourPlayerFlow(next.resolution)};
  return next;
}

const defs:CardDef[]=[
  {
    defId:"four_player_striker",name:"Double Striker",region:"Tidecall",type:"Unit",cost:1,power:2,health:4,
    rarity:"Common",description:"Double Strike. Strike: heal 1.",emoji:"S",keywords:["DoubleStrike"],
    trigger:{when:"onStrike",effect:{kind:"healNexus",amount:1,target:"none"}},
  },
  {
    defId:"four_player_nexus_striker",name:"Nexus Striker",region:"Emberhold",type:"Unit",cost:1,power:2,health:4,
    rarity:"Common",description:"Nexus Strike: deal 1 to enemies.",emoji:"N",
    trigger:{when:"onNexusStrike",effect:{kind:"aoeEnemy",amount:1,target:"none"}},
  },
  {
    defId:"four_player_killer",name:"Quick Killer",region:"Voidborn",type:"Unit",cost:1,power:4,health:4,
    rarity:"Common",description:"Quick Attack. Kill: draw 1.",emoji:"K",keywords:["QuickAttack"],
    trigger:{when:"onKill",effect:{kind:"draw",amount:1,target:"none"}},
  },
  {
    defId:"four_player_victim",name:"Victim",region:"Ironwood",type:"Unit",cost:1,power:1,health:2,
    rarity:"Common",description:"Victim.",emoji:"V",
  },
  {
    defId:"four_player_enemy_one",name:"Enemy One",region:"Ironwood",type:"Unit",cost:1,power:1,health:1,
    rarity:"Common",description:"AOE victim.",emoji:"E",
  },
];
registerCustomCards(defs);

try{
  const body=(id:string)=>createFourPlayerCombatBodySnapshot(defs.find((card)=>card.defId===id)!)!;

  // Double Strike opens two distinct onStrike windows and applies the Nexus hit
  // before each trigger resolves.
  let doubleMatch:FourPlayerMatchState={...createFourPlayerMatchState("p1"),phase:"combat"};
  doubleMatch={...doubleMatch,seats:{...doubleMatch.seats,p1:{...doubleMatch.seats.p1,life:20}}};
  let doubleBoard=doubleMatch.battlefield!;
  doubleBoard=putFourPlayerBattlefieldObject(doubleBoard,{
    id:"double-source",defId:"four_player_striker",kind:"unit",ownerSeat:"p1",controllerSeat:"p1",enteredTurn:0,
    keywords:["DoubleStrike"],combat:body("four_player_striker"),
  });
  let doubleCombat=createFourPlayerCombatState("p1");
  doubleCombat=declareFourPlayerAttacker(doubleCombat,"double-source","p2");
  doubleMatch={...doubleMatch,battlefield:doubleBoard,combat:doubleCombat};

  const firstImpact=pumpFourPlayerServer(passAll(doubleMatch));
  assert.equal(firstImpact.combatResolved,false);
  assert.equal(firstImpact.match.seats.p2.life,28);
  assert.equal(firstImpact.match.seats.p1.life,20);
  assert.equal((firstImpact.match.resolution.stack.items.at(-1)?.payload as {when?:string})?.when,"onStrike");

  const firstTrigger=pumpFourPlayerServer(passAll(firstImpact.match));
  assert.equal(firstTrigger.match.seats.p1.life,21);
  const secondImpact=pumpFourPlayerServer(passAll(firstTrigger.match));
  assert.equal(secondImpact.combatResolved,false);
  assert.equal(secondImpact.match.seats.p2.life,26);
  assert.equal((secondImpact.match.resolution.stack.items.at(-1)?.payload as {when?:string})?.when,"onStrike");
  const secondTrigger=pumpFourPlayerServer(passAll(secondImpact.match));
  assert.equal(secondTrigger.match.seats.p1.life,22);

  // Nexus Strike is separate from ordinary Strike and may produce secondary
  // authoritative deaths through its effect resolver.
  let nexusMatch:FourPlayerMatchState={...createFourPlayerMatchState("p1"),phase:"combat"};
  let nexusBoard=nexusMatch.battlefield!;
  nexusBoard=putFourPlayerBattlefieldObject(nexusBoard,{
    id:"nexus-source",defId:"four_player_nexus_striker",kind:"unit",ownerSeat:"p1",controllerSeat:"p1",enteredTurn:0,
    combat:body("four_player_nexus_striker"),
  });
  nexusBoard=putFourPlayerBattlefieldObject(nexusBoard,{
    id:"aoe-victim",defId:"four_player_enemy_one",kind:"unit",ownerSeat:"p3",controllerSeat:"p3",enteredTurn:0,
    combat:body("four_player_enemy_one"),
  });
  let nexusCombat=createFourPlayerCombatState("p1");
  nexusCombat=declareFourPlayerAttacker(nexusCombat,"nexus-source","p2");
  nexusMatch={...nexusMatch,battlefield:nexusBoard,combat:nexusCombat};
  const nexusImpact=pumpFourPlayerServer(passAll(nexusMatch));
  assert.equal(nexusImpact.match.seats.p2.life,28);
  assert.equal((nexusImpact.match.resolution.stack.items.at(-1)?.payload as {when?:string})?.when,"onNexusStrike");
  const nexusTrigger=pumpFourPlayerServer(passAll(nexusImpact.match));
  assert.equal(nexusTrigger.match.battlefield?.objects.some((object)=>object.id==="aoe-victim"),false);

  // Quick Attack kills before counterstrike; onKill is derived from the lethal
  // combat record during casualty cleanup, never from arbitrary spell damage.
  let killMatch:FourPlayerMatchState={...createFourPlayerMatchState("p1"),phase:"combat"};
  let killBoard=killMatch.battlefield!;
  killBoard=putFourPlayerBattlefieldObject(killBoard,{
    id:"killer",defId:"four_player_killer",kind:"unit",ownerSeat:"p1",controllerSeat:"p1",enteredTurn:0,
    keywords:["QuickAttack"],combat:body("four_player_killer"),
  });
  killBoard=putFourPlayerBattlefieldObject(killBoard,{
    id:"victim",defId:"four_player_victim",kind:"unit",ownerSeat:"p2",controllerSeat:"p2",enteredTurn:0,
    combat:body("four_player_victim"),
  });
  let killCombat=createFourPlayerCombatState("p1");
  killCombat=declareFourPlayerAttacker(killCombat,"killer","p2");
  killCombat=declareFourPlayerBlocker(killCombat,"p2","victim","killer");
  killMatch={...killMatch,battlefield:killBoard,combat:killCombat};
  const killCleanup=pumpFourPlayerServer(passAll(killMatch));
  assert.equal(killCleanup.combatResolved,true);
  assert.equal(killCleanup.match.battlefield?.objects.some((object)=>object.id==="victim"),false);
  assert.equal(killCleanup.match.battlefield?.objects.find((object)=>object.id==="killer")?.combat?.health,4,"Quick Attack victim must not counterstrike");
  assert.equal((killCleanup.match.resolution.stack.items.at(-1)?.payload as {when?:string})?.when,"onKill");
  const killTrigger=pumpFourPlayerServer(passAll(killCleanup.match));
  assert.equal(killTrigger.drawRequests?.p1,1);

  // Normal combat remains simultaneous: both bodies deal damage before any
  // impact trigger window can alter the exchange.
  let trade:FourPlayerMatchState={...createFourPlayerMatchState("p1"),phase:"combat"};
  let tradeBoard=trade.battlefield!;
  tradeBoard=putFourPlayerBattlefieldObject(tradeBoard,{
    id:"trade-a",defId:"four_player_killer",kind:"unit",ownerSeat:"p1",controllerSeat:"p1",enteredTurn:0,
    keywords:[],combat:{...body("four_player_killer"),power:2,basePower:2,health:2,maxHealth:2},
  });
  tradeBoard=putFourPlayerBattlefieldObject(tradeBoard,{
    id:"trade-b",defId:"four_player_victim",kind:"unit",ownerSeat:"p2",controllerSeat:"p2",enteredTurn:0,
    combat:{...body("four_player_victim"),power:2,basePower:2,health:2,maxHealth:2},
  });
  let tradeCombat=createFourPlayerCombatState("p1");
  tradeCombat=declareFourPlayerAttacker(tradeCombat,"trade-a","p2");
  tradeCombat=declareFourPlayerBlocker(tradeCombat,"p2","trade-b","trade-a");
  trade={...trade,battlefield:tradeBoard,combat:tradeCombat};
  const tradePump=pumpFourPlayerServer(passAll(trade));
  assert.equal(tradePump.combatResolved,true);
  assert.equal(tradePump.match.battlefield?.objects.some((object)=>object.id==="trade-a"),false);
  assert.equal(tradePump.match.battlefield?.objects.some((object)=>object.id==="trade-b"),false);
}finally{
  clearRegisteredCustomCards();
}

console.log("FOUR PLAYER COMBAT IMPACT TRIGGERS: PASS — Strike, Nexus Strike, Kill, Double Strike, Quick Attack and simultaneous exchange");
