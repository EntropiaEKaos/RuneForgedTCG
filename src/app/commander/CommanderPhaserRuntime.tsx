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
  activeSeat:number;
  turn:number;
  round:number;
  phase:string;
  status:string;
  winnerSeat:number|null;
  eliminatedSeats:number[];
  reactionWindowOpen:boolean;
  attackers:Array<{unitId:string;controllerSeat:number;defendingSeat:number}>;
  blockers:Array<{unitId:string;controllerSeat:number;attackerId:string}>;
};

export type CommanderPhaserHandCard = {instanceId:string;defId:string;name:string;artUrl:string|null};

export type CommanderPhaserPermanentSnapshot = {
  revision:number;
  seats:Array<{
    seat:number;
    nexusHealth:number;
    eliminated:boolean;
    general:{defId:string;zone:string;castCount:number;name:string;artUrl:string|null};
    battlefield:Array<{
      id:string;defId:string;kind:string;controllerSeat:string;name:string;artUrl:string|null;
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
  sourceId?:string|null;
  uncounterable:boolean;
};

type CommanderPhaserStackFx = {
  revision:number;
  entered:CommanderPhaserStackItem[];
  departed:CommanderPhaserStackItem[];
  viewerHandDepartures:Record<string,CommanderPhaserHandCard>;
  battlefieldArrivals:Record<string,{id:string;seat:number;defId:string}>;
};

export type CommanderPhaserResolutionFx = {
  revision:number;
  attackerIds:string[];
  blockerPairs:Array<{attackerId:string;blockerId:string}>;
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
const TURN_EVENT="runeforged:commander:turn-fx";
const OUTCOME_EVENT="runeforged:commander:outcome-fx";
const TARGETING_EVENT="runeforged:commander:targeting-fx";
const PERMANENTS_EVENT="runeforged:commander:permanents";
const HAND_EVENT="runeforged:commander:hand";
const GENERAL_EVENT="runeforged:commander:general-transition";

const RF_BATTLEFIELD_THEME={
  main:0x6ae8be,
  combat:0xfb923c,
  response:0xa78bfa,
  opponent:0x94a3b8,
  danger:0xfb7185,
  targeting:0xf4c75b,
  block:0x60a5fa,
  sentinela:0x67e8f9,
  surface:0x03070c,
  ink:0xf1f5f9,
} as const;

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
  hand,
  viewerSeat,
}:{
  combat:CombatProjection;
  resolutionFx:CommanderPhaserResolutionFx|null;
  stack:CommanderPhaserStackItem[];
  targetingFx:CommanderPhaserTargetingFx;
  permanents:CommanderPhaserPermanentSnapshot;
  hand:CommanderPhaserHandCard[];
  viewerSeat:number;
}){
  const hostRef=useRef<HTMLDivElement|null>(null);
  const gameRef=useRef<PhaserGameHandle|null>(null);
  const previousProjectionRef=useRef<AuthoritativeCombatProjection|null>(null);
  const queuedFramesRef=useRef<BattlefieldCombatPresentationFrame[]>([]);
  const queuedResolutionFxRef=useRef<CommanderPhaserResolutionFx[]>([]);
  const queuedStackFxRef=useRef<CommanderPhaserStackFx[]>([]);
  const lastResolutionRevisionRef=useRef<number|null>(null);
  const previousTurnRef=useRef<{activeSeat:number;turn:number;round:number;phase:string}|null>(null);
  const previousOutcomeRef=useRef<{status:string;winnerSeat:number|null;eliminatedSeats:number[]}|null>(null);
  const lastStackRevisionRef=useRef<number|null>(null);
  const previousStackRef=useRef<CommanderPhaserStackItem[]>([]);
  const previousHandRef=useRef<CommanderPhaserHandCard[]>(hand);
  const previousPermanentsRef=useRef<CommanderPhaserPermanentSnapshot>(permanents);
  const previousGeneralsRef=useRef<CommanderPhaserPermanentSnapshot>(permanents);
  const stackInitializedRef=useRef(false);
  const lastPriorityRevisionRef=useRef<number|null>(null);
  const queuedPriorityFxRef=useRef<Array<{prioritySeat:number;reactionWindowOpen:boolean}>>([]);
  const queuedOutcomeFxRef=useRef<Array<{status:string;winnerSeat:number|null;eliminatedSeats:number[];newlyEliminated:number[]}>>([]);
  const queuedTargetingFxRef=useRef<CommanderPhaserTargetingFx[]>([]);
  const queuedPermanentsRef=useRef<CommanderPhaserPermanentSnapshot[]>([]);
  const queuedHandRef=useRef<CommanderPhaserHandCard[][]>([]);

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
        private arenaCore?:InstanceType<typeof Phaser.GameObjects.Arc>;
        private arenaHalo?:InstanceType<typeof Phaser.GameObjects.Arc>;
        private seatAnchors:InstanceType<typeof Phaser.GameObjects.Arc>[]=[];

        create(){
          this.arenaHalo=this.add.circle(490,450,118,RF_BATTLEFIELD_THEME.main,.018).setStrokeStyle(2,RF_BATTLEFIELD_THEME.main,.12).setDepth(2).setName("arena:legacy-halo");
          this.arenaCore=this.add.circle(490,450,48,RF_BATTLEFIELD_THEME.main,.035).setStrokeStyle(2,RF_BATTLEFIELD_THEME.main,.28).setDepth(3).setName("arena:legacy-core");

          // Presentation-only arena architecture: inherit the certified 1v1 color language
          // while giving Commander four readable territories and one shared ritual core.
          [174,232,292].forEach((radius,index)=>{
            this.add.circle(490,450,radius,RF_BATTLEFIELD_THEME.surface,.012)
              .setStrokeStyle(index===1?2:1,index===1?RF_BATTLEFIELD_THEME.main:RF_BATTLEFIELD_THEME.opponent,index===1?.10:.065)
              .setDepth(1)
              .setName(`arena:rune-ring:${index}`);
          });
          [0,1,2,3].forEach(relativeSeat=>{
            const point=seatPoint((viewerSeat+relativeSeat)%4,viewerSeat);
            const local=relativeSeat===0;
            const laneColor=local?RF_BATTLEFIELD_THEME.main:RF_BATTLEFIELD_THEME.opponent;
            const laneMid={x:490+(point.x-490)*.56,y:450+(point.y-450)*.56};
            this.add.line(0,0,490,450,point.x,point.y,laneColor,local?.12:.085)
              .setOrigin(0,0)
              .setLineWidth(local?3:2)
              .setDepth(1)
              .setName(`arena:territory-spoke:${relativeSeat}`);
            this.add.ellipse(laneMid.x,laneMid.y,local?214:188,local?128:112,laneColor,local?.028:.016)
              .setStrokeStyle(local?2:1,laneColor,local?.16:.10)
              .setDepth(1.25)
              .setName(`arena:territory-lane:${relativeSeat}`);
            this.add.ellipse(point.x,point.y,local?194:166,local?116:104,RF_BATTLEFIELD_THEME.surface,local?.09:.065)
              .setStrokeStyle(local?3:2,laneColor,local?.32:.20)
              .setDepth(1.5)
              .setName(`arena:seat-sanctum:${relativeSeat}`);
            this.add.text(point.x,point.y+(local?67:59),local?"YOUR FORGE":`P${((viewerSeat+relativeSeat)%4)+1} FORGE`,{fontFamily:"system-ui, sans-serif",fontSize:local?"9px":"8px",fontStyle:"bold",color:local?"#6ae8be":"#94a3b8",stroke:"#020617",strokeThickness:3})
              .setOrigin(.5).setAlpha(local?.58:.38).setDepth(2.1).setName(`arena:territory-label:${relativeSeat}`);
          });
          const runeAngles=[0,Math.PI/4,Math.PI/2,Math.PI*3/4];
          runeAngles.forEach((angle,index)=>{
            const dx=Math.cos(angle)*86;
            const dy=Math.sin(angle)*86;
            this.add.line(0,0,490-dx,450-dy,490+dx,450+dy,RF_BATTLEFIELD_THEME.response,.08)
              .setOrigin(0,0)
              .setLineWidth(1)
              .setDepth(2)
              .setName(`arena:core-rune:${index}`);
          });

          // Persistent Forge Presence: a low-noise ritual engine that reads in still captures,
          // while remaining strictly presentation-only and driven by the certified legacy palette.
          const forgePlate=this.add.circle(490,450,82,RF_BATTLEFIELD_THEME.surface,.42)
            .setStrokeStyle(2,RF_BATTLEFIELD_THEME.response,.34).setDepth(2.4).setName("arena:forge-plate");
          const forgeCrown=this.add.circle(490,450,64,RF_BATTLEFIELD_THEME.response,.045)
            .setStrokeStyle(3,RF_BATTLEFIELD_THEME.main,.48).setDepth(2.6).setName("arena:forge-crown");
          const forgeSigil=this.add.text(490,450,"◆",{fontFamily:"system-ui, sans-serif",fontSize:"28px",fontStyle:"bold",color:"#a78bfa",stroke:"#020617",strokeThickness:6})
            .setOrigin(.5).setAlpha(.68).setDepth(3.2).setName("arena:forge-sigil");
          this.add.text(490,510,"RUNE FORGE",{fontFamily:"system-ui, sans-serif",fontSize:"8px",fontStyle:"bold",color:"#94a3b8",stroke:"#020617",strokeThickness:3})
            .setOrigin(.5).setAlpha(.82).setDepth(3.2).setName("arena:forge-label");
          this.tweens.add({targets:forgeCrown,angle:360,duration:18000,repeat:-1,ease:"Linear"});
          this.tweens.add({targets:[forgePlate,forgeSigil],scale:1.06,alpha:.62,duration:2600,yoyo:true,repeat:-1,ease:"Sine.easeInOut"});

          this.seatAnchors=[0,1,2,3].map(seat=>{
            const point=seatPoint(seat,viewerSeat);
            return this.add.circle(point.x,point.y,62,RF_BATTLEFIELD_THEME.opponent,.012).setStrokeStyle(1,RF_BATTLEFIELD_THEME.opponent,.14).setDepth(2).setName(`arena:seat-anchor:${seat}`);
          });
          this.tweens.add({targets:this.arenaCore,scale:1.12,alpha:.72,duration:2200,yoyo:true,repeat:-1,ease:"Sine.easeInOut"});
          this.tweens.add({targets:this.arenaHalo,scale:1.06,alpha:.5,duration:3200,yoyo:true,repeat:-1,ease:"Sine.easeInOut"});

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
          this.game.events.on(TURN_EVENT,(state:{activeSeat:number;turn:number;round:number;phase:string})=>this.renderTurnFx(state));
          this.game.events.on(OUTCOME_EVENT,(state:{status:string;winnerSeat:number|null;eliminatedSeats:number[];newlyEliminated:number[]})=>this.renderOutcomeFx(state));
          this.game.events.on(PRIORITY_EVENT,(state:{prioritySeat:number;reactionWindowOpen:boolean})=>this.renderPriorityFx(state));
          this.game.events.on(TARGETING_EVENT,(state:CommanderPhaserTargetingFx)=>this.renderTargetingFx(state));
          this.game.events.on(PERMANENTS_EVENT,(state:CommanderPhaserPermanentSnapshot)=>this.renderPermanents(state));
          this.game.events.on(HAND_EVENT,(cards:CommanderPhaserHandCard[])=>this.renderHand(cards));
          this.game.events.on(GENERAL_EVENT,(state:{seat:number;from:string;to:string;name:string})=>this.renderGeneralTransition(state));
          for(const state of queuedPriorityFxRef.current.splice(0))this.renderPriorityFx(state);
          for(const state of queuedOutcomeFxRef.current.splice(0))this.renderOutcomeFx(state);
          for(const state of queuedTargetingFxRef.current.splice(0))this.renderTargetingFx(state);
          for(const state of queuedPermanentsRef.current.splice(0))this.renderPermanents(state);
          for(const cards of queuedHandRef.current.splice(0))this.renderHand(cards);
          for(const frame of queuedFramesRef.current.splice(0))this.renderFrame(frame);
          for(const fx of queuedResolutionFxRef.current.splice(0))this.renderResolutionFx(fx);
          for(const fx of queuedStackFxRef.current.splice(0))this.renderStackFx(fx);
        }

        private renderGeneralTransition(state:{seat:number;from:string;to:string;name:string}){
          const point=seatPoint(state.seat,viewerSeat);
          const entering=state.to==="battlefield";
          const color=entering?RF_BATTLEFIELD_THEME.targeting:RF_BATTLEFIELD_THEME.response;
          const start=entering?{x:point.x+48,y:point.y}:{x:point.x,y:point.y-18};
          const end=entering?{x:point.x,y:point.y-18}:{x:point.x+48,y:point.y};
          const sigil=this.add.circle(start.x,start.y,15,color,.12).setStrokeStyle(3,color,.92).setDepth(90).setName(`general:transition:${state.seat}`);
          const label=this.add.text(start.x,start.y-28,entering?"GENERAL EM CAMPO":"GENERAL ZONE",{fontFamily:"system-ui, sans-serif",fontSize:"10px",fontStyle:"bold",color:entering?"#fde68a":"#ddd6fe",stroke:"#020617",strokeThickness:4}).setOrigin(.5).setDepth(91);
          this.tweens.add({targets:sigil,x:end.x,y:end.y,scale:entering?2.2:.55,alpha:0,duration:760,ease:entering?"Cubic.easeOut":"Cubic.easeIn",onComplete:()=>sigil.destroy()});
          this.tweens.add({targets:label,y:label.y-18,alpha:0,duration:820,ease:"Sine.easeOut",onComplete:()=>label.destroy()});
        }

        private renderPriorityFx(state:{prioritySeat:number;reactionWindowOpen:boolean}){
          const point=seatPoint(state.prioritySeat,viewerSeat);
          const color=state.reactionWindowOpen?RF_BATTLEFIELD_THEME.response:RF_BATTLEFIELD_THEME.main;
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

        private renderHand(cards:CommanderPhaserHandCard[]){
          this.children.getAll().filter(child=>child.name.startsWith("hand:")).forEach(child=>child.destroy());
          const visible=cards.slice(-10);
          const startX=490-((visible.length-1)*34)/2;
          visible.forEach((card,index)=>{
            const x=startX+index*34;
            const y=835-Math.abs(index-(visible.length-1)/2)*2;
            const frame=this.add.rectangle(x,y,32,44,0x0f172a,.92).setStrokeStyle(1,0x94a3b8,.55).setDepth(72).setName(`hand:card:${card.instanceId}`);
            if(card.artUrl){
              const textureKey=`card-art:${card.defId}`;
              if(!this.textures.exists(textureKey)){
                this.load.image(textureKey,card.artUrl);
                this.load.once(`filecomplete-image-${textureKey}`,()=>{
                  if(frame.active)this.add.image(x,y-2,textureKey).setDisplaySize(28,34).setDepth(72.1).setName(`hand:art:${card.instanceId}`);
                });
                this.load.start();
              }else this.add.image(x,y-2,textureKey).setDisplaySize(28,34).setDepth(72.1).setName(`hand:art:${card.instanceId}`);
            }
            this.add.text(x,y+17,card.name.length>10?card.name.slice(0,9)+"…":card.name,{fontFamily:"system-ui, sans-serif",fontSize:"5px",fontStyle:"bold",color:"#f8fafc",stroke:"#020617",strokeThickness:2}).setOrigin(.5).setDepth(73).setName(`hand:name:${card.instanceId}`);
          });
        }

        private renderPermanents(state:CommanderPhaserPermanentSnapshot){
          this.children.getAll().filter(child=>child.name.startsWith("permanent:")).forEach(child=>child.destroy());
          for(const seat of state.seats){
            const base=seatPoint(seat.seat,viewerSeat);
            const critical=!seat.eliminated&&seat.nexusHealth<=10;
            const nexusColor=seat.eliminated?0x475569:critical?RF_BATTLEFIELD_THEME.danger:RF_BATTLEFIELD_THEME.main;
            const nexusPlate=this.add.circle(base.x,base.y,43,RF_BATTLEFIELD_THEME.surface,.34).setStrokeStyle(1,nexusColor,seat.eliminated?.10:.18).setDepth(18.6).setName(`permanent:nexus-plate:${seat.seat}`);
            const nexusHalo=this.add.circle(base.x,base.y,37,nexusColor,.025).setStrokeStyle(2,nexusColor,seat.eliminated?.12:critical?.5:.28).setDepth(19).setName(`permanent:nexus-halo:${seat.seat}`);
            const nexus=this.add.circle(base.x,base.y,28,nexusColor,seat.eliminated?.06:.18).setStrokeStyle(3,nexusColor,seat.eliminated?.28:.88).setDepth(20).setName(`permanent:nexus:${seat.seat}`);
            this.add.text(base.x,base.y-38,"◇",{fontFamily:"system-ui, sans-serif",fontSize:"11px",fontStyle:"bold",color:seat.eliminated?"#475569":critical?"#fb7185":"#6ae8be",stroke:"#020617",strokeThickness:3}).setOrigin(.5).setDepth(21).setName(`permanent:nexus-sigil:${seat.seat}`);
            if(critical)this.tweens.add({targets:[nexus,nexusHalo],scale:1.1,alpha:.55,duration:720,yoyo:true,repeat:-1,ease:"Sine.easeInOut"});
            this.add.text(base.x,base.y-3,`${seat.nexusHealth}`,{fontFamily:"system-ui, sans-serif",fontSize:"16px",fontStyle:"bold",color:seat.eliminated?"#64748b":critical?"#fecdd3":"#d1fae5",stroke:"#020617",strokeThickness:4}).setOrigin(.5).setDepth(21).setName(`permanent:nexus-label:${seat.seat}`);
            this.add.text(base.x,base.y+15,seat.eliminated?"ELIMINADO":"NEXUS",{fontFamily:"system-ui, sans-serif",fontSize:"6px",fontStyle:"bold",color:seat.eliminated?"#64748b":"#94a3b8",stroke:"#020617",strokeThickness:2}).setOrigin(.5).setDepth(21).setName(`permanent:nexus-state:${seat.seat}`);
            const generalColor=seat.general.zone==="battlefield"?RF_BATTLEFIELD_THEME.targeting:RF_BATTLEFIELD_THEME.response;
            const generalPlate=this.add.circle(base.x+50,base.y,19,RF_BATTLEFIELD_THEME.surface,.42).setStrokeStyle(1,generalColor,.26).setDepth(19.2).setName(`permanent:general-plate:${seat.seat}`);
            const general=this.add.circle(base.x+50,base.y,14,generalColor,.16).setStrokeStyle(2,generalColor,.86).setDepth(20).setName(`permanent:general:${seat.seat}`);
            this.add.text(base.x+50,base.y,"✦",{fontFamily:"system-ui, sans-serif",fontSize:"9px",fontStyle:"bold",color:seat.general.zone==="battlefield"?"#fde68a":"#ddd6fe",stroke:"#020617",strokeThickness:2}).setOrigin(.5).setDepth(21).setName(`permanent:general-sigil:${seat.seat}`);
            if(seat.general.zone==="battlefield")this.add.circle(base.x+48,base.y,19,generalColor,.02).setStrokeStyle(1,generalColor,.32).setDepth(19).setName(`permanent:general-presence:${seat.seat}`);
            this.add.text(base.x+48,base.y+22,`${seat.general.name} · ${seat.general.castCount}`,{fontFamily:"system-ui, sans-serif",fontSize:"7px",color:seat.general.zone==="battlefield"?"#fde68a":"#ddd6fe",stroke:"#020617",strokeThickness:2}).setOrigin(.5).setDepth(21).setName(`permanent:general-name:${seat.seat}`);
            seat.battlefield.slice(0,12).forEach((object,index)=>{
              const angle=(Math.PI*2*index)/Math.max(1,Math.min(12,seat.battlefield.length));
              const radius=82+(index%2)*27;
              const x=base.x+Math.cos(angle)*radius;
              const y=base.y+Math.sin(angle)*radius;
              const damaged=object.health!=null&&object.maxHealth!=null&&object.health<object.maxHealth;
              const durabilityDamaged=object.durability!=null&&object.maxDurability!=null&&object.durability<object.maxDurability;
              const color=object.stunned?RF_BATTLEFIELD_THEME.opponent:object.barrier?RF_BATTLEFIELD_THEME.block:damaged||durabilityDamaged?RF_BATTLEFIELD_THEME.danger:RF_BATTLEFIELD_THEME.main;
              const frame=this.add.rectangle(x,y,48,66,color,.16).setStrokeStyle(2,color,.75).setDepth(18).setName(`permanent:object:${object.id}`);
              if(object.barrier)this.add.circle(x,y,30,0x38bdf8,.025).setStrokeStyle(2,0x67e8f9,.7).setDepth(18.8).setName(`permanent:barrier:${object.id}`);
              if(object.frostbitten)this.add.text(x-16,y-19,"❄",{fontFamily:"system-ui, sans-serif",fontSize:"10px",color:"#bae6fd"}).setDepth(19).setName(`permanent:frostbite:${object.id}`);
              if(object.stunned)this.add.text(x-16,y+17,"STUN",{fontFamily:"system-ui, sans-serif",fontSize:"6px",fontStyle:"bold",color:"#cbd5e1",stroke:"#020617",strokeThickness:2}).setDepth(19).setName(`permanent:stunned:${object.id}`);
              if(object.attackedThisTurn)this.add.text(x+11,y+17,"⚔",{fontFamily:"system-ui, sans-serif",fontSize:"9px",color:"#fda4af"}).setDepth(19).setName(`permanent:attacked:${object.id}`);
              if(object.loyalty!=null)this.add.text(x-16,y+17,`L${object.loyalty}`,{fontFamily:"system-ui, sans-serif",fontSize:"7px",fontStyle:"bold",color:"#e9d5ff",stroke:"#020617",strokeThickness:2}).setDepth(19).setName(`permanent:loyalty:${object.id}`);
              if(object.artUrl){
                const textureKey=`card-art:${object.defId}`;
                if(!this.textures.exists(textureKey)){
                  this.load.image(textureKey,object.artUrl);
                  this.load.once(`filecomplete-image-${textureKey}`,()=>{
                    if(!frame.active)return;
                    const art=this.add.image(x,y-3,textureKey).setDisplaySize(41,48).setDepth(18.2).setName(`permanent:art:${object.id}`);
                    frame.setDepth(18.3);
                    art.setCrop(0,0,art.width,Math.max(1,art.height));
                  });
                  this.load.start();
                }else{
                  this.add.image(x,y-3,textureKey).setDisplaySize(36,42).setDepth(18.2).setName(`permanent:art:${object.id}`);
                  frame.setDepth(18.3);
                }
              }
              this.add.text(x,y-25,object.name.length>14?object.name.slice(0,13)+"…":object.name,{fontFamily:"system-ui, sans-serif",fontSize:"7px",fontStyle:"bold",color:"#f8fafc",stroke:"#020617",strokeThickness:2}).setOrigin(.5).setDepth(19).setName(`permanent:name:${object.id}`);
              const stat=object.power!=null&&object.health!=null?`${object.power}/${object.health}`:object.durability!=null?`D${object.durability}`:"";
              if(stat)this.add.text(x,y+15,stat,{fontFamily:"system-ui, sans-serif",fontSize:"9px",fontStyle:"bold",color:"#f8fafc",stroke:"#020617",strokeThickness:3}).setOrigin(.5).setDepth(19).setName(`permanent:stat:${object.id}`);
              if(object.equipmentCount>0)this.add.text(x+14,y-19,`⚙${object.equipmentCount}`,{fontFamily:"system-ui, sans-serif",fontSize:"8px",color:"#fde68a"}).setOrigin(.5).setDepth(19).setName(`permanent:equipment:${object.id}`);
            });
          }
        }

        private renderTargetingFx(state:CommanderPhaserTargetingFx){
          if(!state.selectedKind||!state.selectedId)return;
          const color=state.selectedKind==="attacker"?RF_BATTLEFIELD_THEME.combat:RF_BATTLEFIELD_THEME.block;
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
          const stackPulse=()=>{
            const pulse=this.add.circle(center.x,center.y,42,RF_BATTLEFIELD_THEME.response,.035).setStrokeStyle(3,RF_BATTLEFIELD_THEME.response,.72).setDepth(57).setName("stack:arena-core-pulse");
            this.tweens.add({targets:pulse,scale:2.25,alpha:0,duration:720,ease:"Sine.easeOut",onComplete:()=>pulse.destroy()});
          };
          if(fx.entered.length||fx.departed.length){
            stackPulse();
            this.arenaCore?.setFillStyle(RF_BATTLEFIELD_THEME.response,.07).setStrokeStyle(3,RF_BATTLEFIELD_THEME.response,.58);
            this.tweens.add({targets:this.arenaCore,scale:1.28,duration:180,yoyo:true,ease:"Quad.easeOut"});
          }
          fx.entered.forEach((item,index)=>{
            const handCard=fx.viewerHandDepartures[item.id];
            const source=handCard?{x:490,y:830}:seatPoint(item.controllerSeat,viewerSeat);
            const target={x:center.x+(index%2===0?-12:12),y:center.y+(index%3-1)*10};
            playStackEntryFx(this,source,target,item.speed,item.uncounterable);
            if(handCard){
              const textureKey=`card-art:${handCard.defId}`;
              if(this.textures.exists(textureKey)){
                const card=this.add.image(source.x,source.y,textureKey).setDisplaySize(36,50).setDepth(86).setName(`stack:hand-departure:${handCard.instanceId}`);
                this.tweens.add({targets:card,x:target.x,y:target.y,scaleX:1.3,scaleY:1.3,alpha:0,duration:520,ease:"Cubic.Out",onComplete:()=>card.destroy()});
              }
            }
          });
          fx.departed.forEach((item,index)=>{
            const start={x:center.x+(index%2===0?-10:10),y:center.y+(index%3-1)*8};
            const arrival=fx.battlefieldArrivals[item.id];
            playStackDepartureFx(this,start);
            if(arrival){
              const target=seatFxPoint(arrival.seat,viewerSeat,index);
              const marker=this.add.circle(start.x,start.y,8,RF_BATTLEFIELD_THEME.main,.82).setDepth(84).setName(`stack:arrival:${arrival.id}`);
              this.tweens.add({targets:marker,x:target.x,y:target.y,scale:1.8,alpha:0,duration:560,ease:"Cubic.Out",onComplete:()=>marker.destroy()});
            }
          });
        }

        private renderOutcomeFx(state:{status:string;winnerSeat:number|null;eliminatedSeats:number[];newlyEliminated:number[]}){
          for(const seat of state.newlyEliminated){
            const point=seatPoint(seat,viewerSeat);
            const ring=this.add.circle(point.x,point.y,46,0xef4444,.08).setStrokeStyle(5,0xef4444,.95).setDepth(92).setName(`outcome:eliminated:${seat}`);
            this.tweens.add({targets:ring,scale:2.4,alpha:0,duration:1000,ease:"Sine.easeOut",onComplete:()=>ring.destroy()});
          }
          const existingWinner=this.children.getByName("outcome:winner");
          if(state.status==="completed"&&state.winnerSeat!==null){
            const point=seatPoint(state.winnerSeat,viewerSeat);
            const crown=(existingWinner as InstanceType<typeof Phaser.GameObjects.Text>|null)
              ?? this.add.text(point.x,point.y-72,"VITÓRIA",{fontFamily:"system-ui, sans-serif",fontSize:"22px",fontStyle:"bold",color:"#fde68a",stroke:"#020617",strokeThickness:6}).setOrigin(.5).setDepth(95).setName("outcome:winner");
            crown.setPosition(point.x,point.y-72).setText("VITÓRIA").setVisible(true);
            if(!existingWinner)this.tweens.add({targets:crown,scale:1.12,duration:550,yoyo:true,repeat:2,ease:"Sine.easeInOut"});
          }else if(existingWinner){
            existingWinner.destroy();
          }
        }

        private renderTurnFx(state:{activeSeat:number;turn:number;round:number;phase:string}){
          const point=seatPoint(state.activeSeat,viewerSeat);
          const phaseColor=state.phase==="combat"?RF_BATTLEFIELD_THEME.combat:state.phase==="response"?RF_BATTLEFIELD_THEME.response:RF_BATTLEFIELD_THEME.main;
          this.arenaCore?.setFillStyle(phaseColor,.04).setStrokeStyle(2,phaseColor,.34);
          this.arenaHalo?.setFillStyle(phaseColor,.015).setStrokeStyle(2,phaseColor,.13);
          this.seatAnchors.forEach((anchor,index)=>anchor.setStrokeStyle(index===state.activeSeat?3:1,index===state.activeSeat?phaseColor:RF_BATTLEFIELD_THEME.opponent,index===state.activeSeat?.62:.12));
          const lane=this.add.line(0,0,point.x,point.y,490,450,phaseColor,.22).setOrigin(0,0).setLineWidth(2).setDepth(4).setName(`turn:lane:${state.activeSeat}`);
          const ring=this.add.circle(point.x,point.y,34,phaseColor,.08).setStrokeStyle(4,phaseColor,.9).setDepth(88).setName(`turn:active:${state.activeSeat}`);
          const label=this.add.text(490,410,`TURNO ${state.turn} · RODADA ${state.round} · ${state.phase.toUpperCase()}`,{fontFamily:"system-ui, sans-serif",fontSize:"18px",fontStyle:"bold",color:"#fde68a"}).setOrigin(.5).setDepth(89).setName("turn:transition");
          this.tweens.add({targets:ring,scale:2.3,alpha:0,duration:850,ease:"Sine.easeOut",onComplete:()=>ring.destroy()});
          this.tweens.add({targets:lane,alpha:0,duration:1200,delay:500,ease:"Sine.easeOut",onComplete:()=>lane.destroy()});
          this.tweens.add({targets:label,y:390,alpha:0,duration:900,delay:450,ease:"Sine.easeIn",onComplete:()=>label.destroy()});
        }

        private renderResolutionFx(fx:CommanderPhaserResolutionFx){
          const blockedAttackers=new Set(fx.blockerPairs.map(pair=>pair.attackerId));
          fx.attackerIds.slice().sort().forEach((attackerId,index)=>{
            const seat=fx.objectSeats[attackerId];
            if(typeof seat!=="number")return;
            const impact=seatFxPoint(seat,viewerSeat,index);
            const ring=this.add.circle(impact.x,impact.y,blockedAttackers.has(attackerId)?18:14,blockedAttackers.has(attackerId)?0x67e8f9:0xfb7185,.12)
              .setStrokeStyle(3,blockedAttackers.has(attackerId)?0x67e8f9:0xfb7185,.9)
              .setDepth(86)
              .setName(`combat:resolution:attacker:${attackerId}`);
            this.tweens.add({targets:ring,scale:2.1,alpha:0,duration:620,ease:"Sine.easeOut",onComplete:()=>ring.destroy()});
          });

          Object.entries(fx.nexusDamage)
            .sort(([a],[b])=>Number(a)-Number(b))
            .forEach(([seat,damage])=>{
              const seatNumber=Number(seat);
              const point=seatPoint(seatNumber,viewerSeat);
              playDamageImpactFx(this,point,damage,"nexus");
              const shock=this.add.circle(point.x,point.y,31,RF_BATTLEFIELD_THEME.danger,.04).setStrokeStyle(4,RF_BATTLEFIELD_THEME.danger,.88).setDepth(87).setName(`nexus:impact:${seatNumber}`);
              const recoil=this.add.line(0,0,point.x,point.y,490,450,RF_BATTLEFIELD_THEME.danger,.26).setOrigin(0,0).setLineWidth(3).setDepth(52).setName(`nexus:recoil:${seatNumber}`);
              const anchor=this.seatAnchors[(seatNumber-viewerSeat+4)%4];
              if(anchor)this.tweens.add({targets:anchor,scale:.86,duration:90,yoyo:true,repeat:1,ease:"Quad.easeOut"});
              this.tweens.add({targets:shock,scale:3.4,alpha:0,duration:680,ease:"Cubic.easeOut",onComplete:()=>shock.destroy()});
              this.tweens.add({targets:recoil,alpha:0,duration:520,ease:"Sine.easeOut",onComplete:()=>recoil.destroy()});
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
          const tone=frame.phase==="blockers"?RF_BATTLEFIELD_THEME.block:frame.phase==="damage"?RF_BATTLEFIELD_THEME.danger:frame.phase==="complete"?RF_BATTLEFIELD_THEME.response:RF_BATTLEFIELD_THEME.combat;
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
              const destination=this.add.line(0,0,impact.x,impact.y,end.x,end.y,RF_BATTLEFIELD_THEME.combat,.18).setOrigin(0,0).setLineWidth(2).setDepth(45).setName(`combat:destination:${route.unitId}`);
              const targetRing=this.add.circle(end.x,end.y,34,RF_BATTLEFIELD_THEME.combat,.018).setStrokeStyle(2,RF_BATTLEFIELD_THEME.combat,.34).setDepth(46).setName(`combat:nexus-target:${route.unitId}`);
              this.tweens.add({targets:[destination,targetRing],alpha:0,duration:1250,delay:180,ease:"Sine.easeOut",onComplete:()=>{destination.destroy();targetRing.destroy();}});
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
              const collision=this.add.circle(impact.x,impact.y,12,RF_BATTLEFIELD_THEME.block,.08).setStrokeStyle(3,RF_BATTLEFIELD_THEME.block,.86).setDepth(55).setName(`combat:block-collision:${route.attackerId}`);
              const shield=this.add.text(impact.x,impact.y,"◆",{fontFamily:"system-ui, sans-serif",fontSize:"18px",fontStyle:"bold",color:"#bfdbfe",stroke:"#172554",strokeThickness:4}).setOrigin(.5).setDepth(56).setName(`combat:block-shield:${route.attackerId}`);
              this.tweens.add({targets:[collision,shield],scale:2.2,alpha:0,duration:620,ease:"Cubic.easeOut",onComplete:()=>{collision.destroy();shield.destroy();}});
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
    if(gameRef.current)gameRef.current.events.emit(HAND_EVENT,hand);
    else queuedHandRef.current.push(hand);
  },[hand,viewerSeat]);

  useEffect(()=>{
    if(gameRef.current)gameRef.current.events.emit(PERMANENTS_EVENT,permanents);
    else queuedPermanentsRef.current.push(permanents);
  },[permanents,viewerSeat]);

  useEffect(()=>{
    const previous=previousGeneralsRef.current;
    for(const seat of permanents.seats){
      const before=previous.seats.find(entry=>entry.seat===seat.seat)?.general;
      if(!before||before.zone===seat.general.zone)continue;
      gameRef.current?.events.emit(GENERAL_EVENT,{seat:seat.seat,from:before.zone,to:seat.general.zone,name:seat.general.name});
    }
    previousGeneralsRef.current=permanents;
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
    const next={status:combat.status,winnerSeat:combat.winnerSeat,eliminatedSeats:[...combat.eliminatedSeats].sort((a,b)=>a-b)};
    const previous=previousOutcomeRef.current;
    previousOutcomeRef.current=next;
    const newlyEliminated=previous?next.eliminatedSeats.filter(seat=>!previous.eliminatedSeats.includes(seat)):[];
    if(previous&&newlyEliminated.length===0&&previous.status===next.status&&previous.winnerSeat===next.winnerSeat)return;
    const outcome={...next,newlyEliminated};
    if(gameRef.current)gameRef.current.events.emit(OUTCOME_EVENT,outcome);
    else queuedOutcomeFxRef.current.push(outcome);
  },[combat.status,combat.winnerSeat,combat.eliminatedSeats]);

  useEffect(()=>{
    const next={activeSeat:combat.activeSeat,turn:combat.turn,round:combat.round,phase:combat.phase};
    const previous=previousTurnRef.current;
    previousTurnRef.current=next;
    if(!previous)return;
    if(previous.activeSeat===next.activeSeat&&previous.turn===next.turn&&previous.round===next.round&&previous.phase===next.phase)return;
    if(gameRef.current)gameRef.current.events.emit(TURN_EVENT,next);
  },[combat.activeSeat,combat.turn,combat.round,combat.phase]);

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
    const previousHand=previousHandRef.current;
    const currentHandIds=new Set(hand.map(card=>card.instanceId));
    const handDepartures=previousHand.filter(card=>!currentHandIds.has(card.instanceId));
    const availableDepartures=[...handDepartures];
    const viewerHandDepartures:Record<string,CommanderPhaserHandCard>={};
    for(const item of entered){
      if(item.controllerSeat!==viewerSeat||!item.defId)continue;
      const index=availableDepartures.findIndex(card=>card.defId===item.defId);
      if(index<0)continue;
      viewerHandDepartures[item.id]=availableDepartures.splice(index,1)[0];
    }
    previousHandRef.current=hand;
    const previousPermanentIds=new Set(previousPermanentsRef.current.seats.flatMap(seat=>seat.battlefield.map(object=>object.id)));
    const arrivals=permanents.seats.flatMap(seat=>seat.battlefield.filter(object=>!previousPermanentIds.has(object.id)).map(object=>({id:object.id,defId:object.defId,seat:seat.seat})));
    const availableArrivals=[...arrivals];
    const battlefieldArrivals:Record<string,{id:string;seat:number;defId:string}>={};
    for(const item of departed){
      const index=availableArrivals.findIndex(object=>(item.sourceId&&object.id===item.sourceId)||Boolean(item.defId&&object.defId===item.defId));
      if(index<0)continue;
      battlefieldArrivals[item.id]=availableArrivals.splice(index,1)[0];
    }
    previousPermanentsRef.current=permanents;
    const fx:CommanderPhaserStackFx={revision:combat.revision,entered,departed,viewerHandDepartures,battlefieldArrivals};
    if(gameRef.current)gameRef.current.events.emit(STACK_EVENT,fx);
    else queuedStackFxRef.current.push(fx);
  },[combat.revision,stack,hand,permanents,viewerSeat]);

  useEffect(()=>{
    previousHandRef.current=hand;
  },[hand]);

  useEffect(()=>{
    previousPermanentsRef.current=permanents;
  },[permanents]);

  return <div
    ref={hostRef}
    className="pointer-events-none absolute inset-0 z-[15] overflow-hidden rounded-[2rem]"
    aria-hidden="true"
    data-commander-phaser-runtime="presentation-only"
    data-match-status={combat.status}
    data-winner-seat={combat.winnerSeat??""}
  />;
}
