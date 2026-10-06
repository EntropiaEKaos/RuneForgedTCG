"use client";

import { useEffect, useRef, useState } from "react";
import CardView from "@/components/CardView";
import CardInfo from "@/components/CardInfo";
import Tooltip from "@/components/Tooltip";
import CommanderPhaserRuntime from "./CommanderPhaserRuntime";
import { getCard } from "@/game/cards";
import { getCardArt } from "@/game/card-art";

type ProjectedCard = { instanceId:string; defId:string };
type BattlefieldObject = {
  id:string; defId:string; kind:string; ownerSeat:string; controllerSeat:string; enteredTurn:number;
  keywords:string[]; combat?:{power:number;health:number;maxHealth:number;barrier:boolean;frostbitten:boolean};
  durability?:{health:number;maxHealth:number};
  equipment:{instanceId:string;defId:string;ownerSeat:string;physical:boolean;buffPower:number;buffHealth:number;keywords:string[]}[];
  loyalty?:number; stunned:boolean; attackedThisTurn:boolean;
};
type CombatSeat = {
  seat:number; handCount:number; deckCount:number; graveyard:ProjectedCard[];
  nexusHealth:number; eliminated:boolean; life?:number; mana?:number; maxMana?:number; spellMana?:number;
  battlefield?:BattlefieldObject[]; hand?:ProjectedCard[];
  general:{defId:string;zone:string;castCount:number};
};
type StackItem = {
  id:string; controllerSeat:number; defId:string|null; speed:string|null; actionKind:string|null;
  sourceId?:string|null; abilityDescription?:string|null; uncounterable:boolean;
};
type CombatState = {
  revision:number; activeSeat:number; prioritySeat:number; phase:string; turn:number; round:number; status:string; winnerSeat:number|null;
  seats:CombatSeat[]; stack:StackItem[];
  combat:{attackers:{unitId:string;controllerSeat:number;defendingSeat:number}[];blockers:{unitId:string;controllerSeat:number;attackerId:string}[]};
};
type Seat = {seat:number;playerName:string;isHost:boolean};
type Room = {viewerSeat:number|null;seats:Seat[]};
type CollectionCard = {defId:string;name:string};

type Position="bottom"|"left"|"top"|"right";
const positionOrder:Position[]=["bottom","left","top","right"];
const gridClass:Record<Position,string>={
  top:"col-start-2 row-start-1 self-stretch overflow-visible",
  left:"col-start-1 row-start-2 self-stretch overflow-visible",
  right:"col-start-3 row-start-2 self-stretch overflow-visible",
  bottom:"col-start-2 row-start-3 self-stretch overflow-visible",
};
const anchor:Record<Position,{x:number;y:number}>={
  top:{x:50,y:17},
  left:{x:17,y:50},
  right:{x:83,y:50},
  bottom:{x:50,y:83},
};

function phaserCardIdentity(defId:string){
  const card=getCard(defId);
  const art=getCardArt(defId);
  return {name:card.name,artUrl:art?.url||card.art||null};
}

function nameOf(defId:string|undefined|null,collection:CollectionCard[]){
  if(!defId)return "—";
  return collection.find(card=>card.defId===defId)?.name||defId;
}
function relativePosition(seat:number,viewer:number):Position{
  return positionOrder[(seat-viewer+4)%4];
}
type CombatMotion="attacking"|"blocking"|null;
function combatMotionTransform(position:Position,motion:CombatMotion){
  if(!motion)return "translate3d(0,0,0) scale(1)";
  const distance=motion==="attacking"?24:16;
  if(position==="bottom")return `translate3d(0,-${distance}px,0) scale(${motion==="attacking"?1.06:1.035})`;
  if(position==="top")return `translate3d(0,${distance}px,0) scale(${motion==="attacking"?1.06:1.035})`;
  if(position==="left")return `translate3d(${distance}px,0,0) scale(${motion==="attacking"?1.06:1.035})`;
  return `translate3d(-${distance}px,0,0) scale(${motion==="attacking"?1.06:1.035})`;
}

type ResolutionDeparture={id:string;defId:string;seat:number;destination:"graveyard"|"general_zone"};
type ResolutionFx={
  revision:number;
  attackerIds:string[];
  blockerPairs:Array<{attackerId:string;blockerId:string}>;
  nexusDamage:Record<number,number>;
  objectDamage:Record<string,number>;
  objectSeats:Record<string,number>;
  barrierBroken:string[];
  departures:ResolutionDeparture[];
};
function seatLife(seat:CombatSeat){return seat.life??seat.nexusHealth;}
function battlefieldMap(combat:CombatState){
  return new Map(combat.seats.flatMap(seat=>(seat.battlefield||[]).map(object=>[object.id,{seat:seat.seat,object}] as const)));
}
function deriveAuthoritativeResolutionFx(previous:CombatState,current:CombatState):ResolutionFx|null{
  if(current.revision<=previous.revision)return null;
  const nexusDamage:Record<number,number>={};
  const objectDamage:Record<string,number>={};
  const objectSeats:Record<string,number>={};
  const barrierBroken:string[]=[];
  const departures:ResolutionDeparture[]=[];
  for(const seat of current.seats){
    const before=previous.seats.find(entry=>entry.seat===seat.seat);
    if(!before)continue;
    const damage=seatLife(before)-seatLife(seat);
    if(damage>0)nexusDamage[seat.seat]=damage;
  }
  const beforeObjects=battlefieldMap(previous);
  const afterObjects=battlefieldMap(current);
  for(const [id,before] of beforeObjects){
    const after=afterObjects.get(id);
    if(after){
      const beforeHealth=before.object.combat?.health;
      const afterHealth=after.object.combat?.health;
      if(typeof beforeHealth==="number"&&typeof afterHealth==="number"&&afterHealth<beforeHealth){
        objectDamage[id]=beforeHealth-afterHealth;
        objectSeats[id]=after.seat;
      }
      if(before.object.combat?.barrier===true&&after.object.combat?.barrier===false){
        barrierBroken.push(id);
        objectSeats[id]=after.seat;
      }
      continue;
    }
    const ownerIndex=Number(String(before.object.ownerSeat).replace(/^p/,""))-1;
    const owner=current.seats.find(seat=>seat.seat===ownerIndex);
    if(before.object.kind==="general"&&owner?.general.defId===before.object.defId&&owner.general.zone!=="battlefield"){
      departures.push({id,defId:before.object.defId,seat:ownerIndex,destination:"general_zone"});
      continue;
    }
    if(owner?.graveyard.some(card=>card.instanceId===id)){
      departures.push({id,defId:before.object.defId,seat:ownerIndex,destination:"graveyard"});
    }
  }
  return Object.keys(nexusDamage).length||Object.keys(objectDamage).length||barrierBroken.length||departures.length
    ? {revision:current.revision,attackerIds:previous.combat.attackers.map(entry=>entry.unitId),blockerPairs:previous.combat.blockers.map(entry=>({attackerId:entry.attackerId,blockerId:entry.unitId})),nexusDamage,objectDamage,objectSeats,barrierBroken,departures}
    : null;
}

function BattlefieldCard({
  object,collection,selected,targetable,onClick,badge,position,motion,damage,barrierBroken,
}:{
  object:BattlefieldObject;collection:CollectionCard[];selected?:boolean;targetable?:boolean;onClick?:()=>void;badge?:string;
  position:Position;motion:CombatMotion;damage?:number;barrierBroken?:boolean;
}){
  const stat=object.combat
    ? `${object.combat.power}/${object.combat.health}`
    : object.durability
      ? `${object.durability.health}/${object.durability.maxHealth}`
      : object.loyalty!==undefined
        ? `L${object.loyalty}`
        : "";
  return <div
    className="group relative shrink-0"
    data-commander-object={object.id}
    data-commander-combat-motion={motion||undefined}
    style={{transform:combatMotionTransform(position,motion),transition:"transform 420ms cubic-bezier(.2,.85,.2,1), filter 300ms ease",filter:motion==="attacking"?"drop-shadow(0 0 14px rgba(251,113,133,.28))":motion==="blocking"?"drop-shadow(0 0 12px rgba(34,211,238,.24))":undefined}}
  >
    <Tooltip content={<CardInfo defId={object.defId}/>} panelWidth={420} panelHeightEstimate={900}>
      <CardView defId={object.defId} size="sm" attacking={object.attackedThisTurn} selected={selected} targetable={targetable} onClick={onClick}/>
    </Tooltip>
    {Boolean(damage)&&<span className="pointer-events-none absolute left-1/2 top-1/2 z-40 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full border border-rose-100/80 bg-rose-500/45 px-2 py-1 text-sm font-black text-white shadow-[0_0_24px_rgba(244,63,94,.6)]" data-commander-damage-fx={damage}>-{damage}</span>}
    {barrierBroken&&<span className="pointer-events-none absolute inset-1 z-30 grid place-items-center rounded-xl border-2 border-cyan-100/80 bg-cyan-300/10 text-[8px] font-black uppercase tracking-wider text-cyan-50 shadow-[0_0_28px_rgba(34,211,238,.42)]" data-commander-barrier-break="true">BARREIRA QUEBROU</span>}
    {badge&&<span className="pointer-events-none absolute -top-2 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-full border border-rose-200/30 bg-rose-950/90 px-2 py-0.5 text-[8px] font-black uppercase tracking-wide text-rose-100 shadow-lg">{badge}</span>}
    <div className="pointer-events-none absolute -bottom-2 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full border border-white/15 bg-slate-950/95 px-2 py-0.5 text-[9px] font-black text-white shadow-xl">
      {stat&&<span>{stat}</span>}
      {object.stunned&&<span title="Atordoado">✦</span>}
      {object.combat?.barrier&&<span title="Barreira">🛡</span>}
      {object.combat?.frostbitten&&<span title="Congelado">❄</span>}
      {object.equipment.length>0&&<span title="Equipamentos">⚙{object.equipment.length}</span>}
    </div>
    <span className="pointer-events-none absolute left-1 top-1 z-20 rounded bg-black/75 px-1 text-[8px] uppercase tracking-wider text-white/70">{object.kind}</span>
  </div>;
}

function battlefieldVisualStateKey(object:BattlefieldObject,declaredAttackerIds:Set<string>,declaredBlockerIds:Set<string>,incomingAttackerIds:Set<string>,attackableIds:Set<string>,blockableIds:Set<string>){
  return JSON.stringify({
    defId:object.defId,kind:object.kind,controllerSeat:object.controllerSeat,enteredTurn:object.enteredTurn,keywords:[...object.keywords].sort(),
    combat:object.combat?{power:object.combat.power,health:object.combat.health,maxHealth:object.combat.maxHealth,barrier:object.combat.barrier,frostbitten:object.combat.frostbitten}:null,
    durability:object.durability||null,loyalty:object.loyalty??null,stunned:object.stunned,attackedThisTurn:object.attackedThisTurn,
    equipment:object.equipment.map(item=>({defId:item.defId,buffPower:item.buffPower,buffHealth:item.buffHealth,keywords:[...item.keywords].sort()})),
    attacking:declaredAttackerIds.has(object.id),blocking:declaredBlockerIds.has(object.id),incoming:incomingAttackerIds.has(object.id),attackable:attackableIds.has(object.id),blockable:blockableIds.has(object.id),
  });
}
function groupEquivalentBattlefieldObjects(objects:BattlefieldObject[],declaredAttackerIds:Set<string>,declaredBlockerIds:Set<string>,incomingAttackerIds:Set<string>,attackableIds:Set<string>,blockableIds:Set<string>){
  const groups=new Map<string,BattlefieldObject[]>();
  for(const object of objects){
    const key=battlefieldVisualStateKey(object,declaredAttackerIds,declaredBlockerIds,incomingAttackerIds,attackableIds,blockableIds);
    const group=groups.get(key); if(group)group.push(object); else groups.set(key,[object]);
  }
  return [...groups.values()];
}

function VisibleHand({cards,playableIds,onPlay}:{cards:ProjectedCard[];playableIds:Set<string>;onPlay?:(card:ProjectedCard)=>void}){
  const shown=cards.slice(0,9);
  return <div className="flex min-h-20 items-end justify-center overflow-visible px-2" aria-label={`${cards.length} cartas na sua mão`}>
    {shown.map((card,index)=><div key={card.instanceId} data-commander-hand-card={card.instanceId} className="-ml-4 first:ml-0 origin-bottom transition-transform hover:z-30 hover:-translate-y-4 hover:scale-110" style={{transform:`rotate(${(index-(shown.length-1)/2)*3.5}deg)`}}>
      <Tooltip content={<CardInfo defId={card.defId}/>} panelWidth={420} panelHeightEstimate={900}>
        <CardView defId={card.defId} size="sm" onClick={playableIds.has(card.instanceId)&&onPlay?()=>onPlay(card):undefined}/>
      </Tooltip>
    </div>)}
    {cards.length>shown.length&&<span className="ml-2 self-center text-[9px] font-black text-cyan-100">+{cards.length-shown.length}</span>}
  </div>;
}

function HiddenHand({count}:{count:number}){
  const visible=Math.min(5,count);
  return <div className="flex h-10 min-w-24 items-end justify-center" aria-label={`${count} cartas ocultas na mão`}>
    {Array.from({length:visible},(_,index)=><div
      key={index}
      className="-ml-3 h-9 w-6 first:ml-0 rounded border border-cyan-100/20 bg-cover bg-center shadow-lg"
      style={{backgroundImage:"url('/art/ui/runeforge-card-back.svg')",transform:`rotate(${(index-(visible-1)/2)*5}deg)`,transformOrigin:"50% 120%"}}
    />)}
    {count>visible&&<span className="ml-1 text-[9px] font-black text-slate-400">+{count-visible}</span>}
  </div>;
}

function SeatZone({
  position,seat,runtime,collection,isViewer,isActive,hasPriority,
  attackableIds,blockableIds,incomingAttackerIds,declaredAttackerIds,declaredBlockerIds,selectedAttackerId,selectedBlockerId,
  nexusDamage,objectDamage,barrierBrokenIds,
  canTargetNexus,onTargetNexus,onSelectAttacker,onSelectBlocker,onTargetIncomingAttacker,playableHandIds,onPlayHandCard,busy,
}:{
  position:Position;seat:Seat|undefined;runtime:CombatSeat;collection:CollectionCard[];isViewer:boolean;isActive:boolean;hasPriority:boolean;
  attackableIds:Set<string>;blockableIds:Set<string>;incomingAttackerIds:Set<string>;declaredAttackerIds:Set<string>;declaredBlockerIds:Set<string>;
  selectedAttackerId:string|null;selectedBlockerId:string|null;nexusDamage:number;objectDamage:Record<string,number>;barrierBrokenIds:Set<string>;
  canTargetNexus:boolean;onTargetNexus?:()=>void;
  onSelectAttacker:(id:string)=>void;onSelectBlocker:(id:string)=>void;onTargetIncomingAttacker:(id:string)=>void;playableHandIds:Set<string>;onPlayHandCard?:(card:ProjectedCard)=>void;busy:boolean;
}){
  const battlefield=runtime.battlefield||[];
  const playerName=seat?.playerName||`P${runtime.seat+1}`;
  const graveTop=runtime.graveyard.at(-1);
  const [graveOpen,setGraveOpen]=useState(false);
  const vertical=position==="left"||position==="right";
  return <section
    className={`relative min-h-0 min-w-0 transition ${hasPriority?"drop-shadow-[0_0_14px_rgba(217,170,91,.26)]":isActive?"drop-shadow-[0_0_14px_rgba(251,191,36,.16)]":""} ${runtime.eliminated?"opacity-45 grayscale":""}`}
    data-commander-seat={runtime.seat}
    data-commander-position={position}
    data-commander-seat-zone="integrated"
  >
    <div className={`absolute z-30 flex items-center gap-2 rounded-full border px-2.5 py-1 backdrop-blur-md ${hasPriority?"border-amber-200/55 bg-stone-950/90 shadow-[0_0_16px_rgba(217,170,91,.18)]":isActive?"border-amber-200/35 bg-slate-950/75":"border-white/10 bg-slate-950/65"} ${position==="top"?"left-1/2 top-0 -translate-x-1/2":position==="bottom"?"bottom-0 left-1/2 -translate-x-1/2":position==="left"?"left-1 top-1/2 -translate-y-1/2": "right-1 top-1/2 -translate-y-1/2"}`}>
      <b className="max-w-32 truncate text-[10px] text-white">P{runtime.seat+1} · {playerName}</b>
      {isViewer&&<span className="text-[7px] font-black uppercase text-amber-100">VOCÊ</span>}
      {isActive&&<span className="text-[7px] font-black uppercase text-amber-200">TURNO</span>}
      {hasPriority&&<span className="text-[7px] font-black uppercase text-amber-200">PRIORIDADE</span>}
    </div>

    <div className={`absolute z-30 flex items-center gap-1.5 ${position==="top"?"right-1 top-1":position==="bottom"?"bottom-1 right-1":position==="left"?"bottom-1 left-1": "bottom-1 right-1"}`}>
      <button type="button" disabled={!canTargetNexus||busy} onClick={onTargetNexus}
        className={`relative rounded-full border px-2 py-1 text-[9px] font-black backdrop-blur ${canTargetNexus?"border-rose-200/60 bg-rose-950/80 text-rose-50 shadow-[0_0_18px_rgba(251,113,133,.2)]":"border-rose-200/15 bg-black/55 text-rose-100"}`}
        aria-label={`Nexus P${runtime.seat+1}`}
        data-commander-nexus-target={canTargetNexus?runtime.seat:undefined}>
        <span>Nexus P{runtime.seat+1}</span>
        {nexusDamage>0&&<span className="absolute -right-2 -top-2 animate-ping rounded-full bg-rose-500 px-1 text-[8px] text-white" data-commander-nexus-damage={nexusDamage}>-{nexusDamage}</span>}
      </button>
      <span className="rounded-full border border-rose-200/15 bg-black/55 px-2 py-1 text-[8px] font-black text-rose-100">♥ {runtime.life??runtime.nexusHealth}</span>
      <span className="rounded-full border border-amber-200/20 bg-black/70 px-2 py-1 text-[8px] font-black text-amber-100">◆ {runtime.mana??0}/{runtime.maxMana??0}</span>
      <span className="rounded-full border border-stone-200/15 bg-black/70 px-2 py-1 text-[8px] font-black text-stone-200">✦ {runtime.spellMana??0}</span>
    </div>

    <div className={`absolute z-20 ${position==="top"?"left-2 top-2":position==="bottom"?"bottom-2 left-2":position==="left"?"left-2 top-2": "right-2 top-2"}`}>
      <div className={`relative origin-top-left ${isViewer?"scale-[.68]":"scale-[.56]"}`}>
        <Tooltip content={<CardInfo defId={runtime.general.defId}/>} panelWidth={420} panelHeightEstimate={900}>
          <CardView defId={runtime.general.defId} size="sm" dimmed={runtime.general.zone!=="battlefield"}/>
        </Tooltip>
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/85 px-1.5 py-0.5 text-[7px] font-black text-amber-100">GENERAL · {runtime.general.castCount}x</span>
      </div>
    </div>

    <div className={`absolute z-20 flex gap-1 opacity-80 transition-opacity hover:opacity-100 ${position==="top"?"left-20 top-2":position==="bottom"?"bottom-2 left-20":position==="left"?"bottom-2 left-2": "right-2 top-20"}`}>
      <div className="grid h-10 w-7 place-items-center rounded-md border border-white/10 bg-cover bg-center text-[8px] font-black text-white shadow-lg" style={{backgroundImage:"url('/art/ui/runeforge-card-back.svg')"}} title="Deck">{runtime.deckCount}</div>
      <button type="button" onClick={()=>setGraveOpen(true)} className="relative grid h-10 w-7 place-items-center overflow-hidden rounded-md border border-white/10 bg-slate-950/85 text-[8px] font-black text-slate-100 shadow-lg" title={graveTop?nameOf(graveTop.defId,collection):"Cemitério vazio"} data-commander-graveyard="pile">
        {graveTop?<div className="pointer-events-none scale-[.42]"><CardView defId={graveTop.defId} size="sm" dimmed/></div>:<span className="text-base">☠</span>}
        <span className="absolute bottom-0 right-0 rounded-tl bg-black/90 px-1">☠ {runtime.graveyard.length}</span>
      </button>
    </div>

    <div className={`absolute inset-0 flex min-h-0 min-w-0 items-center justify-center ${vertical?"px-3 py-10":"px-24 py-7"}`} data-commander-zone="battlefield">
      <div className={`flex h-full w-full max-h-full max-w-full items-center justify-center gap-1 ${vertical?"flex-wrap content-center":"flex-wrap content-center"}`}>
        {battlefield.length?groupEquivalentBattlefieldObjects(battlefield,declaredAttackerIds,declaredBlockerIds,incomingAttackerIds,attackableIds,blockableIds).map(group=>{
          const object=group[0];
          const attackable=isViewer&&attackableIds.has(object.id);
          const blockable=isViewer&&blockableIds.has(object.id);
          const incoming=incomingAttackerIds.has(object.id);
          const incomingTarget=Boolean(!isViewer&&incoming&&selectedBlockerId);
          const motion:CombatMotion=declaredBlockerIds.has(object.id)?"blocking":declaredAttackerIds.has(object.id)?"attacking":null;
          const onClick=attackable?()=>onSelectAttacker(object.id):blockable?()=>onSelectBlocker(object.id):incomingTarget?()=>onTargetIncomingAttacker(object.id):undefined;
          return <div key={group.map(item=>item.id).join(":")} className="group/stack relative shrink-0" data-commander-visual-stack={group.length} data-commander-stack-instance-ids={group.map(item=>item.id).join(",")}>
            {group.length>1&&<>
              {group.slice(1,Math.min(group.length,5)).map((copy,index)=>{
                const copyAttackable=isViewer&&attackableIds.has(copy.id);
                const copyBlockable=isViewer&&blockableIds.has(copy.id);
                const copyIncoming=incomingAttackerIds.has(copy.id);
                const copyIncomingTarget=Boolean(!isViewer&&copyIncoming&&selectedBlockerId);
                const copyMotion:CombatMotion=declaredBlockerIds.has(copy.id)?"blocking":declaredAttackerIds.has(copy.id)?"attacking":null;
                const copyClick=copyAttackable?()=>onSelectAttacker(copy.id):copyBlockable?()=>onSelectBlocker(copy.id):copyIncomingTarget?()=>onTargetIncomingAttacker(copy.id):undefined;
                return <div key={copy.id} className="pointer-events-none absolute inset-0 z-10 opacity-70 transition-all duration-200 group-hover/stack:pointer-events-auto group-hover/stack:opacity-100 group-focus-within/stack:pointer-events-auto group-focus-within/stack:opacity-100" style={{transform:`translate(${(index+1)*6}px,${-(index+1)*5}px)`}} data-commander-stack-copy={copy.id}>
                  <div className="transition-transform duration-200 group-hover/stack:translate-x-[var(--stack-fan-x)] group-focus-within/stack:translate-x-[var(--stack-fan-x)]" style={{["--stack-fan-x" as string]:`${(index+1)*34}px`}}>
                    <BattlefieldCard object={copy} collection={collection}
                      selected={copy.id===selectedAttackerId||copy.id===selectedBlockerId} targetable={copyIncomingTarget}
                      onClick={busy?undefined:copyClick}
                      badge={copyIncoming?"ATACANDO VOCÊ":copyMotion==="blocking"?"INTERCEPTANDO":copyAttackable?"ATACANTE":copyBlockable?"BLOQUEADOR":undefined}
                      position={position} motion={copyMotion} damage={objectDamage[copy.id]} barrierBroken={barrierBrokenIds.has(copy.id)}/>
                  </div>
                </div>;
              })}
              <span className="pointer-events-none absolute -right-3 -top-3 z-30 rounded-full border border-cyan-100/30 bg-slate-950/95 px-2 py-0.5 text-[9px] font-black text-cyan-50 shadow-xl" title={`${group.length} cópias equivalentes`}>×{group.length}</span>
            </>}
            <div className="relative z-20">
              <BattlefieldCard object={object} collection={collection}
                selected={group.some(item=>item.id===selectedAttackerId||item.id===selectedBlockerId)} targetable={incomingTarget}
                onClick={busy?undefined:onClick}
                badge={incoming?"ATACANDO VOCÊ":motion==="blocking"?"INTERCEPTANDO":attackable?"ATACANTE":blockable?"BLOQUEADOR":undefined}
                position={position} motion={motion} damage={objectDamage[object.id]} barrierBroken={barrierBrokenIds.has(object.id)}/>
            </div>
          </div>;
        }):<span className="text-[8px] uppercase tracking-[.28em] text-white/10">zona de batalha</span>}
      </div>
    </div>

    <div className={`absolute z-20 ${position==="top"?"left-1/2 top-8 -translate-x-1/2":position==="bottom"?"bottom-8 left-1/2 -translate-x-1/2":position==="left"?"left-8 top-1/2 -translate-y-1/2": "right-8 top-1/2 -translate-y-1/2"}`}>
      {isViewer&&runtime.hand?<VisibleHand cards={runtime.hand} playableIds={playableHandIds} onPlay={onPlayHandCard}/>:<HiddenHand count={runtime.handCount}/>}
    </div>

    {graveOpen&&<div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-8 backdrop-blur-sm" onClick={()=>setGraveOpen(false)} data-commander-graveyard-overlay={runtime.seat}>
      <div className="max-h-[72vh] w-[min(860px,90vw)] overflow-auto rounded-2xl border border-white/15 bg-slate-950/95 p-5 shadow-2xl" onClick={event=>event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between"><div><b className="text-white">Cemitério · P{runtime.seat+1}</b><p className="text-xs text-slate-500">{runtime.graveyard.length} carta(s)</p></div><button type="button" className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300" onClick={()=>setGraveOpen(false)}>Fechar</button></div>
        <div className="flex flex-wrap gap-3">{runtime.graveyard.length?runtime.graveyard.map(card=><CardView key={card.instanceId} defId={card.defId} size="sm"/>):<span className="text-sm text-slate-600">Cemitério vazio.</span>}</div>
      </div>
    </div>}
  </section>;
}
function AttackOverlay({combat,viewer}:{combat:CombatState;viewer:number}){
  const blockerByAttacker=new Map(combat.combat.blockers.map(block=>[block.attackerId,block] as const));
  return <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" data-commander-attack-fx="authoritative">
    <defs>
      <linearGradient id="commander-attack-beam" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="rgba(251,191,36,.2)"/>
        <stop offset="45%" stopColor="rgba(251,113,133,.95)"/>
        <stop offset="100%" stopColor="rgba(244,63,94,.7)"/>
      </linearGradient>
      <linearGradient id="commander-block-beam" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="rgba(34,211,238,.2)"/>
        <stop offset="60%" stopColor="rgba(103,232,249,.95)"/>
        <stop offset="100%" stopColor="rgba(186,230,253,.75)"/>
      </linearGradient>
      <filter id="commander-attack-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation=".8" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <marker id="commander-arrow" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0,0 L5,2.5 L0,5 z" fill="rgba(251,113,133,.95)"/></marker>
      <marker id="commander-block-arrow" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0,0 L5,2.5 L0,5 z" fill="rgba(103,232,249,.95)"/></marker>
    </defs>
    {combat.combat.attackers.map((attack,index)=>{
      const from=anchor[relativePosition(attack.controllerSeat,viewer)];
      const defender=anchor[relativePosition(attack.defendingSeat,viewer)];
      const blocker=blockerByAttacker.get(attack.unitId);
      const impact=blocker
        ? {x:from.x+(defender.x-from.x)*.66,y:from.y+(defender.y-from.y)*.66}
        : defender;
      const midX=(from.x+impact.x)/2;
      const midY=(from.y+impact.y)/2;
      return <g key={attack.unitId+":"+index} data-commander-attack-route={attack.unitId} data-commander-attack-blocked={blocker?true:undefined}>
        <line x1={from.x} y1={from.y} x2={impact.x} y2={impact.y} stroke="rgba(244,63,94,.18)" strokeWidth="2.2" filter="url(#commander-attack-glow)"/>
        <line x1={from.x} y1={from.y} x2={impact.x} y2={impact.y} stroke="url(#commander-attack-beam)" strokeWidth=".85" strokeDasharray="3 1.8" markerEnd="url(#commander-arrow)">
          <animate attributeName="stroke-dashoffset" from="9" to="0" dur=".85s" repeatCount="indefinite"/>
        </line>
        <circle cx={from.x} cy={from.y} r="1" fill="rgba(251,191,36,.9)" filter="url(#commander-attack-glow)">
          <animate attributeName="cx" from={String(from.x)} to={String(impact.x)} dur="1.15s" repeatCount="indefinite"/>
          <animate attributeName="cy" from={String(from.y)} to={String(impact.y)} dur="1.15s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0;1;1;0" dur="1.15s" repeatCount="indefinite"/>
        </circle>
        {blocker&&<>
          <line
            x1={defender.x}
            y1={defender.y}
            x2={impact.x}
            y2={impact.y}
            stroke="url(#commander-block-beam)"
            strokeWidth=".75"
            strokeDasharray="2 1.5"
            markerEnd="url(#commander-block-arrow)"
            data-commander-block-route={blocker.unitId}
          >
            <animate attributeName="stroke-dashoffset" from="7" to="0" dur=".7s" repeatCount="indefinite"/>
          </line>
          <circle cx={impact.x} cy={impact.y} r="2" fill="rgba(8,145,178,.55)" stroke="rgba(207,250,254,.95)" strokeWidth=".45">
            <animate attributeName="r" values="2;5;2" dur="1s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values="1;.2;1" dur="1s" repeatCount="indefinite"/>
          </circle>
        </>}
        {!blocker&&<circle cx={impact.x} cy={impact.y} r="1.5" fill="rgba(251,113,133,.35)" stroke="rgba(254,202,202,.9)" strokeWidth=".3">
          <animate attributeName="r" values="1.5;4.5;1.5" dur="1.15s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values=".9;0;.9" dur="1.15s" repeatCount="indefinite"/>
        </circle>}
        <circle cx={midX} cy={midY} r="1.8" fill="rgba(2,6,23,.9)" stroke={blocker?"rgba(103,232,249,.8)":"rgba(251,113,133,.75)"} strokeWidth=".35"/>
      </g>;
    })}
  </svg>;
}
function ResolutionDepartureFx({departures}:{departures:ResolutionDeparture[]}){
  if(!departures.length)return null;
  return <div className="pointer-events-none absolute left-1/2 top-1/2 z-50 flex -translate-x-1/2 -translate-y-1/2 gap-3" data-commander-departure-fx="authoritative">
    {departures.slice(0,4).map((entry,index)=><div key={entry.id} className="relative animate-bounce" style={{animationDelay:`${index*90}ms`}}>
      <CardView defId={entry.defId} size="sm" dimmed/>
      <span className="absolute -bottom-2 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/15 bg-slate-950/95 px-2 py-0.5 text-[8px] font-black uppercase text-slate-100 shadow-xl" data-commander-departure={entry.destination}>
        {entry.destination==="graveyard"?"→ CEMITÉRIO":"→ GENERAL ZONE"}
      </span>
    </div>)}
  </div>;
}

function StackCore({combat,collection,targetableStackIds,onTargetStackItem}:{combat:CombatState;collection:CollectionCard[];targetableStackIds:Set<string>;onTargetStackItem?:(id:string)=>void}){
  const items=[...combat.stack].reverse();
  const visible=items.slice(0,4);
  const top=visible[0];
  return <div className="group relative z-30 flex min-w-28 items-center justify-center" data-commander-stack-depth={visible.length}>
    <div className={`relative flex items-center gap-2 rounded-full border px-3 py-2 backdrop-blur-md transition-all ${items.length?"border-violet-200/35 bg-violet-950/75 shadow-[0_0_34px_rgba(124,58,237,.2)]":"border-white/8 bg-black/45 opacity-60"}`}>
      <span className="text-[8px] font-black uppercase tracking-[.2em] text-violet-200/70">STACK</span>
      <b className="grid h-6 min-w-6 place-items-center rounded-full bg-violet-300/10 px-1.5 text-xs text-violet-50">{items.length}</b>
      {top&&(targetableStackIds.has(top.id)&&onTargetStackItem?<button type="button" className="max-w-36 truncate text-[9px] font-black text-violet-50 underline decoration-violet-300/40 underline-offset-2" onClick={()=>onTargetStackItem(top.id)}>{top.abilityDescription||nameOf(top.defId,collection)||top.actionKind}</button>:<span className="max-w-36 truncate text-[9px] text-slate-200">{top.abilityDescription||nameOf(top.defId,collection)||top.actionKind}</span>)}
    </div>
    <div className="absolute left-1/2 top-full z-50 mt-2 hidden -translate-x-1/2 group-hover:block" data-commander-stack-cards="physical">
      <div className="relative h-40 w-40 rounded-2xl border border-violet-200/15 bg-slate-950/95 p-3 shadow-2xl backdrop-blur-xl">
        <p className="text-center text-[7px] font-black uppercase tracking-[.22em] text-violet-300/60">NEXUS DA STACK · {combat.phase} · P{combat.prioritySeat+1}</p>
        {visible.length?visible.map((item,index)=>{
          const hasCard=Boolean(item.defId&&collection.some(card=>card.defId===item.defId));
          const targetable=targetableStackIds.has(item.id)&&Boolean(onTargetStackItem);
          return <div key={item.id} role={targetable?"button":undefined} tabIndex={targetable?0:undefined} aria-label={targetable?`Selecionar ${nameOf(item.defId,collection)||item.actionKind||"item"} na stack`:undefined} className={`absolute left-1/2 top-8 ${targetable?"cursor-pointer ring-2 ring-violet-300/70 hover:ring-violet-100":""}`} style={{transform:`translate(calc(-50% + ${index*7}px), ${index*7}px) rotate(${[0,-7,6,-3][index]??0}deg) scale(${.72-index*.05})`,zIndex:40-index}} data-commander-stack-item={item.id} data-commander-stack-top={index===0||undefined} onClick={targetable?()=>onTargetStackItem?.(item.id):undefined} onKeyDown={targetable?(event)=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();onTargetStackItem?.(item.id);}}:undefined}>
            {hasCard&&item.defId?<CardView defId={item.defId} size="sm" dimmed={index>0}/>:<div className="grid h-28 w-20 place-items-center rounded-xl border border-violet-200/25 bg-violet-950/90 p-2 text-[8px] font-black text-violet-50">{item.abilityDescription||item.actionKind||"AÇÃO"}</div>}
            {item.uncounterable&&<span className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-amber-950/95 px-2 py-0.5 text-[7px] font-black text-amber-100">NÃO ANULÁVEL</span>}
          </div>;
        }):<div className="grid h-full place-items-center text-[8px] uppercase tracking-widest text-slate-700">stack vazia</div>}
      </div>
    </div>
  </div>;
}
export default function CommanderBattlefield4P({
  room,combat,collection,busy,onDeclareAttacker,onDeclareBlocker,nexusTargetSeats=[],onTargetNexusSeat,playableHandInstanceIds=[],onPlayHandCard,targetableStackIds=[],onTargetStackItem,
}:{
  room:Room;combat:CombatState;collection:CollectionCard[];busy:boolean;
  onDeclareAttacker:(unitId:string,defendingSeat:number)=>void|Promise<void>;
  onDeclareBlocker:(unitId:string,attackerId:string)=>void|Promise<void>;
  nexusTargetSeats?:number[];
  onTargetNexusSeat?:(seat:number)=>void|Promise<void>;
  playableHandInstanceIds?:string[];
  onPlayHandCard?:(card:ProjectedCard)=>void;
  targetableStackIds?:string[];
  onTargetStackItem?:(id:string)=>void;
}){
  const viewer=room.viewerSeat??0;
  const [selectedAttackerId,setSelectedAttackerId]=useState<string|null>(null);
  const [selectedBlockerId,setSelectedBlockerId]=useState<string|null>(null);
  const previousCombatRef=useRef<CombatState|null>(null);
  const battlefieldScrollRef=useRef<HTMLElement|null>(null);
  const [cameraZoom,setCameraZoom]=useState<80|90|100>(100);
  const [resolutionFx,setResolutionFx]=useState<ResolutionFx|null>(null);
  useEffect(()=>{
    const previous=previousCombatRef.current;
    previousCombatRef.current=combat;
    if(!previous||combat.revision<=previous.revision)return;
    const nextFx=deriveAuthoritativeResolutionFx(previous,combat);
    if(!nextFx)return;
    setResolutionFx(nextFx);
    const timer=window.setTimeout(()=>setResolutionFx(current=>current?.revision===nextFx.revision?null:current),1400);
    return ()=>window.clearTimeout(timer);
  },[combat]);
  const seatByPosition=new Map<Position,CombatSeat>();
  for(const runtime of combat.seats)seatByPosition.set(relativePosition(runtime.seat,viewer),runtime);

  const viewerRuntime=combat.seats.find(seat=>seat.seat===viewer);
  const assignedAttackerIds=new Set(combat.combat.attackers.map(attack=>attack.unitId));
  const assignedBlockerIds=new Set(combat.combat.blockers.map(block=>block.unitId));
  const blockedAttackerIds=new Set(combat.combat.blockers.map(block=>block.attackerId));
  const canCombatInteract=combat.phase==="combat"&&combat.prioritySeat===viewer&&!viewerRuntime?.eliminated;
  const viewerIsActive=combat.activeSeat===viewer;
  const attackableIds=new Set(
    (canCombatInteract&&viewerIsActive?(viewerRuntime?.battlefield||[]):[])
      .filter(object=>["unit","general","token"].includes(object.kind))
      .filter(object=>Boolean(object.combat&&object.combat.health>0))
      .filter(object=>!object.stunned&&!object.attackedThisTurn&&!assignedAttackerIds.has(object.id))
      .filter(object=>object.enteredTurn<combat.turn||object.keywords.includes("Haste"))
      .map(object=>object.id),
  );
  const incomingAttackers=combat.combat.attackers.filter(attack=>attack.defendingSeat===viewer&&!blockedAttackerIds.has(attack.unitId));
  const incomingAttackerIds=new Set(incomingAttackers.map(attack=>attack.unitId));
  const blockableIds=new Set(
    (canCombatInteract&&!viewerIsActive&&incomingAttackers.length?(viewerRuntime?.battlefield||[]):[])
      .filter(object=>["unit","general","token"].includes(object.kind))
      .filter(object=>Boolean(object.combat&&object.combat.health>0))
      .filter(object=>!object.stunned&&!assignedBlockerIds.has(object.id))
      .map(object=>object.id),
  );

  function focusCamera(target:"table"|"stack"|"self"){
    const root=battlefieldScrollRef.current;
    if(!root)return;
    if(target==="table"){
      root.scrollTo({left:Math.max(0,(root.scrollWidth-root.clientWidth)/2),behavior:"smooth"});
      return;
    }
    const selector=target==="stack"
      ? '[data-commander-stack-depth]'
      : `[data-commander-seat="${viewer}"]`;
    root.querySelector<HTMLElement>(selector)?.scrollIntoView({behavior:"smooth",block:"nearest",inline:"center"});
  }

  async function commitAttack(defendingSeat:number){
    if(!selectedAttackerId||busy)return;
    const unitId=selectedAttackerId;
    setSelectedAttackerId(null);
    await onDeclareAttacker(unitId,defendingSeat);
  }
  async function commitBlock(attackerId:string){
    if(!selectedBlockerId||busy)return;
    const unitId=selectedBlockerId;
    setSelectedBlockerId(null);
    await onDeclareBlocker(unitId,attackerId);
  }

  return <section ref={battlefieldScrollRef} className="relative h-full w-full overflow-hidden bg-[#17110d] shadow-[inset_0_0_150px_rgba(0,0,0,.75)]" data-commander-arena="unified-v2" data-commander-battlefield="cinematic-v1" data-commander-camera-zoom={cameraZoom}>
    <div className="pointer-events-none absolute inset-0 opacity-70" style={{backgroundImage:"radial-gradient(ellipse at 50% 45%, rgba(161,113,59,.24), transparent 57%), repeating-linear-gradient(0deg, transparent 0px, transparent 90px, rgba(0,0,0,.19) 91px, rgba(222,178,107,.045) 93px), repeating-linear-gradient(90deg, rgba(0,0,0,.06) 0px, rgba(0,0,0,.06) 3px, transparent 5px, transparent 115px)",backgroundSize:"auto, auto, auto"}}/>
    <div className="pointer-events-none absolute inset-[9%] rounded-[22%] border-2 border-amber-200/[.12] shadow-[inset_0_0_75px_rgba(0,0,0,.45),0_0_40px_rgba(116,68,29,.10)]"/>
    <div className="absolute left-3 top-3 z-50 flex w-fit flex-wrap items-center gap-1 rounded-full border border-amber-200/20 bg-[#211811]/95 p-1 shadow-xl backdrop-blur-md" data-commander-camera-controls="local">
      <button type="button" className="rounded-full px-2 py-1 text-[8px] font-black uppercase tracking-wide text-cyan-100 hover:bg-cyan-200/10" onClick={()=>focusCamera("table")}>Mesa</button>
      <button type="button" className="rounded-full px-2 py-1 text-[8px] font-black uppercase tracking-wide text-violet-100 hover:bg-violet-200/10" onClick={()=>focusCamera("stack")}>Stack</button>
      <button type="button" className="rounded-full px-2 py-1 text-[8px] font-black uppercase tracking-wide text-amber-100 hover:bg-amber-200/10" onClick={()=>focusCamera("self")}>Meu campo</button>
      <span className="mx-1 h-4 w-px bg-white/10"/>
      {([80,90,100] as const).map(level=><button
        key={level}
        type="button"
        className={`rounded-full px-2 py-1 text-[8px] font-black ${cameraZoom===level?"bg-white/10 text-white":"text-slate-500 hover:text-slate-200"}`}
        aria-pressed={cameraZoom===level}
        onClick={()=>setCameraZoom(level)}
      >{level}%</button>)}
    </div>
    <AttackOverlay combat={combat} viewer={viewer}/>
    <CommanderPhaserRuntime
      combat={{
        revision:combat.revision,
        prioritySeat:combat.prioritySeat,
        activeSeat:combat.activeSeat,
        turn:combat.turn,
        round:combat.round,
        phase:combat.phase,
        status:combat.status,
        winnerSeat:combat.winnerSeat,
        eliminatedSeats:combat.seats.filter(seat=>seat.eliminated).map(seat=>seat.seat),
        reactionWindowOpen:combat.stack.length>0,
        attackers:combat.combat.attackers,
        blockers:combat.combat.blockers,
      }}
      resolutionFx={resolutionFx}
      stack={combat.stack}
      hand={(combat.seats.find(seat=>seat.seat===viewer)?.hand||[]).map(card=>({
        instanceId:card.instanceId,
        defId:card.defId,
        ...phaserCardIdentity(card.defId),
      }))}
      permanents={{
        revision:combat.revision,
        seats:combat.seats.map(seat=>({
          seat:seat.seat,
          nexusHealth:seatLife(seat),
          eliminated:seat.eliminated,
          general:{...seat.general,...phaserCardIdentity(seat.general.defId)},
          battlefield:(seat.battlefield||[]).map(object=>({
            ...phaserCardIdentity(object.defId),
            id:object.id,
            defId:object.defId,
            kind:object.kind,
            controllerSeat:object.controllerSeat,
            power:object.combat?.power??null,
            health:object.combat?.health??null,
            maxHealth:object.combat?.maxHealth??null,
            durability:object.durability?.health??null,
            maxDurability:object.durability?.maxHealth??null,
            barrier:object.combat?.barrier??false,
            frostbitten:object.combat?.frostbitten??false,
            stunned:object.stunned,
            attackedThisTurn:object.attackedThisTurn,
            loyalty:object.loyalty??null,
            equipmentCount:object.equipment.length,
          })),
        })),
      }}
      targetingFx={{
        selectedKind:selectedAttackerId?"attacker":selectedBlockerId?"blocker":null,
        selectedId:selectedAttackerId||selectedBlockerId,
        targetSeats:selectedAttackerId
          ? combat.seats.filter(seat=>seat.seat!==viewer&&!seat.eliminated).map(seat=>seat.seat)
          : [],
        targetAttackerSeats:selectedBlockerId
          ? Array.from(new Set(incomingAttackers.map(attack=>attack.controllerSeat)))
          : [],
      }}
      viewerSeat={viewer}
    />
    <ResolutionDepartureFx departures={resolutionFx?.departures||[]}/>
    {(selectedAttackerId||selectedBlockerId)&&<div className="sticky left-4 top-4 z-40 w-fit rounded-full border border-cyan-200/25 bg-slate-950/95 px-3 py-1.5 text-[9px] font-black uppercase tracking-[.14em] text-cyan-100 shadow-xl">
      {selectedAttackerId?"Atacante selecionado · escolha um Nexus inimigo":"Bloqueador selecionado · escolha um atacante contra você"}
      <button type="button" className="ml-3 text-slate-500 underline" onClick={()=>{setSelectedAttackerId(null);setSelectedBlockerId(null);}}>Cancelar</button>
    </div>}
    <div
      className={`relative z-20 grid h-full w-full origin-center grid-cols-[minmax(190px,.72fr)_minmax(480px,2.6fr)_minmax(190px,.72fr)] grid-rows-[minmax(150px,.64fr)_minmax(260px,1.8fr)_minmax(205px,.88fr)] gap-0 px-1 pb-1 pt-8 transition-transform duration-300 ${cameraZoom===80?"scale-[.80]":cameraZoom===90?"scale-90":"scale-100"}`}
      data-commander-camera-surface="table"
    >
      {(["top","left","right","bottom"] as Position[]).map(position=>{
        const runtime=seatByPosition.get(position);
        if(!runtime)return null;
        const seat=room.seats.find(item=>item.seat===runtime.seat);
        return <div key={position} className={gridClass[position]}>
          <SeatZone
            position={position}
            seat={seat}
            runtime={runtime}
            collection={collection}
            isViewer={runtime.seat===viewer}
            isActive={runtime.seat===combat.activeSeat}
            hasPriority={runtime.seat===combat.prioritySeat}
            attackableIds={attackableIds}
            blockableIds={blockableIds}
            incomingAttackerIds={incomingAttackerIds}
            declaredAttackerIds={assignedAttackerIds}
            declaredBlockerIds={assignedBlockerIds}
            selectedAttackerId={selectedAttackerId}
            selectedBlockerId={selectedBlockerId}
            nexusDamage={resolutionFx?.nexusDamage[runtime.seat]||0}
            objectDamage={resolutionFx?.objectDamage||{}}
            barrierBrokenIds={new Set(resolutionFx?.barrierBroken||[])}
            canTargetNexus={Boolean((selectedAttackerId&&runtime.seat!==viewer&&!runtime.eliminated)||nexusTargetSeats.includes(runtime.seat))}
            onTargetNexus={()=>void (selectedAttackerId?commitAttack(runtime.seat):onTargetNexusSeat?.(runtime.seat))}
            onSelectAttacker={(id)=>{setSelectedAttackerId(current=>current===id?null:id);setSelectedBlockerId(null);}}
            onSelectBlocker={(id)=>{setSelectedBlockerId(current=>current===id?null:id);setSelectedAttackerId(null);}}
            onTargetIncomingAttacker={(id)=>void commitBlock(id)}
            playableHandIds={new Set(playableHandInstanceIds)}
            onPlayHandCard={onPlayHandCard}
            busy={busy}
          />
        </div>;
      })}
      <div className="pointer-events-auto col-start-2 row-start-2 place-self-center"><StackCore combat={combat} collection={collection} targetableStackIds={new Set(targetableStackIds)} onTargetStackItem={onTargetStackItem}/></div>
    </div>
  </section>;
}
