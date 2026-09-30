"use client";

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
function BattlefieldCard({object,collection}:{object:BattlefieldObject;collection:CollectionCard[]}){
  const stat=object.combat
    ? `${object.combat.power}/${object.combat.health}`
    : object.durability
      ? `${object.durability.health}/${object.durability.maxHealth}`
      : object.loyalty!==undefined
        ? `L${object.loyalty}`
        : "";
  return <div className="group relative shrink-0" data-commander-object={object.id}>
    <CardView defId={object.defId} size="sm" attacking={object.attackedThisTurn}/>
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
}:{
  position:Position;seat:Seat|undefined;runtime:CombatSeat;collection:CollectionCard[];isViewer:boolean;isActive:boolean;hasPriority:boolean;
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
        <span className="rounded border border-rose-300/15 bg-rose-950/25 px-2 py-1"><b className="block text-sm text-rose-100">{runtime.life??runtime.nexusHealth}</b>NEXUS</span>
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
          {battlefield.length?battlefield.map(object=><BattlefieldCard key={object.id} object={object} collection={collection}/>):<span className="mx-auto text-[9px] uppercase tracking-[.18em] text-slate-700">campo vazio</span>}
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
  return <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <marker id="commander-arrow" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0,0 L5,2.5 L0,5 z" fill="rgba(251,113,133,.9)"/></marker>
    </defs>
    {combat.combat.attackers.map((attack,index)=>{
      const from=anchor[relativePosition(attack.controllerSeat,viewer)];
      const to=anchor[relativePosition(attack.defendingSeat,viewer)];
      return <g key={attack.unitId+":"+index}>
        <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="rgba(251,113,133,.55)" strokeWidth="0.7" strokeDasharray="2 1.4" markerEnd="url(#commander-arrow)"/>
        <circle cx={(from.x+to.x)/2} cy={(from.y+to.y)/2} r="1.8" fill="rgba(2,6,23,.88)" stroke="rgba(251,113,133,.65)" strokeWidth=".35"/>
      </g>;
    })}
  </svg>;
}

function StackCore({combat,collection}:{combat:CombatState;collection:CollectionCard[]}){
  const items=[...combat.stack].reverse();
  return <div className="relative z-20 w-[min(30vw,280px)] rounded-[1.6rem] border border-violet-200/20 bg-[radial-gradient(circle_at_top,rgba(139,92,246,.22),rgba(2,6,23,.92)_70%)] p-4 text-center shadow-[0_0_60px_rgba(124,58,237,.14)]">
    <div className="absolute inset-2 rounded-[1.2rem] border border-white/[.04]"/>
    <p className="relative text-[9px] font-black uppercase tracking-[.24em] text-violet-200/70">NEXUS DA STACK</p>
    <div className="relative mt-2 grid grid-cols-3 gap-1 text-[9px]">
      <span className="rounded border border-white/8 p-1"><b className="block text-amber-100">{combat.phase.toUpperCase()}</b>FASE</span>
      <span className="rounded border border-white/8 p-1"><b className="block text-cyan-100">P{combat.prioritySeat+1}</b>PRIO.</span>
      <span className="rounded border border-white/8 p-1"><b className="block text-slate-100">#{combat.turn}</b>TURNO</span>
    </div>
    <div className="relative mt-3 min-h-20">
      {items.length?items.slice(0,4).map((item,index)=><div key={item.id} className={`mx-auto -mt-1 w-[92%] rounded-lg border px-2 py-2 text-left text-[9px] shadow-lg first:mt-0 ${index===0?"border-violet-200/45 bg-violet-950/80":"border-white/10 bg-slate-950/90"}`} style={{transform:`scale(${1-index*.035})`}}>
        <b className="block truncate text-violet-50">{index===0?"TOPO · ":""}{item.abilityDescription||nameOf(item.defId,collection)||item.actionKind}</b>
        <span className="text-slate-500">P{item.controllerSeat+1} · {item.speed||item.actionKind}{item.uncounterable?" · NÃO ANULÁVEL":""}</span>
      </div>):<div className="grid min-h-20 place-items-center text-[9px] uppercase tracking-[.18em] text-slate-700">stack vazia</div>}
      {items.length>4&&<span className="mt-1 block text-[9px] text-violet-300/60">+{items.length-4} objeto(s)</span>}
    </div>
    <div className="relative mt-3 text-[8px] uppercase tracking-[.2em] text-slate-600">rev {combat.revision}</div>
  </div>;
}

export default function CommanderBattlefield4P({
  room,combat,collection,
}:{
  room:Room;combat:CombatState;collection:CollectionCard[];
}){
  const viewer=room.viewerSeat??0;
  const seatByPosition=new Map<Position,CombatSeat>();
  for(const runtime of combat.seats)seatByPosition.set(relativePosition(runtime.seat,viewer),runtime);

  return <section className="relative mt-5 overflow-x-auto overflow-y-hidden rounded-[2rem] border border-cyan-200/10 bg-[#02060b] p-3 shadow-[inset_0_0_90px_rgba(8,145,178,.06)]" data-commander-battlefield="cinematic-v1">
    <div className="pointer-events-none absolute inset-0 opacity-70" style={{backgroundImage:"radial-gradient(circle at center, rgba(34,211,238,.08), transparent 27%), linear-gradient(rgba(255,255,255,.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.018) 1px, transparent 1px)",backgroundSize:"auto, 42px 42px, 42px 42px"}}/>
    <div className="pointer-events-none absolute inset-[12%] rounded-[45%] border border-cyan-200/[.06] shadow-[0_0_90px_rgba(34,211,238,.05)]"/>
    <AttackOverlay combat={combat} viewer={viewer}/>
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
          />
        </div>;
      })}
      <div className="col-start-2 row-start-2 place-self-center"><StackCore combat={combat} collection={collection}/></div>
    </div>
  </section>;
}
