import { createCustomGame, resolveCombat, canPlayCard, canDeclareAttack, playUnit, castSpell, spellNeedsTarget, declareAttack, endTurn, canBlock } from "@/game/engine";
import { aiChooseAction, aiChooseSentinelaAction, applyAiAction, aiResolveTurnEnd } from "@/game/ai";
import { getCard } from "@/game/cards";
import { getDeck } from "@/game/decks";
import type { DeckInput, GameState } from "@/game/types";
import { ENGINE_VERSION, RULESET_VERSION } from "@/game/version";

export type SimulationSummary = {
  deckA: string;
  deckB: string;
  requestedGames: number;
  completedGames: number;
  winsA: number;
  winsB: number;
  draws: number;
  avgRounds: number;
  winRateA: number;
  winRateB: number;
  firstPlayerWins: number;
  secondPlayerWins: number;
  firstPlayerWinRate: number;
  winRateA95: { low: number; high: number };
  seed: number;
  engineVersion: string;
  rulesetVersion: string;
  roundDistribution: { min: number; max: number; median: number };
};

function wilson95(wins: number, total: number): { low: number; high: number } {
  if (!total) return { low: 0, high: 0 };
  const z = 1.96, p = wins / total, z2 = z * z;
  const center = (p + z2 / (2 * total)) / (1 + z2 / total);
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total) / (1 + z2 / total);
  return { low: Math.round(Math.max(0, center - margin) * 1000) / 10, high: Math.round(Math.min(1, center + margin) * 1000) / 10 };
}

function deck(id: string, overrides?: Record<string, DeckInput>): DeckInput {
  if (overrides?.[id]) return { ...overrides[id], cards: [...overrides[id].cards] };
  const d = getDeck(id);
  return { id: d.id, name: d.name, cards: d.cards };
}

function chooseBlocksSymmetric(state: GameState): Record<string,string> {
  if(!state.combat)return {}; const attacker=state.combat.attackerId; const defender=attacker==="player"?"ai":"player";
  const attackers=state.players[attacker].bench.filter(u=>u.isAttacking&&!state.combat!.locked.includes(u.instanceId));
  const blockers=state.players[defender].bench.slice(); const used=new Set<string>(); const blocks:Record<string,string>={...state.combat.blocks};
  for(const atk of [...attackers].sort((a,b)=>b.power-a.power)){const candidates=blockers.filter(b=>!used.has(b.instanceId)&&canBlock(atk,b)); const choice=candidates.sort((a,b)=>((b.power>=atk.health?1:0)-(a.power>=atk.health?1:0))||b.health-a.health)[0]; if(choice){blocks[atk.instanceId]=choice.instanceId;used.add(choice.instanceId);}}
  return blocks;
}

function playOneForPlayer(state: GameState): GameState {
  const sentinelAction = aiChooseSentinelaAction(state, "player");
  if (sentinelAction) return applyAiAction(state, sentinelAction, "player");
  const p=state.players.player;
  const playable=p.hand.filter(c=>canPlayCard(state,"player",c.instanceId)).sort((a,b)=>getCard(b.defId).cost-getCard(a.defId).cost);
  for(const c of playable){
    const def=getCard(c.defId); let next=state;
    if(def.type==="Unit"||def.type==="Enchantment"||def.type==="Artifact"||def.type==="Sentinela") next=playUnit(state,"player",c.instanceId);
    else if(def.type==="Equipment"){const t=[...p.bench].filter(u=>u.equipment.length<2).sort((a,b)=>b.power-a.power)[0]; if(!t)continue; next=playUnit(state,"player",c.instanceId,t.instanceId);}
    else if(def.type==="Spell"){
      const needs=spellNeedsTarget(c.defId);
      if(!needs||needs==="none"||needs==="self"||needs==="spellOnStack") next=castSpell(state,"player",c.instanceId);
      else if(needs==="enemyUnit"||needs==="anyUnit"){const t=state.players.ai.bench.slice().sort((a,b)=>b.power-a.power)[0];if(!t)continue;next=castSpell(state,"player",c.instanceId,t.instanceId);}
      else if(needs==="allyUnit"){const t=p.bench.slice().sort((a,b)=>b.power-a.power)[0];if(!t)continue;next=castSpell(state,"player",c.instanceId,t.instanceId);}
    }
    if(next!==state)return next;
  }
  if(canDeclareAttack(state,"player")){const ids=p.bench.filter(u=>!u.stunned&&!u.summonedThisTurn).map(u=>u.instanceId);if(ids.length)return declareAttack(state,"player",ids,{});}
  return endTurn(state,"player");
}

export function runBalanceSimulation(deckAId: string, deckBId: string, games: number, seed: number, overrides?: Record<string, DeckInput>): SimulationSummary {
  const count=Math.min(Math.max(Math.floor(games),1),5000);const rounds:number[]=[];let winsA=0,winsB=0,draws=0,firstPlayerWins=0,secondPlayerWins=0;
  for(let i=0;i<count;i++){
    const matchSeed=(seed+i*7919)&0x7fffffff;const aIsPlayer=i%2===0;
    const playerGoesFirst=Math.floor(i/2)%2===0; const a=deck(deckAId, overrides), b=deck(deckBId, overrides);
    const playerDeck=aIsPlayer?a:b, opponentDeck=aIsPlayer?b:a;
    let state:GameState=createCustomGame("Balance",playerDeck,opponentDeck,{seed:matchSeed,playerGoesFirst,skipMulligan:true});
    let guard=0;
    while(state.phase!=="gameover"&&guard++<800){
      if(state.phase==="blocking"){state=resolveCombat(state,chooseBlocksSymmetric(state));continue;}
      if(state.activePlayer==="ai"&&state.phase==="main"){const action=aiChooseAction(state);state=action?applyAiAction(state,action):aiResolveTurnEnd(state);}
      else if(state.activePlayer==="player"&&state.phase==="main"){state=playOneForPlayer(state);}
    }
    // Alternate which deck occupies the human-side heuristic so that policy asymmetry is averaged out.
    if(state.winner==="player"){if(aIsPlayer)winsA++;else winsB++;}
    else if(state.winner==="ai"){if(aIsPlayer)winsB++;else winsA++;}
    else draws++;
    if(state.winner){const firstWon=(state.winner==="player"&&playerGoesFirst)||(state.winner==="ai"&&!playerGoesFirst);if(firstWon)firstPlayerWins++;else secondPlayerWins++;}
    rounds.push(state.round);
  }
  const sorted=[...rounds].sort((a,b)=>a-b),average=rounds.reduce((a,b)=>a+b,0)/Math.max(rounds.length,1);
  const decisive=Math.max(winsA+winsB,1), firstDecisive=Math.max(firstPlayerWins+secondPlayerWins,1);
  return {deckA:deckAId,deckB:deckBId,requestedGames:count,completedGames:rounds.length,winsA,winsB,draws,avgRounds:Math.round(average),winRateA:Math.round(winsA/decisive*1000)/10,winRateB:Math.round(winsB/decisive*1000)/10,firstPlayerWins,secondPlayerWins,firstPlayerWinRate:Math.round(firstPlayerWins/firstDecisive*1000)/10,winRateA95:wilson95(winsA,decisive),seed,engineVersion:ENGINE_VERSION,rulesetVersion:RULESET_VERSION,roundDistribution:{min:sorted[0]??0,max:sorted.at(-1)??0,median:sorted[Math.floor(sorted.length/2)]??0}};
}
