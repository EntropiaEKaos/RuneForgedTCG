import assert from "node:assert/strict";
import { putFourPlayerBattlefieldObject } from "./four-player-battlefield";
import { createFourPlayerCombatBodySnapshot } from "./four-player-combat-body";
import { createFourPlayerCombatState, declareFourPlayerAttacker, declareFourPlayerBlocker, markFourPlayerCombatDeclarationTriggersQueued } from "./four-player-combat";
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

const defs: CardDef[]=[
  {
    defId:"four_player_attack_trigger",
    name:"Attack Trigger",
    region:"Emberhold",
    type:"Unit",
    cost:1,
    power:4,
    health:4,
    rarity:"Common",
    description:"Attack: draw 1.",
    emoji:"A",
    trigger:{when:"onAttack",effect:{kind:"draw",amount:1,target:"none"}},
  },
  {
    defId:"four_player_block_trigger",
    name:"Block Trigger",
    region:"Tidecall",
    type:"Unit",
    cost:1,
    power:1,
    health:5,
    rarity:"Common",
    description:"Block: Frostbite an enemy.",
    emoji:"B",
    trigger:{when:"onBlock",effect:{kind:"frostbite",amount:0,target:"enemyUnit"}},
  },
  {
    defId:"four_player_plain_attacker",
    name:"Plain Attacker",
    region:"Emberhold",
    type:"Unit",
    cost:1,
    power:4,
    health:4,
    rarity:"Common",
    description:"Plain attacker.",
    emoji:"P",
  },
];
registerCustomCards(defs);
try {
  const body=(id:string)=>createFourPlayerCombatBodySnapshot(defs.find((card)=>card.defId===id)!)!;

  // Attack trigger is queued after declarations/all-pass and before combat damage.
  let attackMatch:FourPlayerMatchState={...createFourPlayerMatchState("p1"),phase:"combat"};
  let attackBoard=attackMatch.battlefield!;
  attackBoard=putFourPlayerBattlefieldObject(attackBoard,{
    id:"attack-source",defId:"four_player_attack_trigger",kind:"unit",ownerSeat:"p1",controllerSeat:"p1",enteredTurn:0,combat:body("four_player_attack_trigger"),
  });
  let attackCombat=createFourPlayerCombatState("p1");
  attackCombat=declareFourPlayerAttacker(attackCombat,"attack-source","p2");
  attackMatch={...attackMatch,battlefield:attackBoard,combat:attackCombat};
  const declarationPump=pumpFourPlayerServer(passAll(attackMatch));
  assert.equal(declarationPump.combatResolved,false);
  assert.equal(declarationPump.match.seats.p2.life,30,"combat damage must wait behind attack triggers");
  assert.equal(declarationPump.match.combat.declarationTriggersQueued,true);
  assert.equal(declarationPump.match.resolution.stack.items.at(-1)?.kind,"triggered_ability");
  assert.equal((declarationPump.match.resolution.stack.items.at(-1)?.payload as {when?:string})?.when,"onAttack");

  const attackTriggerPump=pumpFourPlayerServer(passAll(declarationPump.match));
  assert.equal(attackTriggerPump.drawRequests?.p1,1);
  assert.equal(attackTriggerPump.match.seats.p2.life,30);
  const attackDamagePump=pumpFourPlayerServer(passAll(attackTriggerPump.match));
  assert.equal(attackDamagePump.combatResolved,true);
  assert.equal(attackDamagePump.match.seats.p2.life,26);

  // Block trigger resolves before the first strike, so Frostbite changes combat damage.
  let blockMatch:FourPlayerMatchState={...createFourPlayerMatchState("p1"),phase:"combat"};
  let blockBoard=blockMatch.battlefield!;
  blockBoard=putFourPlayerBattlefieldObject(blockBoard,{
    id:"plain-attacker",defId:"four_player_plain_attacker",kind:"unit",ownerSeat:"p1",controllerSeat:"p1",enteredTurn:0,combat:body("four_player_plain_attacker"),
  });
  blockBoard=putFourPlayerBattlefieldObject(blockBoard,{
    id:"frost-blocker",defId:"four_player_block_trigger",kind:"unit",ownerSeat:"p2",controllerSeat:"p2",enteredTurn:0,combat:body("four_player_block_trigger"),
  });
  let blockCombat=createFourPlayerCombatState("p1");
  blockCombat=declareFourPlayerAttacker(blockCombat,"plain-attacker","p2");
  blockCombat=declareFourPlayerBlocker(blockCombat,"p2","frost-blocker","plain-attacker");
  blockMatch={...blockMatch,battlefield:blockBoard,combat:blockCombat};

  const blockDeclarationPump=pumpFourPlayerServer(passAll(blockMatch));
  assert.equal((blockDeclarationPump.match.resolution.stack.items.at(-1)?.payload as {when?:string})?.when,"onBlock");
  const blockTriggerPump=pumpFourPlayerServer(passAll(blockDeclarationPump.match));
  assert.equal(blockTriggerPump.match.battlefield?.objects.find((object)=>object.id==="plain-attacker")?.combat?.frostbitten,true);
  const blockDamagePump=pumpFourPlayerServer(passAll(blockTriggerPump.match));
  assert.equal(blockDamagePump.combatResolved,true);
  assert.equal(blockDamagePump.match.battlefield?.objects.find((object)=>object.id==="frost-blocker")?.combat?.health,5,"Frostbitten attacker deals zero");
  assert.equal(blockDamagePump.match.battlefield?.objects.find((object)=>object.id==="plain-attacker")?.combat?.health,3,"blocker still strikes back");

  // Any new declaration after a trigger window reopens declaration-trigger staging.
  let reset=createFourPlayerCombatState("p1");
  reset=declareFourPlayerAttacker(reset,"a1","p2");
  reset=markFourPlayerCombatDeclarationTriggersQueued(reset);
  assert.equal(reset.declarationTriggersQueued,true);
  reset=declareFourPlayerAttacker(reset,"a2","p3");
  assert.equal(reset.declarationTriggersQueued,false);
  reset=markFourPlayerCombatDeclarationTriggersQueued(reset);
  reset=declareFourPlayerBlocker(reset,"p2","b1","a1");
  assert.equal(reset.declarationTriggersQueued,false);
} finally {
  clearRegisteredCustomCards();
}

console.log("FOUR PLAYER COMBAT DECLARATION TRIGGERS: PASS — attack/block stack before damage and declaration reset");
