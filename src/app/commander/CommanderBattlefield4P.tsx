"use client";

import { useEffect, useRef, useState } from "react";
import CardView from "@/components/CardView";

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
  abilityDescription?:string|null; uncounterable:boolean;
};
type CombatState = {
  revision:number; activeSeat:number; prioritySeat:number; phase:string; turn:number;
  seats:CombatSeat[]; stack:StackItem[];
  combat:{attackers:{unitId:string;controllerSeat:number;defendingSeat:number}[];blockers:{unitId:string;controllerSeat:number;attackerId:string}[]};
};
type Seat = {seat:number;playerName:string;isHost:boolean};
type Room = {viewerSeat:number|null;seats:Seat[]};
type CollectionCard = {defId:string;name:string};

type Position="bottom"|"left"|"top"|"right";
const positionOrder:Position[]=["bottom","left","top","right"];
const gridClass:Record<Position,string>={
  top:"col-start-2 row-start-1 self-start",
  left:"col-start-1 row-start-2 self-center justify-self-start",
  right:"col-start-3 row-start-2 self-center justify-self-end",
  bottom:"col-start-2 row-start-3 self-end",
};
const anchor:Record<Position,{x:number;y:number}>={
  top:{x:50,y:17},
  left:{x:17,y:50},
  right:{x:83,y:50},
  bottom:{x:50,y:83},
};

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
  nexusDamage:Record<number,number>;
  objectDamage:Record<string,number>;
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
      if(typeof beforeHealth==="number"&&typeof afterHealth==="number"&&afterHealth<beforeHealth)objectDamage[id]=beforeHealth-afterHealth;
      if(before.object.combat?.barrier===true&&after.object.combat?.barrier===false)barrierBroken.push(id);
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
    ? {revision:current.revision,nexusDamage,objectDamage,barrierBroken,departures}
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
    <CardView defId={object.defId} size="sm" attacking={object.attackedThisTurn} selected={selected} targetable={targetable} onClick={onClick}/>
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

function VisibleHand({cards}:{cards:ProjectedCard[]}){
  const shown=cards.slice(0,7);
  return <div className="flex min-h-16 items-end justify-center overflow-x-auto px-2" aria-label={`${cards.length} cartas na sua mão`}>
    {shown.map((card,index)=><div key={card.instanceId} className="-ml-5 first:ml-0 origin-bottom transition-transform hover:z-30 hover:-translate-y-3" style={{transform:`rotate(${(index-(shown.length-1)/2)*3.5}deg)`}}>
      <CardView defId={card.defId} size="sm"/>
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
  canTargetNexus,onTargetNexus,onSelectAttacker,onSelectBlocker,onTargetIncomingAttacker,busy,
}:{
  position:Position;seat:Seat|undefined;runtime:CombatSeat;collection:CollectionCard[];isViewer:boolean;isActive:boolean;hasPriority:boolean;
  attackableIds:Set<string>;blockableIds:Set<string>;incomingAttackerIds:Set<string>;declaredAttackerIds:Set<string>;declaredBlockerIds:Set<string>;
  selectedAttackerId:string|null;selectedBlockerId:string|null;nexusDamage:number;objectDamage:Record<string,number>;barrierBrokenIds:Set<string>;
  canTargetNexus:boolean;onTargetNexus?:()=>void;
  onSelectAttacker:(id:string)=>void;onSelectBlocker:(id:string)=>void;onTargetIncomingAttacker:(id:string)=>void;busy:boolean;
}){
  const battlefield=runtime.battlefield||[];
  const playerName=seat?.playerName||`P${runtime.seat+1}`;
  const graveTop=runtime.graveyard.at(-1);
  return <section
    className={`w-[min(38vw,460px)] min-w-0 rounded-[1.4rem] border bg-slate-950/82 p-3 shadow-2xl backdrop-blur-sm transition ${hasPriority?"border-cyan-200/65 shadow-cyan-900/20":isActive?"border-amber-200/45 shadow-amber-900/20":"border-white/10"} ${runtime.eliminated?"opacity-45 grayscale":""}`}
    data-commander-seat={runtime.seat}
    data-commander-position={position}
  >
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <b className="truncate text-xs text-white">P{runtime.seat+1} · {playerName}</b>
          {isViewer&&<span className="rounded-full border border-cyan-200/25 px-1.5 py-0.5 text-[8px] font-black uppercase text-cyan-100">VOCÊ</span>}
        </div>
        <div className="mt-1 flex flex-wrap gap-2 text-[9px] uppercase tracking-wide text-slate-500">
          {isActive&&<span className="text-amber-200">TURNO</span>}
          {hasPriority&&<span className="text-cyan-200">PRIORIDADE</span>}
          {runtime.eliminated&&<span className="text-rose-300">ELIMINADO</span>}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1 text-center text-[9px]">
        <button
          type="button"
          className={`rounded border px-2 py-1 transition ${canTargetNexus?"border-rose-200/55 bg-rose-900/35 text-rose-50 shadow-[0_0_18px_rgba(251,113,133,.14)]":"border-rose-300/15 bg-rose-950/25"}`}
          disabled={!canTargetNexus||busy}
          onClick={onTargetNexus}
          data-commander-nexus-target={canTargetNexus?runtime.seat:undefined}
        ><b className="block text-sm text-rose-100">{runtime.life??runtime.nexusHealth}</b>{canTargetNexus?"ATACAR":"NEXUS"}{nexusDamage>0&&<span className="absolute -right-2 -top-2 z-30 animate-ping rounded-full bg-rose-500 px-1.5 py-0.5 text-[9px] font-black text-white shadow-[0_0_20px_rgba(244,63,94,.65)]" data-commander-nexus-damage={nexusDamage}>-{nexusDamage}</span>}</button>
        <span className="rounded border border-cyan-300/15 bg-cyan-950/20 px-2 py-1"><b className="block text-sm text-cyan-100">{runtime.mana??0}/{runtime.maxMana??0}</b>MANA</span>
        <span className="rounded border border-violet-300/15 bg-violet-950/20 px-2 py-1"><b className="block text-sm text-violet-100">{runtime.spellMana??0}</b>✦</span>
      </div>
    </div>

    <div className="mt-3 grid grid-cols-[72px_minmax(0,1fr)_64px] items-center gap-2">
      <div className="relative">
        <CardView defId={runtime.general.defId} size="sm" dimmed={runtime.general.zone!=="battlefield"}/>
        <span className="absolute -bottom-1 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full border border-amber-200/20 bg-black/90 px-1.5 py-0.5 text-[8px] font-black text-amber-100">{runtime.general.zone} · {runtime.general.castCount}x</span>
      </div>

      <div className="min-w-0">
        <div className="flex min-h-32 items-center gap-2 overflow-x-auto overflow-y-hidden rounded-xl border border-white/8 bg-black/25 px-2 py-3">
          {battlefield.length?battlefield.map(object=>{
            const attackable=isViewer&&attackableIds.has(object.id);
            const blockable=isViewer&&blockableIds.has(object.id);
            const incoming=incomingAttackerIds.has(object.id);
            const incomingTarget=Boolean(!isViewer&&incoming&&selectedBlockerId);
            const motion:CombatMotion=declaredBlockerIds.has(object.id)?"blocking":declaredAttackerIds.has(object.id)?"attacking":null;
            const onClick=attackable
              ? ()=>onSelectAttacker(object.id)
              : blockable
                ? ()=>onSelectBlocker(object.id)
                : incomingTarget
                  ? ()=>onTargetIncomingAttacker(object.id)
                  : undefined;
            return <BattlefieldCard
              key={object.id}
              object={object}
              collection={collection}
              selected={object.id===selectedAttackerId||object.id===selectedBlockerId}
              targetable={incomingTarget}
              onClick={busy?undefined:onClick}
              badge={incoming?"ATACANDO VOCÊ":motion==="blocking"?"INTERCEPTANDO":attackable?"ATACANTE":blockable?"BLOQUEADOR":undefined}
              position={position}
              motion={motion}
              damage={objectDamage[object.id]}
              barrierBroken={barrierBrokenIds.has(object.id)}
            />;
          }):<span className="mx-auto text-[9px] uppercase tracking-[.18em] text-slate-700">campo vazio</span>}
        </div>
      </div>

      <div className="space-y-2 text-center text-[9px] text-slate-500">
        <div className="rounded-lg border border-white/10 bg-black/25 p-2">
          <div className="mx-auto h-9 w-6 rounded border border-white/15 bg-cover bg-center" style={{backgroundImage:"url('/art/ui/runeforge-card-back.svg')"}}/>
          <b className="mt-1 block text-slate-200">{runtime.deckCount}</b>DECK
        </div>
        <div className="rounded-lg border border-white/10 bg-black/25 p-2" title={graveTop?nameOf(graveTop.defId,collection):"Cemitério vazio"}>
          <span className="text-lg">☠</span><b className="block text-slate-200">{runtime.graveyard.length}</b>CEM.
        </div>
      </div>
    </div>

    <div className="mt-2 flex items-end justify-between gap-2">
      <div className="min-w-0 flex-1">{isViewer&&runtime.hand?<VisibleHand cards={runtime.hand}/>:<HiddenHand count={runtime.handCount}/>}</div>
      <span className="max-w-32 truncate text-right text-[9px] text-slate-600">{graveTop?`Topo do cemitério: ${nameOf(graveTop.defId,collection)}`:"Cemitério vazio"}</span>
    </div>
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

function StackCore({combat,collection}:{combat:CombatState;collection:CollectionCard[]}){
  const items=[...combat.stack].reverse();
  const visible=items.slice(0,4);
  return <div className="relative z-20 w-[min(32vw,300px)] rounded-[1.6rem] border border-violet-200/20 bg-[radial-gradient(circle_at_top,rgba(139,92,246,.25),rgba(2,6,23,.94)_70%)] p-4 text-center shadow-[0_0_70px_rgba(124,58,237,.18)]" data-commander-stack-depth={visible.length}>
    <div className="absolute inset-2 rounded-[1.2rem] border border-white/[.04]"/>
    <p className="relative text-[9px] font-black uppercase tracking-[.24em] text-violet-200/70">NEXUS DA STACK</p>
    <div className="relative mt-2 grid grid-cols-3 gap-1 text-[9px]">
      <span className="rounded border border-white/8 p-1"><b className="block text-amber-100">{combat.phase.toUpperCase()}</b>FASE</span>
      <span className="rounded border border-white/8 p-1"><b className="block text-cyan-100">P{combat.prioritySeat+1}</b>PRIO.</span>
      <span className="rounded border border-white/8 p-1"><b className="block text-slate-100">#{combat.turn}</b>TURNO</span>
    </div>
    <div className="relative mx-auto mt-4 h-40 w-40" data-commander-stack-cards="physical">
      {visible.length?visible.map((item,index)=>{
        const hasCard=Boolean(item.defId&&collection.some(card=>card.defId===item.defId));
        const rotation=[0,-8,7,-4][index]??0;
        const offset=index*8;
        return <div
          key={item.id}
          className={`absolute left-1/2 top-0 transition-all duration-300 ${index===0?"z-40 animate-pulse":"z-20 opacity-75"}`}
          style={{transform:`translate(calc(-50% + ${offset}px), ${offset}px) rotate(${rotation}deg) scale(${1-index*.055})`,transformOrigin:"50% 50%"}}
          data-commander-stack-item={item.id}
          data-commander-stack-top={index===0||undefined}
        >
          {hasCard&&item.defId
            ? <CardView defId={item.defId} size="sm" dimmed={index>0}/>
            : <div className="grid h-28 w-20 place-items-center rounded-xl border border-violet-200/25 bg-violet-950/90 p-2 text-[8px] font-black text-violet-50 shadow-xl">{item.abilityDescription||item.actionKind||"AÇÃO"}</div>}
          {index===0&&<span className="absolute -top-2 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-full border border-violet-200/35 bg-violet-950/95 px-2 py-0.5 text-[8px] font-black uppercase tracking-wide text-violet-100 shadow-lg">TOPO · P{item.controllerSeat+1}</span>}
          {item.uncounterable&&<span className="absolute -bottom-2 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-full border border-amber-200/30 bg-amber-950/95 px-2 py-0.5 text-[7px] font-black uppercase text-amber-100">NÃO ANULÁVEL</span>}
        </div>;
      }):<div className="grid h-full place-items-center text-[9px] uppercase tracking-[.18em] text-slate-700">stack vazia</div>}
    </div>
    {visible[0]&&<div className="relative mt-1 rounded-lg border border-violet-200/10 bg-black/25 px-2 py-1.5 text-left text-[9px]">
      <b className="block truncate text-violet-50">{visible[0].abilityDescription||nameOf(visible[0].defId,collection)||visible[0].actionKind}</b>
      <span className="text-slate-500">P{visible[0].controllerSeat+1} · {visible[0].speed||visible[0].actionKind}</span>
    </div>}
    {items.length>4&&<span className="relative mt-1 block text-[9px] text-violet-300/60">+{items.length-4} objeto(s)</span>}
    <div className="relative mt-2 text-[8px] uppercase tracking-[.2em] text-slate-600">rev {combat.revision}</div>
  </div>;
}

export default function CommanderBattlefield4P({
  room,combat,collection,busy,onDeclareAttacker,onDeclareBlocker,
}:{
  room:Room;combat:CombatState;collection:CollectionCard[];busy:boolean;
  onDeclareAttacker:(unitId:string,defendingSeat:number)=>void|Promise<void>;
  onDeclareBlocker:(unitId:string,attackerId:string)=>void|Promise<void>;
}){
  const viewer=room.viewerSeat??0;
  const [selectedAttackerId,setSelectedAttackerId]=useState<string|null>(null);
  const [selectedBlockerId,setSelectedBlockerId]=useState<string|null>(null);
  const previousCombatRef=useRef<CombatState|null>(null);
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

  return <section className="relative mt-5 overflow-x-auto overflow-y-hidden rounded-[2rem] border border-cyan-200/10 bg-[#02060b] p-3 shadow-[inset_0_0_90px_rgba(8,145,178,.06)]" data-commander-battlefield="cinematic-v1">
    <div className="pointer-events-none absolute inset-0 opacity-70" style={{backgroundImage:"radial-gradient(circle at center, rgba(34,211,238,.08), transparent 27%), linear-gradient(rgba(255,255,255,.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.018) 1px, transparent 1px)",backgroundSize:"auto, 42px 42px, 42px 42px"}}/>
    <div className="pointer-events-none absolute inset-[12%] rounded-[45%] border border-cyan-200/[.06] shadow-[0_0_90px_rgba(34,211,238,.05)]"/>
    <AttackOverlay combat={combat} viewer={viewer}/>
    <ResolutionDepartureFx departures={resolutionFx?.departures||[]}/>
    {(selectedAttackerId||selectedBlockerId)&&<div className="sticky left-4 top-4 z-40 w-fit rounded-full border border-cyan-200/25 bg-slate-950/95 px-3 py-1.5 text-[9px] font-black uppercase tracking-[.14em] text-cyan-100 shadow-xl">
      {selectedAttackerId?"Atacante selecionado · escolha um Nexus inimigo":"Bloqueador selecionado · escolha um atacante contra você"}
      <button type="button" className="ml-3 text-slate-500 underline" onClick={()=>{setSelectedAttackerId(null);setSelectedBlockerId(null);}}>Cancelar</button>
    </div>}
    <div className="relative z-20 grid min-h-[900px] min-w-[980px] grid-cols-[minmax(260px,1fr)_minmax(360px,1.5fr)_minmax(260px,1fr)] grid-rows-[minmax(240px,1fr)_minmax(260px,.9fr)_minmax(240px,1fr)] items-center gap-4">
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
            canTargetNexus={Boolean(selectedAttackerId&&runtime.seat!==viewer&&!runtime.eliminated)}
            onTargetNexus={()=>void commitAttack(runtime.seat)}
            onSelectAttacker={(id)=>{setSelectedAttackerId(current=>current===id?null:id);setSelectedBlockerId(null);}}
            onSelectBlocker={(id)=>{setSelectedBlockerId(current=>current===id?null:id);setSelectedAttackerId(null);}}
            onTargetIncomingAttacker={(id)=>void commitBlock(id)}
            busy={busy}
          />
        </div>;
      })}
      <div className="col-start-2 row-start-2 place-self-center"><StackCore combat={combat} collection={collection}/></div>
    </div>
  </section>;
}
