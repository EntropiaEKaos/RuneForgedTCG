"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  projectAuthoritativeCombatDelta,
  type AuthoritativeCombatProjection,
} from "@/game/presentation/phaser/BattlefieldAuthoritativeCombatAdapter";
import type { BattlefieldCombatPresentationFrame } from "@/game/presentation/phaser/BattlefieldCombatPresentation";

type CombatProjection = {
  revision:number;
  attackers:Array<{unitId:string;controllerSeat:number;defendingSeat:number}>;
  blockers:Array<{unitId:string;controllerSeat:number;attackerId:string}>;
};

type PhaserGameHandle = {
  destroy:(removeCanvas?:boolean)=>void;
  events:{emit:(event:string,...args:unknown[])=>unknown};
  canvas?:HTMLCanvasElement;
};

const FRAME_EVENT="runeforged:commander:combat-frame";

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

export default function CommanderPhaserRuntime({
  combat,
  resolutionRevision,
  viewerSeat,
}:{
  combat:CombatProjection;
  resolutionRevision:number|null;
  viewerSeat:number;
}){
  const hostRef=useRef<HTMLDivElement|null>(null);
  const gameRef=useRef<PhaserGameHandle|null>(null);
  const previousProjectionRef=useRef<AuthoritativeCombatProjection|null>(null);
  const queuedFramesRef=useRef<BattlefieldCombatPresentationFrame[]>([]);

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
    resolution:resolutionRevision===combat.revision?{revision:resolutionRevision}:null,
  }),[combat,resolutionRevision]);

  useEffect(()=>{
    let disposed=false;
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
          for(const frame of queuedFramesRef.current.splice(0))this.renderFrame(frame);
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
              const orb=this.add.circle(start.x,start.y,7,tone,.95);
              const trail=this.add.line(0,0,start.x,start.y,impact.x,impact.y,tone,.28).setOrigin(0,0);
              this.tweens.add({
                targets:orb,
                x:impact.x,
                y:impact.y,
                alpha:0,
                scale:1.8,
                duration:850,
                ease:"Cubic.easeOut",
                onComplete:()=>{orb.destroy();trail.destroy();},
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
              const orb=this.add.circle(start.x,start.y,6,tone,.9);
              const trail=this.add.line(0,0,start.x,start.y,impact.x,impact.y,tone,.32).setOrigin(0,0);
              this.tweens.add({
                targets:orb,
                x:impact.x,
                y:impact.y,
                alpha:0,
                scale:1.6,
                duration:720,
                ease:"Cubic.easeOut",
                onComplete:()=>{orb.destroy();trail.destroy();},
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
    const previous=previousProjectionRef.current;
    previousProjectionRef.current=projection;
    const delta=projectAuthoritativeCombatDelta(previous,projection);
    if(!delta)return;
    for(const frame of delta.frames){
      if(gameRef.current)gameRef.current.events.emit(FRAME_EVENT,frame);
      else queuedFramesRef.current.push(frame);
    }
  },[projection]);

  return <div
    ref={hostRef}
    className="pointer-events-none absolute inset-0 z-[15] overflow-hidden rounded-[2rem]"
    aria-hidden="true"
    data-commander-phaser-runtime="presentation-only"
  />;
}
