"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type CollectionCard = {
  defId:string; name:string; region:string; rarity:string; owned:number;
  isChampion?:boolean; isLegend?:boolean; collectible?:boolean;
};
type Seat = { seat:number; playerId:number; playerName:string; generalDefId:string; ready:boolean; isHost:boolean; cardCount:number };
type Room = { code:string; state:string; activeSeat:number; round:number; version:number; viewerSeat:number|null; hostPlayerId:number; seats:Seat[]; rules:any; gameState:any };
type LobbySummary = { code:string; state:string; seatCount:number; viewerJoined:boolean };

const COUNT = 60;
function countOf(cards:string[], defId:string){ return cards.filter((id)=>id===defId).length; }

export default function CommanderClient(){
  const [collection,setCollection]=useState<CollectionCard[]>([]);
  const [deck,setDeck]=useState<string[]>([]);
  const [general,setGeneral]=useState("");
  const [rooms,setRooms]=useState<LobbySummary[]>([]);
  const [room,setRoom]=useState<Room|null>(null);
  const [joinCode,setJoinCode]=useState("");
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
  const loadout={deckCards:deck,generalDefId:general};
  const canSubmit=deck.length===COUNT&&Boolean(general)&&!busy;

  return <main className="min-h-screen bg-[#06090e] text-slate-100">
    <div className="mx-auto max-w-[1500px] px-5 py-8">
      <header className="border-b border-white/10 pb-6">
        <p className="text-[10px] font-black uppercase tracking-[.3em] text-amber-200/55">FORGED · EXPERIMENTAL MULTIPLAYER</p>
        <h1 className="mt-2 text-4xl font-black text-[#f1dfb5]">Commander 4P Alpha</h1>
        <p className="mt-3 max-w-4xl text-sm text-slate-400">Modo separado do 1v1: quatro jogadores reais, 60 cartas + 1 General, Nexus 30 e ordem de turno circular. Este Alpha certifica lobby, assentos, ready/start e autoridade de turno sem alterar Ranked ou o motor 1v1.</p>
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
              const active=room.state==="playing"&&room.activeSeat===seatIndex;
              return <article key={seatIndex} className={`min-h-40 border p-4 ${active?"border-amber-200/40 bg-amber-100/[.06]":"border-white/10 bg-black/20"}`}>
                <div className="flex items-center justify-between"><span className="text-[10px] font-black uppercase tracking-[.16em] text-slate-500">Assento {seatIndex+1}</span>{active&&<b className="text-xs text-amber-200">TURNO ATIVO</b>}</div>
                {seat?<><h3 className="mt-3 text-lg font-black">{seat.playerName}{seat.isHost?" · HOST":""}</h3><p className="mt-2 text-xs text-slate-400">General: <b className="text-slate-200">{seat.generalDefId}</b></p><p className="mt-1 text-xs text-slate-500">{seat.cardCount} cartas · {seat.ready?"PRONTO":"PREPARANDO"}</p></>:<p className="mt-8 text-sm text-slate-600">Aguardando jogador…</p>}
              </article>
            })}
          </div>
          {room.state==="playing"&&<div className="mt-5 border border-white/10 p-4"><p className="text-sm">Rodada <b>{room.round}</b> · ordem horária · Nexus inicial 30.</p>{room.viewerSeat===room.activeSeat&&<button className="btn-primary mt-3" disabled={busy} onClick={()=>void mutate(`/api/commander/${room.code}`,{action:"pass-turn"})}>Passar turno</button>}</div>}
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
