"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  projectAuthoritativeCombatDelta,
  type AuthoritativeCombatProjection,
} from "@/game/presentation/phaser/BattlefieldAuthoritativeCombatAdapter";
import type { BattlefieldCombatPresentationFrame } from "@/game/presentation/phaser/BattlefieldCombatPresentation";
import {
  playBarrierBreakFx,
  playCombatLaneFx,
  playDamageImpactFx,
  playDepartureFx,
  playStackDepartureFx,
  playStackEntryFx,
} from "@/game/presentation/phaser/BattlefieldCombatFx";

type CombatProjection = {
  revision:number;
  prioritySeat:number;
  reactionWindowOpen:boolean;
  attackers:Array<{unitId:string;controllerSeat:number;defendingSeat:number}>;
  blockers:Array<{unitId:string;controllerSeat:number;attackerId:string}>;
};

export type CommanderPhaserPermanentSnapshot = {
  revision:number;
  seats:Array<{
    seat:number;
    nexusHealth:number;
    eliminated:boolean;
    general:{defId:string;zone:string;castCount:number};
    battlefield:Array<{
      id:string;defId:string;kind:string;controllerSeat:string;
      power:number|null;health:number|null;maxHealth:number|null;
      durability:number|null;maxDurability:number|null;
      barrier:boolean;frostbitten:boolean;stunned:boolean;attackedThisTurn:boolean;
      loyalty:number|null;equipmentCount:number;
    }>;
  }>;
};

export type CommanderPhaserTargetingFx = {
  selectedKind:"attacker"|"blocker"|null;
  selectedId:string|null;
  targetSeats:number[];
  targetAttackerSeats:number[];
};

export type CommanderPhaserStackItem = {
  id:string;
  controllerSeat:number;
  defId:string|null;
  speed:string|null;
  actionKind:string|null;
  uncounterable:boolean;
};

type CommanderPhaserStackFx = {
  revision:number;
  entered:CommanderPhaserStackItem[];
  departed:CommanderPhaserStackItem[];
};

export type CommanderPhaserResolutionFx = {
  revision:number;
  nexusDamage:Record<number,number>;
  objectDamage:Record<string,number>;
  objectSeats:Record<string,number>;
  barrierBroken:string[];
  departures:Array<{id:string;defId:string;seat:number;destination:"graveyard"|"general_zone"}>;
};

type PhaserGameHandle = {
  destroy:(removeCanvas?:boolean)=>void;
  events:{emit:(event:string,...args:unknown[])=>unknown};
  canvas?:HTMLCanvasElement;
};

const FRAME_EVENT="runeforged:commander:combat-frame";
const RESOLUTION_EVENT="runeforged:commander:resolution-fx";
const STACK_EVENT="runeforged:commander:stack-fx";
const PRIORITY_EVENT="runeforged:commander:priority-fx";
const TARGETING_EVENT="runeforged:commander:targeting-fx";
const PERMANENTS_EVENT="runeforged:commander:permanents";

function seatPoint(seat:number,viewerSeat:number){
  const points=[
    {x:490,y:760},
    {x:160,y:450},
    {x:490,y:140},
    {x:820,y:450},
  ];
  const relative=(seat-viewerSeat+4)%4;
  return points[relative]||points[0];
}

function collisionPoint(from:{x:number;y:number},to:{x:number;y:number}){
  return {
    x:from.x+(to.x-from.x)*.66,
    y:from.y+(to.y-from.y)*.66,
  };
}

function seatFxPoint(seat:number,viewerSeat:number,slot:number){
  const base=seatPoint(seat,viewerSeat);
  const offsets=[
    {x:0,y:-34},
    {x:30,y:0},
    {x:-30,y:0},
    {x:0,y:34},
  ];
  const offset=offsets[slot%offsets.length];
  return {x:base.x+offset.x,y:base.y+offset.y};
}

export default function CommanderPhaserRuntime({
  combat,
  resolutionFx,
  stack,
  targetingFx,
  permanents,
  viewerSeat,
}:{
  combat:CombatProjection;
  resolutionFx:CommanderPhaserResolutionFx|null;
  stack:CommanderPhaserStackItem[];
  targetingFx:CommanderPhaserTargetingFx;
  permanents:CommanderPhaserPermanentSnapshot;
  viewerSeat:number;
}){
  const hostRef=useRef<HTMLDivElement|null>(null);
  const gameRef=useRef<PhaserGameHandle|null>(null);
  const previousProjectionRef=useRef<AuthoritativeCombatProjection|null>(null);
  const queuedFramesRef=useRef<BattlefieldCombatPresentationFrame[]>([]);
  const queuedResolutionFxRef=useRef<CommanderPhaserResolutionFx[]>([]);
  const queuedStackFxRef=useRef<CommanderPhaserStackFx[]>([]);
  const lastResolutionRevisionRef=useRef<number|null>(null);
  const lastStackRevisionRef=useRef<number|null>(null);
  const previousStackRef=useRef<CommanderPhaserStackItem[]>([]);
  const stackInitializedRef=useRef(false);
  const lastPriorityRevisionRef=useRef<number|null>(null);
  const queuedPriorityFxRef=useRef<Array<{prioritySeat:number;reactionWindowOpen:boolean}>>([]);
  const queuedTargetingFxRef=useRef<CommanderPhaserTargetingFx[]>([]);
  const queuedPermanentsRef=useRef<CommanderPhaserPermanentSnapshot[]>([]);

  const projection=useMemo<AuthoritativeCombatProjection>(()=>({
    revision:combat.revision,
    attackers:combat.attackers.map(entry=>({
      unitId:entry.unitId,
      controllerSeat:entry.controllerSeat,
      defendingSeat:entry.defendingSeat,
    })),
    blockers:combat.blockers.map(entry=>({
      unitId:entry.unitId,
      controllerSeat:entry.controllerSeat,
      attackerId:entry.attackerId,
    })),
    resolution:resolutionFx?.revision===combat.revision?{revision:resolutionFx.revision}:null,
  }),[combat,resolutionFx]);

  useEffect(()=>{
    let disposed=false;
    lastResolutionRevisionRef.current=null;
    lastStackRevisionRef.current=null;
    stackInitializedRef.current=false;
    lastPriorityRevisionRef.current=null;
    const host=hostRef.current;
    if(!host)return;

    void import("phaser").then((Phaser)=>{
      if(disposed||!host)return;

      class CommanderPresentationScene extends Phaser.Scene {
        private headline?:InstanceType<typeof Phaser.GameObjects.Text>;
        private detail?:InstanceType<typeof Phaser.GameObjects.Text>;

        create(){
          this.headline=this.add.text(490,410,"",{
            fontFamily:"system-ui, sans-serif",
            fontSize:"24px",
            fontStyle:"bold",
            color:"#e2e8f0",
            stroke:"#020617",
            strokeThickness:6,
          }).setOrigin(.5).setAlpha(0);

          this.detail=this.add.text(490,445,"",{
            fontFamily:"system-ui, sans-serif",
            fontSize:"13px",
            color:"#94a3b8",
            stroke:"#020617",
            strokeThickness:4,
          }).setOrigin(.5).setAlpha(0);

          this.game.events.on(FRAME_EVENT,(frame:BattlefieldCombatPresentationFrame)=>this.renderFrame(frame));
          this.game.events.on(RESOLUTION_EVENT,(fx:CommanderPhaserResolutionFx)=>this.renderResolutionFx(fx));
          this.game.events.on(STACK_EVENT,(fx:CommanderPhaserStackFx)=>this.renderStackFx(fx));
          this.game.events.on(PRIORITY_EVENT,(state:{prioritySeat:number;reactionWindowOpen:boolean})=>this.renderPriorityFx(state));
          this.game.events.on(TARGETING_EVENT,(state:CommanderPhaserTargetingFx)=>this.renderTargetingFx(state));
          this.game.events.on(PERMANENTS_EVENT,(state:CommanderPhaserPermanentSnapshot)=>this.renderPermanents(state));
          for(const state of queuedPriorityFxRef.current.splice(0))this.renderPriorityFx(state);
          for(const state of queuedTargetingFxRef.current.splice(0))this.renderTargetingFx(state);
          for(const state of queuedPermanentsRef.current.splice(0))this.renderPermanents(state);
          for(const frame of queuedFramesRef.current.splice(0))this.renderFrame(frame);
          for(const fx of queuedResolutionFxRef.current.splice(0))this.renderResolutionFx(fx);
          for(const fx of queuedStackFxRef.current.splice(0))this.renderStackFx(fx);
        }

        private renderPriorityFx(state:{prioritySeat:number;reactionWindowOpen:boolean}){
          const point=seatPoint(state.prioritySeat,viewerSeat);
          const color=state.reactionWindowOpen?0xa78bfa:0x67e8f9;
          const ring=this.add.circle(point.x,point.y,34,color,.08).setStrokeStyle(state.reactionWindowOpen?5:3,color,.95).setDepth(60);
          const halo=this.add.circle(point.x,point.y,48,color,.035).setStrokeStyle(2,color,.45).setDepth(59);
          this.tweens.add({targets:ring,scale:state.reactionWindowOpen?1.8:1.5,alpha:0,duration:700,ease:"Sine.easeOut",onComplete:()=>ring.destroy()});
          this.tweens.add({targets:halo,scale:state.reactionWindowOpen?2.15:1.8,alpha:0,duration:950,ease:"Sine.easeOut",onComplete:()=>halo.destroy()});
          if(state.reactionWindowOpen){
            const center={x:490,y:450};
            const arc=this.add.line(0,0,point.x,point.y,center.x,center.y,color,.45).setOrigin(0,0).setLineWidth(2).setDepth(58).setAlpha(0);
            this.tweens.add({targets:arc,alpha:1,duration:120,yoyo:true,hold:360,onComplete:()=>arc.destroy()});
          }
        }

        private renderPermanents(state:CommanderPhaserPermanentSnapshot){
          this.children.getAll().filter(child=>child.name.startsWith("permanent:")).forEach(child=>child.destroy());
          for(const seat of state.seats){
            const base=seatPoint(seat.seat,viewerSeat);
            const nexus=this.add.circle(base.x,base.y,26,seat.eliminated?0x334155:0x0e7490,.18).setStrokeStyle(2,seat.eliminated?0x64748b:0x67e8f9,.7).setDepth(20).setName(`permanent:nexus:${seat.seat}`);
            this.add.text(base.x,base.y,`N ${seat.nexusHealth}`,{fontFamily:"system-ui, sans-serif",fontSize:"11px",fontStyle:"bold",color:"#cffafe"}).setOrigin(.5).setDepth(21).setName(`permanent:nexus-label:${seat.seat}`);
            const generalColor=seat.general.zone==="battlefield"?0xf59e0b:0x7c3aed;
            this.add.circle(base.x+42,base.y,12,generalColor,.16).setStrokeStyle(2,generalColor,.8).setDepth(20).setName(`permanent:general:${seat.seat}`);
            seat.battlefield.slice(0,12).forEach((object,index)=>{
              const angle=(Math.PI*2*index)/Math.max(1,Math.min(12,seat.battlefield.length));
              const radius=74+(index%2)*24;
              const x=base.x+Math.cos(angle)*radius;
              const y=base.y+Math.sin(angle)*radius;
              const color=object.stunned?0x64748b:object.barrier?0x38bdf8:object.kind.toLowerCase().includes("structure")?0xf59e0b:0x22c55e;
              this.add.rectangle(x,y,34,46,color,.14).setStrokeStyle(2,color,.75).setDepth(18).setName(`permanent:object:${object.id}`);
              const stat=object.power!=null&&object.health!=null?`${object.power}/${object.health}`:object.durability!=null?`D${object.durability}`:"";
              if(stat)this.add.text(x,y+15,stat,{fontFamily:"system-ui, sans-serif",fontSize:"9px",fontStyle:"bold",color:"#f8fafc",stroke:"#020617",strokeThickness:3}).setOrigin(.5).setDepth(19).setName(`permanent:stat:${object.id}`);
              if(object.equipmentCount>0)this.add.text(x+14,y-19,`+${object.equipmentCount}`,{fontFamily:"system-ui, sans-serif",fontSize:"8px",color:"#fde68a"}).setOrigin(.5).setDepth(19).setName(`permanent:equipment:${object.id}`);
            });
          }
        }

        private renderTargetingFx(state:CommanderPhaserTargetingFx){
          if(!state.selectedKind||!state.selectedId)return;
          const color=state.selectedKind==="attacker"?0x22d3ee:0xa78bfa;
          for(const seat of state.targetSeats){
            const point=seatPoint(seat,viewerSeat);
            const ring=this.add.circle(point.x,point.y,58,color,.025).setStrokeStyle(3,color,.8).setDepth(58);
            this.tweens.add({targets:ring,scale:1.18,alpha:0,duration:900,ease:"Sine.Out",onComplete:()=>ring.destroy()});
          }
          for(const seat of state.targetAttackerSeats){
            const point=seatPoint(seat,viewerSeat);
            const ring=this.add.circle(point.x,point.y,42,color,.035).setStrokeStyle(2,color,.72).setDepth(58);
            this.tweens.add({targets:ring,scale:1.22,alpha:0,duration:800,ease:"Sine.Out",onComplete:()=>ring.destroy()});
          }
        }


        private renderStackFx(fx:CommanderPhaserStackFx){
          const center={x:490,y:450};
          fx.entered.forEach((item,index)=>{
            const source=seatPoint(item.controllerSeat,viewerSeat);
            const target={x:center.x+(index%2===0?-12:12),y:center.y+(index%3-1)*10};
            playStackEntryFx(this,source,target,item.speed,item.uncounterable);
          });
          fx.departed.forEach((_,index)=>{
            playStackDepartureFx(this,{x:center.x+(index%2===0?-10:10),y:center.y+(index%3-1)*8});
          });
        }

        private renderResolutionFx(fx:CommanderPhaserResolutionFx){
          Object.entries(fx.nexusDamage)
            .sort(([a],[b])=>Number(a)-Number(b))
            .forEach(([seat,damage])=>{
              playDamageImpactFx(this,seatPoint(Number(seat),viewerSeat),damage,"nexus");
            });

          Object.entries(fx.objectDamage)
            .sort(([a],[b])=>a.localeCompare(b))
            .forEach(([id,damage],index)=>{
              const seat=fx.objectSeats[id];
              if(typeof seat!=="number")return;
              playDamageImpactFx(this,seatFxPoint(seat,viewerSeat,index),damage,"object");
            });

          fx.barrierBroken
            .slice()
            .sort()
            .forEach((id,index)=>{
              const seat=fx.objectSeats[id];
              if(typeof seat!=="number")return;
              playBarrierBreakFx(this,seatFxPoint(seat,viewerSeat,index));
            });

          fx.departures
            .slice()
            .sort((a,b)=>a.id.localeCompare(b.id))
            .forEach((departure,index)=>{
              playDepartureFx(this,seatFxPoint(departure.seat,viewerSeat,index),departure.destination);
            });
        }

        private renderFrame(frame:BattlefieldCombatPresentationFrame){
          const tone=frame.phase==="blockers"?0x67e8f9:frame.phase==="damage"?0xfb7185:frame.phase==="complete"?0xa78bfa:0xfbbf24;
          const center={x:490,y:450};

          this.headline?.setText(frame.headline).setColor(frame.phase==="blockers"?"#a5f3fc":frame.phase==="damage"?"#fecdd3":frame.phase==="complete"?"#ddd6fe":"#fde68a").setAlpha(1);
          this.detail?.setText(frame.detail).setAlpha(1);
          this.tweens.killTweensOf([this.headline,this.detail]);
          this.tweens.add({targets:[this.headline,this.detail],alpha:0,duration:500,delay:900,ease:"Sine.easeIn"});

          if(frame.phase==="attackers"){
            frame.attackRoutes.slice(0,8).forEach((route)=>{
              const start=seatPoint(route.controllerSeat,viewerSeat);
              const end=seatPoint(route.defendingSeat,viewerSeat);
              const impact=collisionPoint(start,end);
              playCombatLaneFx(this,start,impact,"attackers");
              const orb=this.add.circle(start.x,start.y,7,tone,.95);
              this.tweens.add({
                targets:orb,
                x:impact.x,
                y:impact.y,
                alpha:0,
                scale:1.8,
                duration:850,
                ease:"Cubic.easeOut",
                onComplete:()=>orb.destroy(),
              });
            });
          }else if(frame.phase==="blockers"){
            frame.blockRoutes.slice(0,8).forEach((route)=>{
              const attack=frame.attackRoutes.find(entry=>entry.unitId===route.attackerId);
              if(!attack)return;
              const attackerStart=seatPoint(attack.controllerSeat,viewerSeat);
              const defender=seatPoint(attack.defendingSeat,viewerSeat);
              const impact=collisionPoint(attackerStart,defender);
              const start=seatPoint(route.controllerSeat,viewerSeat);
              playCombatLaneFx(this,start,impact,"blockers");
              const orb=this.add.circle(start.x,start.y,6,tone,.9);
              this.tweens.add({
                targets:orb,
                x:impact.x,
                y:impact.y,
                alpha:0,
                scale:1.6,
                duration:720,
                ease:"Cubic.easeOut",
                onComplete:()=>orb.destroy(),
              });
            });
          }else{
            const ring=this.add.circle(center.x,center.y,28,tone,.08).setStrokeStyle(3,tone,.8);
            this.tweens.add({
              targets:ring,
              scale:frame.phase==="damage"?3.2:2.4,
              alpha:0,
              duration:700,
              ease:"Sine.easeOut",
              onComplete:()=>ring.destroy(),
            });
          }
        }
      }

      const game=new Phaser.Game({
        type:Phaser.AUTO,
        parent:host,
        width:980,
        height:900,
        transparent:true,
        banner:false,
        scene:CommanderPresentationScene,
      }) as unknown as PhaserGameHandle;

      if(game.canvas){
        game.canvas.style.width="100%";
        game.canvas.style.height="100%";
        game.canvas.style.pointerEvents="none";
      }
      gameRef.current=game;
    }).catch((error)=>{
      console.warn("Commander Phaser presentation unavailable; React battlefield remains active.",error);
    });

    return ()=>{
      disposed=true;
      const game=gameRef.current;
      gameRef.current=null;
      game?.destroy(true);
      host.replaceChildren();
    };
  },[viewerSeat]);

  useEffect(()=>{
    if(lastPriorityRevisionRef.current===combat.revision)return;
    lastPriorityRevisionRef.current=combat.revision;
    const state={prioritySeat:combat.prioritySeat,reactionWindowOpen:combat.reactionWindowOpen};
    if(gameRef.current)gameRef.current.events.emit(PRIORITY_EVENT,state);
    else queuedPriorityFxRef.current.push(state);
  },[combat.prioritySeat,combat.reactionWindowOpen,combat.revision,viewerSeat]);

  useEffect(()=>{
    if(gameRef.current)gameRef.current.events.emit(PERMANENTS_EVENT,permanents);
    else queuedPermanentsRef.current.push(permanents);
  },[permanents,viewerSeat]);

  useEffect(()=>{
    if(gameRef.current)gameRef.current.events.emit(TARGETING_EVENT,targetingFx);
    else queuedTargetingFxRef.current.push(targetingFx);
  },[targetingFx,viewerSeat]);

  useEffect(()=>{
    const previous=previousProjectionRef.current;
    previousProjectionRef.current=projection;
    const delta=projectAuthoritativeCombatDelta(previous,projection);
    if(!delta)return;
    for(const frame of delta.frames){
      if(gameRef.current)gameRef.current.events.emit(FRAME_EVENT,frame);
      else queuedFramesRef.current.push(frame);
    }
  },[projection]);

  useEffect(()=>{
    if(!resolutionFx||lastResolutionRevisionRef.current===resolutionFx.revision)return;
    lastResolutionRevisionRef.current=resolutionFx.revision;
    if(gameRef.current)gameRef.current.events.emit(RESOLUTION_EVENT,resolutionFx);
    else queuedResolutionFxRef.current.push(resolutionFx);
  },[resolutionFx,viewerSeat]);

  useEffect(()=>{
    if(!stackInitializedRef.current){
      stackInitializedRef.current=true;
      previousStackRef.current=stack;
      lastStackRevisionRef.current=combat.revision;
      return;
    }
    if(lastStackRevisionRef.current===combat.revision)return;
    const previous=previousStackRef.current;
    const currentIds=new Set(stack.map(item=>item.id));
    const previousIds=new Set(previous.map(item=>item.id));
    const entered=stack.filter(item=>!previousIds.has(item.id));
    const departed=previous.filter(item=>!currentIds.has(item.id));
    previousStackRef.current=stack;
    lastStackRevisionRef.current=combat.revision;
    if(!entered.length&&!departed.length)return;
    const fx:CommanderPhaserStackFx={revision:combat.revision,entered,departed};
    if(gameRef.current)gameRef.current.events.emit(STACK_EVENT,fx);
    else queuedStackFxRef.current.push(fx);
  },[combat.revision,stack,viewerSeat]);

  return <div
    ref={hostRef}
    className="pointer-events-none absolute inset-0 z-[15] overflow-hidden rounded-[2rem]"
    aria-hidden="true"
    data-commander-phaser-runtime="presentation-only"
  />;
}
