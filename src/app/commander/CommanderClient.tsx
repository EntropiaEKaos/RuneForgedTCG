"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { isFourPlayerSpellChainSupported } from "@/game/four-player-spell-contract";

type SpellEffect = { kind:string; target:string; also?:SpellEffect };
type CollectionCard = {
  defId:string; name:string; region:string; rarity:string; owned:number;
  cost?:number; type?:string; speed?:string; spell?:SpellEffect; customKeywords?:string[]; archetypeKey?:string;
  isChampion?:boolean; isLegend?:boolean; collectible?:boolean;
};
type Seat = { seat:number; playerId:number; playerName:string; generalDefId:string; ready:boolean; isHost:boolean; cardCount:number };
type ProjectedCard = { instanceId:string; defId:string };
type CombatBody = { power:number; health:number; maxHealth:number; barrier:boolean; frostbitten:boolean };
type BattlefieldObject = {
  id:string; defId:string; kind:string; ownerSeat:string; controllerSeat:string; enteredTurn:number;
  keywords:string[]; combat?:CombatBody; durability?:{health:number;maxHealth:number};
  equipment:{instanceId:string;defId:string;ownerSeat:string;physical:boolean;buffPower:number;buffHealth:number;keywords:string[]}[];
  loyalty?:number; sentinelaActivatedRound?:number; exhaustedRound?:number;
  stunned:boolean; attackedThisTurn:boolean;
};
type CombatSeat = {
  seat:number; handCount:number; deckCount:number; graveyard:ProjectedCard[]; publicBoard:string[];
  nexusHealth:number; eliminated:boolean; life?:number; mana?:number; maxMana?:number; spellMana?:number; poisonCounters?:number;
  battlefield?:BattlefieldObject[]; hand?:ProjectedCard[];
  general:{defId:string;zone:string;castCount:number};
};
type ProjectedStackItem = {id:string;kind:string;actionKind:string|null;controllerSeat:number;defId:string|null;cardType:string|null;speed:string|null;sourceId?:string|null;abilityDescription?:string|null;abilityTiming?:string|null;uncounterable:boolean};
type AbilityOption = {
  sourceId:string; sourceDefId:string; sourceKind:string; abilityIndex:number; timing:"main"|"reaction"; description:string;
  modeId?:string; modeDescription?:string; targetKind:string; manaCost:number; spellManaCost:number; nexusHealthCost:number; discardCount:number;
  exhaustSelf:boolean; consumeBarrier:boolean; sacrificeSelf:boolean; loyaltyDelta?:number; maxUsesPerRound?:number|null;
  respondsTo?:string[]; stackTargetId?:string;
};
type CombatState = {
  kind:string; engineVersion:number; revision:number; viewerSeat:number; activeSeat:number; prioritySeat:number;
  round:number; turn:number; phase:string; status:string; winnerSeat:number|null; seats:CombatSeat[];
  stack:ProjectedStackItem[];
  abilities:AbilityOption[];
  combat:{attackers:{unitId:string;controllerSeat:number;defendingSeat:number}[];blockers:{unitId:string;controllerSeat:number;attackerId:string}[]};
};
type Room = { code:string; state:string; activeSeat:number; round:number; version:number; viewerSeat:number|null; hostPlayerId:number; seats:Seat[]; rules:any; gameState:any; combat?:CombatState|null; engineKind?:string|null };
type LobbySummary = { code:string; state:string; seatCount:number; viewerJoined:boolean };

const COUNT = 60;
const COUNTER_FILTERS = {unit:"counter_unit",spell:"counter_spell",sentinela:"counter_sentinela"} as const;
const UNIT_TARGETS = new Set(["enemyUnit","allyUnit","anyUnit"]);
const PERMANENT_TARGETS = new Set(["enemyPermanent","allyPermanent","anyPermanent"]);
const SENTINELA_TARGETS = new Set(["enemySentinela","allySentinela","anySentinela"]);
const GRAVEYARD_TARGETS = new Set(["allyGraveyardCard","enemyGraveyardCard","anyGraveyardCard","allyGraveyardUnit"]);
function countOf(cards:string[], defId:string){ return cards.filter((id)=>id===defId).length; }
function cardCanUseSpellMana(card:CollectionCard|undefined){
  if(!card||card.archetypeKey==="structure")return false;
  return card.type!=="Unit"&&card.type!=="Sentinela";
}
function legalCounterTargets(card:CollectionCard,items:ProjectedStackItem[]){
  if(card.spell?.kind!=="negateSpell")return items;
  const authored=new Set(card.customKeywords||[]);
  const filtered=(Object.keys(COUNTER_FILTERS) as (keyof typeof COUNTER_FILTERS)[]).filter(kind=>authored.has(COUNTER_FILTERS[kind]));
  const allowed=new Set<string>(filtered.length?filtered:["unit","spell","sentinela"]);
  return items.filter(item=>Boolean(item.actionKind&&!item.uncounterable&&allowed.has(item.actionKind)));
}
function phaseLabel(phase:string){
  return ({beginning:"INÍCIO",main_1:"PRINCIPAL I",combat:"COMBATE",main_2:"PRINCIPAL II",ending:"ENCERRAMENTO"} as Record<string,string>)[phase]||phase.toUpperCase();
}

export default function CommanderClient(){
  const [collection,setCollection]=useState<CollectionCard[]>([]);
  const [deck,setDeck]=useState<string[]>([]);
  const [general,setGeneral]=useState("");
  const [rooms,setRooms]=useState<LobbySummary[]>([]);
  const [room,setRoom]=useState<Room|null>(null);
  const [joinCode,setJoinCode]=useState("");
  const [pendingSpellInstanceId,setPendingSpellInstanceId]=useState<string|null>(null);
  const [pendingAbility,setPendingAbility]=useState<AbilityOption|null>(null);
  const [abilityDiscardIds,setAbilityDiscardIds]=useState<string[]>([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");

  const loadCollection=useCallback(async()=>{
    const response=await fetch("/api/collection",{cache:"no-store",credentials:"include"});
    const data=await response.json();
    if(!response.ok||!data.ok) throw new Error(data.error||"Falha ao carregar coleção");
    setCollection((data.collection||[]).filter((card:CollectionCard)=>card.collectible!==false&&card.owned>0));
  },[]);
  const loadRooms=useCallback(async()=>{
    const response=await fetch("/api/commander",{cache:"no-store",credentials:"include"});
    const data=await response.json();
    if(response.ok&&data.ok) setRooms(data.rooms||[]);
  },[]);
  const loadRoom=useCallback(async(code:string)=>{
    if(!code)return;
    const response=await fetch(`/api/commander/${code}`,{cache:"no-store",credentials:"include"});
    const data=await response.json();
    if(response.ok&&data.ok)setRoom(data.room);
  },[]);

  useEffect(()=>{const id=window.setTimeout(()=>{void Promise.all([loadCollection(),loadRooms()]).catch((e)=>console.error("[commander] initial load failed",e));},0);return()=>window.clearTimeout(id);},[loadCollection,loadRooms]);
  useEffect(()=>{if(!room)return;const id=window.setInterval(()=>void loadRoom(room.code),3000);return()=>window.clearInterval(id)},[room,loadRoom]);

  const generals=useMemo(()=>collection.filter(card=>(card.isChampion||card.isLegend)&&card.owned>countOf(deck,card.defId)),[collection,deck]);
  const selectedGeneral=collection.find(card=>card.defId===general);
  const eligible=useMemo(()=>collection.filter(card=>card.defId!==general),[collection,general]);

  function add(defId:string){
    if(deck.length>=COUNT)return;
    const card=collection.find(item=>item.defId===defId); if(!card)return;
    const used=countOf(deck,defId)+(general===defId?1:0);
    if(used>=Math.min(3,card.owned))return;
    setDeck(current=>[...current,defId]);
  }
  function remove(defId:string){setDeck(current=>{const index=current.lastIndexOf(defId);if(index<0)return current;return current.filter((_,i)=>i!==index)});}
  async function mutate(url:string,body:Record<string,unknown>){
    setBusy(true);setError("");
    try{
      const response=await fetch(url,{method:"POST",credentials:"include",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
      const data=await response.json();
      if(!response.ok||!data.ok)throw new Error(data.error||"Falha no Commander");
      if(data.room)setRoom(data.room);
      if(data.code){setJoinCode(data.code);await loadRoom(data.code);}
      await loadRooms();
    }catch(e){setError(e instanceof Error?e.message:"Falha no Commander")}finally{setBusy(false)}
  }
  async function combatCommand(commandType:"pass_priority"|"cast_general"|"play_card"|"activate_ability"|"declare_attacker"|"declare_blocker"|"end_turn"|"concede",payload:Record<string,unknown>={}) {
    if(!room?.combat)return;
    await mutate(`/api/commander/${room.code}`,{
      action:"combat-command",
      commandType,
      expectedRevision:room.combat.revision,
      commandId:crypto.randomUUID(),
      payload,
    });
  }
  const loadout={deckCards:deck,generalDefId:general};
  const canSubmit=deck.length===COUNT&&Boolean(general)&&!busy;
  const combat=room?.combat??null;
  const viewerRuntime=combat?.seats.find(seat=>seat.seat===room?.viewerSeat);
  const viewerHasPriority=Boolean(combat&&room?.viewerSeat!=null&&combat.prioritySeat===room.viewerSeat&&combat.status==="active");
  const viewerIsActive=Boolean(combat&&room?.viewerSeat!=null&&combat.activeSeat===room.viewerSeat&&combat.status==="active");
  const viewerAlive=Boolean(viewerRuntime&&!viewerRuntime.eliminated&&combat?.status==="active");
  const isMainPhase=Boolean(combat?.phase==="main_1"||combat?.phase==="main_2");
  const stackItems=combat?.stack||[];
  const stackTop=stackItems[stackItems.length-1];
  const canCastGeneral=Boolean(viewerHasPriority&&viewerIsActive&&isMainPhase&&stackItems.length===0&&viewerRuntime?.general.zone==="general_zone");
  const canPlayPhysicalCard=Boolean(viewerHasPriority&&viewerIsActive&&isMainPhase&&viewerAlive&&stackItems.length===0);
  const inCombat=Boolean(combat?.phase==="combat");
  const battlefieldObjects=combat?.seats.flatMap(seat=>seat.battlefield||[])||[];
  const assignedAttackerIds=new Set(combat?.combat.attackers.map(attacker=>attacker.unitId)||[]);
  const assignedBlockerIds=new Set(combat?.combat.blockers.map(blocker=>blocker.unitId)||[]);
  const blockedAttackerIds=new Set(combat?.combat.blockers.map(blocker=>blocker.attackerId)||[]);
  const attackable=(viewerRuntime?.battlefield||[]).filter(object=>
    ["unit","general","token"].includes(object.kind)
    && Boolean(object.combat&&object.combat.health>0)
    && !object.stunned
    && !object.attackedThisTurn
    && !assignedAttackerIds.has(object.id)
    && (object.enteredTurn<(combat?.turn??0)||object.keywords.includes("Haste"))
  );
  const incomingAttackers=(combat?.combat.attackers||[]).filter(attacker=>attacker.defendingSeat===room?.viewerSeat&&!blockedAttackerIds.has(attacker.unitId));
  const blockable=(viewerRuntime?.battlefield||[]).filter(object=>
    ["unit","general","token"].includes(object.kind)
    && Boolean(object.combat&&object.combat.health>0)
    && !object.stunned
    && !assignedBlockerIds.has(object.id)
  );
  const livingOpponents=(combat?.seats||[]).filter(seat=>!seat.eliminated&&seat.seat!==room?.viewerSeat);
  const viewerSeatKey=room?.viewerSeat==null?null:`p${room.viewerSeat+1}`;
  const pendingSpell=viewerRuntime?.hand?.find(card=>card.instanceId===pendingSpellInstanceId);
  const pendingSpellDef=pendingSpell?collection.find(item=>item.defId===pendingSpell.defId):undefined;
  const pendingSpellTargetKind=pendingSpellDef?.type==="Equipment"?"allyUnit":pendingSpellDef?.spell?.target;
  const pendingTargetKind=pendingAbility?.targetKind||pendingSpellTargetKind;
  const pendingCounterTargets=pendingSpellDef?legalCounterTargets(pendingSpellDef,stackItems):[];
  const pendingGraveyardTargets=(combat?.seats||[]).flatMap(seat=>
    seat.graveyard
      .filter(card=>{
        if(!pendingTargetKind||!GRAVEYARD_TARGETS.has(pendingTargetKind)||seat.eliminated)return false;
        const allied=seat.seat===room?.viewerSeat;
        if(pendingTargetKind==="allyGraveyardCard"&&!allied)return false;
        if(pendingTargetKind==="allyGraveyardUnit"&&(!allied||collection.find(item=>item.defId===card.defId)?.type!=="Unit"))return false;
        if(pendingTargetKind==="enemyGraveyardCard"&&allied)return false;
        return true;
      })
      .map(card=>({seat:seat.seat,card}))
  );
  const pendingBoardTargets=battlefieldObjects.filter(object=>{
    if(!pendingTargetKind||(!UNIT_TARGETS.has(pendingTargetKind)&&!PERMANENT_TARGETS.has(pendingTargetKind)&&!SENTINELA_TARGETS.has(pendingTargetKind)&&pendingTargetKind!=="anyBoard"))return false;
    const allied=object.controllerSeat===viewerSeatKey;
    if(UNIT_TARGETS.has(pendingTargetKind)){
      if(!["unit","general","token"].includes(object.kind)||!object.combat||object.combat.health<=0)return false;
      if(pendingTargetKind==="enemyUnit"&&allied)return false;
      if(pendingTargetKind==="allyUnit"&&!allied)return false;
    }
    if(PERMANENT_TARGETS.has(pendingTargetKind)){
      if(object.kind!=="permanent"||!object.durability||object.durability.health<=0)return false;
      if(pendingTargetKind==="enemyPermanent"&&allied)return false;
      if(pendingTargetKind==="allyPermanent"&&!allied)return false;
    }
    if(SENTINELA_TARGETS.has(pendingTargetKind)){
      if(object.kind!=="sentinela"||(object.loyalty!==undefined&&object.loyalty<=0))return false;
      if(pendingTargetKind==="enemySentinela"&&allied)return false;
      if(pendingTargetKind==="allySentinela"&&!allied)return false;
    }
    if(pendingTargetKind==="anyBoard"){
      const alive=Boolean((object.combat&&object.combat.health>0)||(object.durability&&object.durability.health>0)||(object.kind==="sentinela"&&(object.loyalty===undefined||object.loyalty>0)));
      if(!alive)return false;
    }
    if(pendingSpellDef?.type==="Equipment"&&object.equipment.length>=2)return false;
    if(!allied&&object.keywords.includes("Hexproof"))return false;
    return true;
  });
  async function playHandCard(card:ProjectedCard,definition:CollectionCard|undefined){
    if(!definition)return;
    if(definition.type==="Equipment"){
      setPendingAbility(null);setAbilityDiscardIds([]);
      setPendingSpellInstanceId(card.instanceId);
      return;
    }
    if(definition.type!=="Spell"){
      await combatCommand("play_card",{instanceId:card.instanceId});
      return;
    }
    if(!definition.spell||!isFourPlayerSpellChainSupported(definition.spell))return;
    if(definition.spell.target==="spellOnStack"||UNIT_TARGETS.has(definition.spell.target)||PERMANENT_TARGETS.has(definition.spell.target)||GRAVEYARD_TARGETS.has(definition.spell.target)||definition.spell.kind==="damageNexus"||definition.spell.kind==="poison"||definition.spell.kind==="mill"){
      setPendingAbility(null);setAbilityDiscardIds([]);
      setPendingSpellInstanceId(card.instanceId);
      return;
    }
    await combatCommand("play_card",{instanceId:card.instanceId});
  }
  async function playPendingSpell(target?:Record<string,unknown>,stackTargetId?:string){
    if(!pendingSpell)return;
    const payload:Record<string,unknown>={instanceId:pendingSpell.instanceId};
    if(target)payload.target=target;
    if(stackTargetId)payload.stackTargetId=stackTargetId;
    await combatCommand("play_card",payload);
    setPendingSpellInstanceId(null);
  }
  async function activateAbility(option:AbilityOption,target?:Record<string,unknown>){
    const payload:Record<string,unknown>={
      sourceId:option.sourceId,
      abilityIndex:option.abilityIndex,
      timing:option.timing,
      ...(option.modeId?{modeId:option.modeId}:{}),
      ...(option.stackTargetId?{stackTargetId:option.stackTargetId}:{}),
      ...(target?{target}:{}),
      ...(abilityDiscardIds.length?{discardInstanceIds:abilityDiscardIds}:{}),
    };
    await combatCommand("activate_ability",payload);
    setPendingAbility(null);setAbilityDiscardIds([]);
  }
  function beginAbility(option:AbilityOption){
    setPendingSpellInstanceId(null);
    setAbilityDiscardIds([]);
    const immediate=(option.targetKind==="none"||option.targetKind==="self"||option.targetKind==="spellOnStack")&&option.discardCount===0;
    if(immediate){void activateAbility(option);return;}
    setPendingAbility(option);
  }
  function toggleAbilityDiscard(instanceId:string){
    if(!pendingAbility||pendingAbility.discardCount<=0)return;
    setAbilityDiscardIds(current=>{
      if(current.includes(instanceId))return current.filter(id=>id!==instanceId);
      if(current.length>=pendingAbility.discardCount)return current;
      return [...current,instanceId];
    });
  }

  return <main className="min-h-screen bg-[#06090e] text-slate-100">
    <div className="mx-auto max-w-[1500px] px-5 py-8">
      <header className="border-b border-white/10 pb-6">
        <p className="text-[10px] font-black uppercase tracking-[.3em] text-amber-200/55">FORGED · EXPERIMENTAL MULTIPLAYER</p>
        <h1 className="mt-2 text-4xl font-black text-[#f1dfb5]">Commander 4P Alpha</h1>
        <p className="mt-3 max-w-4xl text-sm text-slate-400">Modo separado do 1v1: quatro jogadores reais, 60 cartas + 1 General, Nexus 30, combate dividido, prioridade circular e stack LIFO com reações Fast/Burst. Ranked e o motor 1v1 permanecem isolados.</p>
      </header>
      {error&&<div className="mt-5 border border-red-400/25 bg-red-950/20 p-3 text-sm text-red-200">{error}</div>}

      {room ? <section className="mt-7 grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
        <div className="border border-white/10 bg-white/[.025] p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-xs uppercase tracking-[.2em] text-slate-500">Sala {room.code}</p><h2 className="mt-1 text-2xl font-black">{room.state==="playing"?"Partida 4P iniciada":"Lobby 4P"}</h2></div>
            <span className="border border-amber-200/20 px-3 py-2 text-xs font-black uppercase text-amber-100">{room.state} · v{room.version}</span>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {[0,1,2,3].map(seatIndex=>{
              const seat=room.seats.find(item=>item.seat===seatIndex);
              const runtime=combat?.seats.find(item=>item.seat===seatIndex);
              const active=room.state==="playing"&&(combat?.activeSeat??room.activeSeat)===seatIndex;
              const priority=room.state==="playing"&&combat?.prioritySeat===seatIndex;
              return <article key={seatIndex} className={`min-h-40 border p-4 ${active?"border-amber-200/40 bg-amber-100/[.06]":"border-white/10 bg-black/20"} ${runtime?.eliminated?"opacity-50 grayscale":""}`}>
                <div className="flex items-center justify-between gap-2"><span className="text-[10px] font-black uppercase tracking-[.16em] text-slate-500">Assento {seatIndex+1}</span><div className="flex gap-2">{active&&<b className="text-xs text-amber-200">TURNO</b>}{priority&&<b className="text-xs text-cyan-200">PRIORIDADE</b>}</div></div>
                {seat?<><h3 className="mt-3 text-lg font-black">{seat.playerName}{seat.isHost?" · HOST":""}</h3><p className="mt-2 text-xs text-slate-400">General: <b className="text-slate-200">{seat.generalDefId}</b>{runtime&&<> · <span className="text-cyan-200">{runtime.general.zone}</span> · casts {runtime.general.castCount}</>}</p>{runtime?<><div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs"><div className="border border-white/10 p-2"><b>{runtime.life??runtime.nexusHealth}</b><small className="block text-slate-500">Nexus</small></div><div className="border border-white/10 p-2"><b>{runtime.mana??0}/{runtime.maxMana??0}</b><small className="block text-slate-500">mana · ✦ {runtime.spellMana??0}</small></div><div className="border border-white/10 p-2"><b>{runtime.handCount}/{runtime.deckCount}</b><small className="block text-slate-500">mão/deck</small></div></div>{runtime.eliminated&&<p className="mt-2 text-xs font-black text-rose-300">ELIMINADO</p>}</>:<p className="mt-1 text-xs text-slate-500">{seat.cardCount} cartas · {seat.ready?"PRONTO":"PREPARANDO"}</p>}</>:<p className="mt-8 text-sm text-slate-600">Aguardando jogador…</p>}
              </article>
            })}
          </div>
          {room.state==="playing"&&<div className="mt-5 border border-white/10 p-4">
            {combat?<><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div><small className="text-slate-500">FASE</small><b className="block text-amber-100">{phaseLabel(combat.phase)}</b></div>
              <div><small className="text-slate-500">TURNO</small><b className="block">P{combat.activeSeat+1} · #{combat.turn}</b></div>
              <div><small className="text-slate-500">PRIORIDADE</small><b className="block text-cyan-200">P{combat.prioritySeat+1}</b></div>
              <div><small className="text-slate-500">AUTORIDADE</small><b className="block">rev {combat.revision}</b></div>
            </div>
            {stackItems.length>0&&<div className="mt-4 border border-violet-300/15 bg-violet-950/10 p-3">
              <div className="flex items-center justify-between gap-3"><b className="text-xs uppercase tracking-[.16em] text-violet-100">Stack 4P</b><span className="text-[10px] text-violet-300/50">topo primeiro</span></div>
              <div className="mt-2 space-y-1">{[...stackItems].reverse().map((item,index)=><div key={item.id} className="flex items-center justify-between gap-3 border border-white/8 px-3 py-2 text-xs"><span><b>{index===0?"TOPO · ":""}{item.abilityDescription||collection.find(card=>card.defId===item.defId)?.name||item.defId||item.kind}</b><small className="ml-2 text-slate-500">P{item.controllerSeat+1} · {item.abilityTiming?"habilidade "+item.abilityTiming:(item.speed||item.actionKind||item.kind)}{item.uncounterable?" · NÃO ANULÁVEL":""}</small></span><code className="text-[9px] text-slate-600">{item.id}</code></div>)}</div>
            </div>}
            {inCombat&&viewerHasPriority&&<div className="mt-4 border border-cyan-300/15 bg-cyan-950/10 p-3">
              <div className="flex items-center justify-between gap-3"><b className="text-xs uppercase tracking-[.16em] text-cyan-100">Combate autoritativo</b><span className="text-[10px] text-cyan-300/50">split attack 4P</span></div>
              {viewerIsActive?<div className="mt-3 space-y-2">
                {attackable.map(object=><div key={object.id} className="border border-white/10 p-3 text-xs">
                  <div className="flex items-center justify-between gap-2"><b>{collection.find(card=>card.defId===object.defId)?.name||object.defId}</b><span className="text-slate-500">{object.combat?.power??0}/{object.combat?.health??0}</span></div>
                  <div className="mt-2 flex flex-wrap gap-2">{livingOpponents.map(target=><button key={target.seat} className="btn-ghost" disabled={busy} onClick={()=>void combatCommand("declare_attacker",{unitId:object.id,defendingSeat:target.seat})}>Atacar P{target.seat+1}</button>)}</div>
                </div>)}
                {!attackable.length&&<p className="text-xs text-slate-500">Nenhuma unidade elegível para novo ataque.</p>}
              </div>:<div className="mt-3 space-y-3">
                {incomingAttackers.map(attacker=>{const source=battlefieldObjects.find(object=>object.id===attacker.unitId);return <div key={attacker.unitId} className="border border-white/10 p-3 text-xs">
                  <b>{collection.find(card=>card.defId===source?.defId)?.name||source?.defId||attacker.unitId}</b><span className="ml-2 text-rose-200">atacando seu Nexus</span>
                  <div className="mt-2 flex flex-wrap gap-2">{blockable.map(blocker=><button key={blocker.id} className="btn-ghost" disabled={busy} onClick={()=>void combatCommand("declare_blocker",{unitId:blocker.id,attackerId:attacker.unitId})}>Bloquear com {collection.find(card=>card.defId===blocker.defId)?.name||blocker.defId}</button>)}</div>
                </div>})}
                {!incomingAttackers.length&&<p className="text-xs text-slate-500">Nenhum atacante aguardando bloqueio contra você.</p>}
              </div>}
            </div>}
            {combat.abilities.length>0&&<div className="mt-4 border border-emerald-300/15 bg-emerald-950/10 p-3">
              <div className="flex items-center justify-between gap-3"><b className="text-xs uppercase tracking-[.16em] text-emerald-100">Habilidades 4P</b><span className="text-[10px] text-emerald-300/50">autoridade de battlefield</span></div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">{combat.abilities.map((option,index)=>{
                const source=battlefieldObjects.find(object=>object.id===option.sourceId);
                const sourceName=collection.find(card=>card.defId===option.sourceDefId)?.name||option.sourceDefId;
                const cost=[option.manaCost?String(option.manaCost)+" mana":"",option.spellManaCost?String(option.spellManaCost)+" ✦ magia":"",option.nexusHealthCost?String(option.nexusHealthCost)+" Nexus":"",option.discardCount?"descartar "+String(option.discardCount):"",option.exhaustSelf?"exaurir":"",option.consumeBarrier?"Barreira":"",option.sacrificeSelf?"sacrificar":"",option.loyaltyDelta!==undefined?(option.loyaltyDelta>=0?"+":"")+String(option.loyaltyDelta)+" lealdade":""].filter(Boolean).join(" · ");
                return <button key={option.sourceId+":"+option.timing+":"+String(option.abilityIndex)+":"+(option.modeId||String(index))} className="border border-emerald-200/15 p-3 text-left text-xs disabled:opacity-35" disabled={busy} onClick={()=>beginAbility(option)}>
                  <b className="block text-emerald-100">{sourceName}{source?.loyalty!==undefined?" · L"+String(source.loyalty):""}</b>
                  <span className="mt-1 block text-slate-300">{option.modeDescription||option.description}</span>
                  <small className="mt-1 block text-slate-500">{option.timing==="reaction"?"REAÇÃO":"ATIVADA"}{cost?" · "+cost:""}</small>
                </button>
              })}</div>
            </div>}
            {viewerRuntime?.hand&&viewerRuntime.hand.length>0&&<div className="mt-4 border border-white/10 bg-black/20 p-3">
              <div className="flex items-center justify-between gap-3"><b className="text-xs uppercase tracking-[.16em] text-slate-400">Sua mão</b><span className="text-[10px] text-slate-600">instâncias autoritativas</span></div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {viewerRuntime.hand.map(card=>{
                  const definition=collection.find(item=>item.defId===card.defId);
                  const physical=["Unit","Enchantment","Artifact","Equipment","Sentinela"].includes(definition?.type||"");
                  const spell=definition?.type==="Spell"&&isFourPlayerSpellChainSupported(definition.spell);
                  const stageable=physical||spell;
                  const availableMana=(viewerRuntime.mana??0)+(cardCanUseSpellMana(definition)?(viewerRuntime.spellMana??0):0);
                  const affordable=(definition?.cost??0)<=availableMana;
                  const counterTargets=definition?legalCounterTargets(definition,stackItems):[];
                  const proactive=definition?.archetypeKey!=="trap";
                  const reactive=Boolean(spell&&definition?.speed&&stackTop&&stackTop.actionKind&&(stackTop.actionKind!=="spell"||definition.speed==="Burst")&&(definition.spell?.kind!=="negateSpell"||counterTargets.length>0));
                  const hasEquipmentTarget=definition?.type!=="Equipment"||(viewerRuntime?.battlefield||[]).some(object=>
                    ["unit","general","token"].includes(object.kind)&&Boolean(object.combat&&object.combat.health>0)&&object.equipment.length<2
                  );
                  const canStage=Boolean(stageable&&affordable&&hasEquipmentTarget&&((canPlayPhysicalCard&&proactive)||(viewerHasPriority&&viewerAlive&&reactive)));
                  const needsTarget=Boolean(
                    definition?.type==="Equipment"
                    || (spell&&definition?.spell&&(definition.spell.target==="spellOnStack"||UNIT_TARGETS.has(definition.spell.target)||PERMANENT_TARGETS.has(definition.spell.target)||GRAVEYARD_TARGETS.has(definition.spell.target)||definition.spell.kind==="damageNexus"||definition.spell.kind==="poison"||definition.spell.kind==="mill"))
                  );
                  return <button key={card.instanceId} className="border border-white/10 p-3 text-left text-xs disabled:cursor-not-allowed disabled:opacity-35" disabled={busy||!canStage} onClick={()=>void playHandCard(card,definition)}>
                    <b className="block text-slate-100">{definition?.name||card.defId}</b>
                    <span className="mt-1 block text-slate-500">{definition?.type||"carta"} · custo {definition?.cost??"?"}{cardCanUseSpellMana(definition)?" · usa ✦":""}{definition?.speed?` · ${definition.speed}`:""}</span>
                    <span className="mt-2 block font-black uppercase text-amber-200">{reactive?(needsTarget?"Responder com alvo":"Responder"):(needsTarget?"Selecionar alvo":"Jogar")}</span>
                  </button>
                })}
              </div>
              {pendingAbility&&<div className="mt-4 border border-emerald-200/20 bg-emerald-100/[.04] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div><b className="text-xs uppercase tracking-[.16em] text-emerald-100">Ativar habilidade</b><p className="mt-1 text-xs text-slate-400">{pendingAbility.modeDescription||pendingAbility.description}</p></div>
                  <button className="text-xs text-slate-500 underline" onClick={()=>{setPendingAbility(null);setAbilityDiscardIds([])}}>Cancelar</button>
                </div>
                {pendingAbility.discardCount>0&&<div className="mt-3">
                  <p className="text-xs text-slate-400">Escolha {pendingAbility.discardCount} carta(s) da mão para descartar · {abilityDiscardIds.length}/{pendingAbility.discardCount}</p>
                  <div className="mt-2 flex flex-wrap gap-2">{(viewerRuntime.hand||[]).map(card=><button key={card.instanceId} className={"border px-2 py-1 text-xs "+(abilityDiscardIds.includes(card.instanceId)?"border-emerald-300/50 text-emerald-100":"border-white/10 text-slate-400")} disabled={busy} onClick={()=>toggleAbilityDiscard(card.instanceId)}>{collection.find(item=>item.defId===card.defId)?.name||card.defId}</button>)}</div>
                </div>}
                {pendingAbility.targetKind==="opponentPlayer"?<div className="mt-3 flex flex-wrap gap-2">
                  {livingOpponents.map(target=><button key={target.seat} className="btn-ghost" disabled={busy||abilityDiscardIds.length!==pendingAbility.discardCount} onClick={()=>void activateAbility(pendingAbility,{kind:"player",seat:"p"+String(target.seat+1)})}>Nexus P{target.seat+1}</button>)}
                </div>:GRAVEYARD_TARGETS.has(pendingAbility.targetKind)?<div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {pendingGraveyardTargets.map(({seat,card})=><button key={card.instanceId} className="btn-ghost text-left" disabled={busy||abilityDiscardIds.length!==pendingAbility.discardCount} onClick={()=>void activateAbility(pendingAbility,{kind:"graveyard",seat:"p"+String(seat+1),instanceId:card.instanceId})}>{collection.find(item=>item.defId===card.defId)?.name||card.defId} · Cemitério P{seat+1}</button>)}
                  {!pendingGraveyardTargets.length&&<p className="text-xs text-slate-500">Nenhum alvo legal no Cemitério.</p>}
                </div>:UNIT_TARGETS.has(pendingAbility.targetKind)||PERMANENT_TARGETS.has(pendingAbility.targetKind)||SENTINELA_TARGETS.has(pendingAbility.targetKind)||pendingAbility.targetKind==="anyBoard"?<div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {pendingBoardTargets.map(target=><button key={target.id} className="btn-ghost text-left" disabled={busy||abilityDiscardIds.length!==pendingAbility.discardCount} onClick={()=>void activateAbility(pendingAbility,{kind:"battlefield",objectId:target.id})}>{collection.find(card=>card.defId===target.defId)?.name||target.defId} · P{Number(target.controllerSeat.slice(1))}</button>)}
                  {!pendingBoardTargets.length&&<p className="text-xs text-slate-500">Nenhum alvo legal no battlefield.</p>}
                </div>:<button className="btn-primary mt-3" disabled={busy||abilityDiscardIds.length!==pendingAbility.discardCount} onClick={()=>void activateAbility(pendingAbility)}>Confirmar ativação</button>}
              </div>}
              {pendingSpell&&pendingSpellDef&&<div className="mt-4 border border-amber-200/20 bg-amber-100/[.04] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div><b className="text-xs uppercase tracking-[.16em] text-amber-100">Alvo da carta</b><p className="mt-1 text-xs text-slate-400">{pendingSpellDef.name}</p></div>
                  <button className="text-xs text-slate-500 underline" onClick={()=>setPendingSpellInstanceId(null)}>Cancelar</button>
                </div>
                {pendingSpellDef.spell?.target==="spellOnStack"?<div className="mt-3 grid gap-2">
                  {[...pendingCounterTargets].reverse().map(item=><button key={item.id} className="btn-ghost text-left" disabled={busy} onClick={()=>void playPendingSpell(undefined,item.id)}>{item.id===stackTop?.id?"TOPO · ":""}{collection.find(card=>card.defId===item.defId)?.name||item.defId||item.kind} · P{item.controllerSeat+1}</button>)}
                  {!pendingCounterTargets.length&&<p className="text-xs text-slate-500">Nenhum alvo anulável para este counter.</p>}
                </div>:pendingTargetKind&&GRAVEYARD_TARGETS.has(pendingTargetKind)?<div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {pendingGraveyardTargets.map(({seat,card})=><button key={card.instanceId} className="btn-ghost text-left" disabled={busy} onClick={()=>void playPendingSpell({kind:"graveyard",seat:`p${seat+1}`,instanceId:card.instanceId})}>
                    {collection.find(item=>item.defId===card.defId)?.name||card.defId} · Cemitério P{seat+1}
                  </button>)}
                  {!pendingGraveyardTargets.length&&<p className="text-xs text-slate-500">Nenhum alvo legal no Cemitério.</p>}
                </div>:(pendingSpellDef.spell?.kind==="damageNexus"||pendingSpellDef.spell?.kind==="poison"||pendingSpellDef.spell?.kind==="mill")?<div className="mt-3 flex flex-wrap gap-2">
                  {livingOpponents.map(target=><button key={target.seat} className="btn-ghost" disabled={busy} onClick={()=>void playPendingSpell({kind:"player",seat:`p${target.seat+1}`})}>Nexus P{target.seat+1}</button>)}
                </div>:<div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {pendingBoardTargets.map(target=><button key={target.id} className="btn-ghost text-left" disabled={busy} onClick={()=>void playPendingSpell({kind:"battlefield",objectId:target.id})}>
                    {collection.find(card=>card.defId===target.defId)?.name||target.defId} · P{Number(target.controllerSeat.slice(1))}{target.durability?` · ${target.durability.health}/${target.durability.maxHealth}`:""}{target.equipment.length?` · ${target.equipment.length}/2 eq`:""}
                  </button>)}
                  {!pendingBoardTargets.length&&<p className="text-xs text-slate-500">Nenhum alvo legal visível para esta Spell.</p>}
                </div>}
              </div>}
            </div>}
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <button className="btn-ghost" disabled={busy||!viewerHasPriority} onClick={()=>void combatCommand("pass_priority")}>Passar prioridade</button>
              <button className="btn-ghost" disabled={busy||!canCastGeneral} onClick={()=>void combatCommand("cast_general")}>Conjurar General</button>
              <button className="btn-primary" disabled={busy||!viewerIsActive||!viewerHasPriority||stackItems.length>0} onClick={()=>void combatCommand("end_turn")}>Encerrar turno</button>
              <button className="border border-rose-400/25 px-3 py-2 text-xs font-black uppercase text-rose-200 disabled:opacity-30" disabled={busy||!viewerAlive} onClick={()=>void combatCommand("concede")}>Conceder partida</button>
            </div>
            <p className="mt-3 text-xs text-slate-500">Comandos enviados com revisionamento autoritativo; ações fora de prioridade, turno ou timing são recusadas pelo servidor.</p></>:<><p className="text-sm">Rodada <b>{room.round}</b> · compatibilidade de sala anterior.</p>{room.viewerSeat===room.activeSeat&&<button className="btn-primary mt-3" disabled={busy} onClick={()=>void mutate(`/api/commander/${room.code}`,{action:"pass-turn"})}>Passar turno</button>}</>}
          </div>}
        </div>
        <aside className="border border-white/10 bg-black/20 p-5">
          <h3 className="font-black">Controles do lobby</h3>
          {room.state==="waiting"&&<>
            <button className="btn-primary mt-4 w-full" disabled={busy||room.viewerSeat==null} onClick={()=>void mutate(`/api/commander/${room.code}`,{action:"ready",ready:!room.seats.find(s=>s.seat===room.viewerSeat)?.ready})}>{room.seats.find(s=>s.seat===room.viewerSeat)?.ready?"Retirar ready":"Estou pronto"}</button>
            {room.seats.find(s=>s.seat===room.viewerSeat)?.isHost&&<button className="btn-ghost mt-3 w-full" disabled={busy||room.seats.length!==4||!room.seats.every(s=>s.ready)} onClick={()=>void mutate(`/api/commander/${room.code}`,{action:"start"})}>Iniciar com 4 jogadores</button>}
            <button className="btn-ghost mt-3 w-full" disabled={busy} onClick={()=>void mutate(`/api/commander/${room.code}`,{action:"leave"})}>Sair do lobby</button>
          </>}
          <button className="mt-5 text-xs text-slate-500 underline" onClick={()=>{setRoom(null);void loadRooms()}}>Voltar às salas</button>
        </aside>
      </section> : <div className="mt-7 grid gap-6 xl:grid-cols-[1fr_1fr]">
        <section className="border border-white/10 bg-white/[.025] p-5">
          <h2 className="text-xl font-black">Forjar loadout Commander</h2>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center"><div className="border border-white/10 p-3"><b>{deck.length}/60</b><small className="block text-slate-500">deck</small></div><div className="border border-white/10 p-3"><b>30</b><small className="block text-slate-500">Nexus</small></div><div className="border border-white/10 p-3"><b>4</b><small className="block text-slate-500">jogadores</small></div></div>
          <label className="mt-5 block text-xs font-black uppercase tracking-wider text-slate-500">General</label>
          <select className="rf-input mt-2 w-full" value={general} onChange={e=>setGeneral(e.target.value)}><option value="">Escolha Champion ou Legend</option>{generals.map(card=><option key={card.defId} value={card.defId}>{card.name} · {card.region}</option>)}</select>
          {selectedGeneral&&<p className="mt-2 text-xs text-amber-100/70">General fora do deck: {selectedGeneral.name}</p>}
          <div className="mt-5 max-h-[480px] overflow-auto border border-white/10 p-3">
            <div className="grid gap-2 sm:grid-cols-2">{eligible.map(card=>{const used=countOf(deck,card.defId);return <div key={card.defId} className="flex items-center justify-between gap-2 border border-white/8 p-2 text-xs"><div><b>{card.name}</b><small className="block text-slate-500">{card.region} · possui {card.owned}</small></div><div className="flex items-center gap-2"><button disabled={!used} onClick={()=>remove(card.defId)}>-</button><span>{used}</span><button disabled={deck.length>=60||used>=Math.min(3,card.owned)} onClick={()=>add(card.defId)}>+</button></div></div>})}</div>
          </div>
          <button className="btn-primary mt-4 w-full" disabled={!canSubmit} onClick={()=>void mutate("/api/commander",{...loadout})}>Criar sala 4P</button>
        </section>
        <section className="border border-white/10 bg-black/20 p-5">
          <h2 className="text-xl font-black">Salas abertas</h2>
          <div className="mt-4 flex gap-2"><input className="rf-input flex-1" value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase())} placeholder="Código da sala"/><button className="btn-primary" disabled={!canSubmit||joinCode.length<6} onClick={()=>void mutate(`/api/commander/${joinCode}`,{action:"join",...loadout})}>Entrar</button></div>
          <div className="mt-5 space-y-3">{rooms.map(item=><article key={item.code} className="flex items-center justify-between border border-white/10 p-4"><div><b>Sala {item.code}</b><p className="text-xs text-slate-500">{item.seatCount}/4 jogadores</p></div><button className="btn-ghost" disabled={!canSubmit||item.seatCount>=4} onClick={()=>void mutate(`/api/commander/${item.code}`,{action:"join",...loadout})}>{item.viewerJoined?"Abrir":"Entrar"}</button></article>)}{!rooms.length&&<p className="text-sm text-slate-500">Nenhuma sala Commander aguardando jogadores.</p>}</div>
        </section>
      </div>}
    </div>
  </main>;
}