import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { db } from "@/db";
import { playerCards } from "@/db/schema";
import { allCards } from "@/game/cards";
// @ts-expect-error Shared Chrome bootstrap is an intentional JavaScript E2E helper without a declaration file.\nimport { CHROME_REMOTE_DEBUGGING_FLAG, waitForChromeDevToolsPort } from "./chrome-devtools-bootstrap.mjs";

const baseUrl=(process.env.E2E_BASE_URL||"http://127.0.0.1:3000").replace(/\/$/,"");
const outputDir=resolve(process.env.ALPHA_VISUAL_DIR||"artifacts/alpha-visual");
const viewport={width:1280,height:900,deviceScaleFactor:1,mobile:false};
const runId=Date.now().toString(36).slice(-7);
const participantNames=[1,2,3,4].map((seat)=>`Commander P${seat} ${runId}`);

function sleep(ms:number){return new Promise((resolvePromise)=>setTimeout(resolvePromise,ms));}

function findChrome(){
  const candidates=[process.env.CHROME_BIN,"google-chrome","google-chrome-stable","chromium","chromium-browser"].filter(Boolean) as string[];
  for(const candidate of candidates){
    const result=spawnSync("which",[candidate],{encoding:"utf8"});
    if(result.status===0&&result.stdout.trim())return result.stdout.trim();
  }
  throw new Error(`Chrome/Chromium not found. Tried: ${candidates.join(", ")}`);
}

async function waitForChrome(port:number,timeoutMs=15_000){
  const deadline=Date.now()+timeoutMs;
  while(Date.now()<deadline){
    try{
      const response=await fetch(`http://127.0.0.1:${port}/json/list`);
      if(response.ok){
        const targets=await response.json() as Array<{type:string;webSocketDebuggerUrl?:string}>;
        const page=targets.find((target)=>target.type==="page"&&target.webSocketDebuggerUrl);
        if(page?.webSocketDebuggerUrl)return page.webSocketDebuggerUrl;
      }
    }catch{}
    await sleep(100);
  }
  throw new Error("Chrome remote debugging endpoint did not become ready");
}

class CdpClient{
  socket:WebSocket;
  nextId=1;
  pending=new Map<number,{resolve:(value:any)=>void;reject:(error:Error)=>void;method:string}>();
  notifications:any[]=[];
  constructor(socket:WebSocket){
    this.socket=socket;
    socket.addEventListener("message",(event)=>{
      const message=JSON.parse(String(event.data));
      if(message.id){
        const pending=this.pending.get(message.id);
        if(!pending)return;
        this.pending.delete(message.id);
        if(message.error)pending.reject(new Error(`${pending.method}: ${message.error.message}`));
        else pending.resolve(message.result||{});
        return;
      }
      this.notifications.push(message);
    });
    socket.addEventListener("close",()=>{
      for(const pending of this.pending.values())pending.reject(new Error("Chrome DevTools connection closed"));
      this.pending.clear();
    });
  }
  static async connect(url:string){
    assert.equal(typeof WebSocket,"function","Node 22 WebSocket global is required for Commander browser certification");
    const socket=new WebSocket(url);
    await new Promise<void>((resolvePromise,reject)=>{
      const timeout=setTimeout(()=>reject(new Error("Timed out opening Chrome DevTools WebSocket")),10_000);
      socket.addEventListener("open",()=>{clearTimeout(timeout);resolvePromise();},{once:true});
      socket.addEventListener("error",()=>{clearTimeout(timeout);reject(new Error("Failed to open Chrome DevTools WebSocket"));},{once:true});
    });
    return new CdpClient(socket);
  }
  call(method:string,params:Record<string,unknown>={}){
    const id=this.nextId++;
    this.socket.send(JSON.stringify({id,method,params}));
    return new Promise<any>((resolvePromise,reject)=>this.pending.set(id,{resolve:resolvePromise,reject,method}));
  }
  close(){this.socket.close();}
}

type Browser={
  label:string;
  profileDir:string;
  chrome:ChildProcess;
  cdp:CdpClient;
  stderr:string;
  identity?:{id:number;name:string};
};

async function evaluate<T=any>(cdp:CdpClient,expression:string):Promise<T>{
  const result=await cdp.call("Runtime.evaluate",{expression,awaitPromise:true,returnByValue:true,userGesture:true});
  if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text||"Runtime evaluation failed");
  return result.result?.value as T;
}

async function waitUntil<T>(
  check:()=>Promise<T|false|null|undefined>|T|false|null|undefined,
  label:string,
  timeoutMs=25_000,
):Promise<T>{
  const deadline=Date.now()+timeoutMs;
  let lastError:unknown;
  while(Date.now()<deadline){
    try{
      const value=await check();
      if(value!==false&&value!=null)return value;
    }catch(error){lastError=error;}
    await sleep(125);
  }
  throw new Error(`Timed out waiting for ${label}${lastError instanceof Error?`: ${lastError.message}`:""}`);
}

async function navigate(cdp:CdpClient,path:string){
  const target=path.startsWith("http")||path==="about:blank"?path:`${baseUrl}${path}`;
  await cdp.call("Page.navigate",{url:target});
  await waitUntil(()=>evaluate(cdp,"['interactive','complete'].includes(document.readyState)"),`navigation readiness for ${target}`);
  if(target!=="about:blank")await settle(cdp);
}

async function settle(cdp:CdpClient){
  await evaluate(cdp,`Promise.all([
    document.fonts?.ready || Promise.resolve(),
    Promise.all([...document.images].map((image)=>image.complete?Promise.resolve():new Promise((resolveImage)=>{
      image.addEventListener('load',resolveImage,{once:true});
      image.addEventListener('error',resolveImage,{once:true});
      setTimeout(resolveImage,3000);
    })))
  ])`);
  await sleep(180);
}

async function waitForText(cdp:CdpClient,text:string,timeoutMs=25_000){
  const encoded=JSON.stringify(text);
  return waitUntil(()=>evaluate(cdp,`document.body?.innerText?.includes(${encoded})===true`),`text ${encoded}`,timeoutMs);
}

async function clickText(cdp:CdpClient,text:string,exact=false){
  const encoded=JSON.stringify(text);
  const clicked=await evaluate<boolean>(cdp,`(()=>{
    const normalize=(value)=>String(value||'').replace(/\\s+/g,' ').trim();
    const target=[...document.querySelectorAll('button,a,[role="button"]')]
      .find((element)=>!element.disabled&&${exact?`normalize(element.textContent)===${encoded}`:`normalize(element.textContent).includes(${encoded})`});
    if(!target)return false;
    target.scrollIntoView({block:'center',inline:'center'});
    target.click();
    return true;
  })()`);
  assert.equal(clicked,true,`Could not click control ${exact?"equal to":"containing"} text: ${text}`);
}

async function waitForEnabledButton(cdp:CdpClient,text:string,timeoutMs=25_000){
  const encoded=JSON.stringify(text);
  return waitUntil(()=>evaluate(cdp,`(()=>{
    const normalize=(value)=>String(value||'').replace(/\\s+/g,' ').trim();
    return Boolean([...document.querySelectorAll('button')].find((button)=>normalize(button.textContent).includes(${encoded})&&!button.disabled));
  })()`),`enabled button containing ${text}`,timeoutMs);
}

async function setInputValue(cdp:CdpClient,selector:string,value:string){
  const changed=await evaluate<boolean>(cdp,`(()=>{
    const input=document.querySelector(${JSON.stringify(selector)});
    if(!input)return false;
    const descriptor=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');
    descriptor?.set?.call(input,${JSON.stringify(value)});
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.dispatchEvent(new Event('change',{bubbles:true}));
    return true;
  })()`);
  assert.equal(changed,true,`Could not set input value for ${selector}`);
}

async function setGeneral(cdp:CdpClient,defId:string){
  await waitUntil(()=>evaluate(cdp,`Boolean(document.querySelector('select option[value="${defId}"]'))`),`Commander General option ${defId}`);
  const changed=await evaluate<boolean>(cdp,`(()=>{
    const select=document.querySelector('select');
    if(!select)return false;
    const descriptor=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value');
    descriptor?.set?.call(select,${JSON.stringify(defId)});
    select.dispatchEvent(new Event('change',{bubbles:true}));
    return true;
  })()`);
  assert.equal(changed,true,"Could not select Commander General");
}

async function addCardCopy(cdp:CdpClient,name:string){
  await waitUntil(()=>evaluate(cdp,`(()=>{
    const normalize=(value)=>String(value||'').replace(/\\s+/g,' ').trim();
    const label=[...document.querySelectorAll('b')].find((node)=>normalize(node.textContent)===${JSON.stringify(name)});
    const row=label?.parentElement?.parentElement;
    const plus=row?[...row.querySelectorAll('button')].find((button)=>normalize(button.textContent)==='+'):null;
    return Boolean(plus&&!plus.disabled);
  })()`),`enabled add-card control for ${name}`);
  const clicked=await evaluate<boolean>(cdp,`(()=>{
    const normalize=(value)=>String(value||'').replace(/\\s+/g,' ').trim();
    const label=[...document.querySelectorAll('b')].find((node)=>normalize(node.textContent)===${JSON.stringify(name)});
    const row=label?.parentElement?.parentElement;
    const plus=row?[...row.querySelectorAll('button')].find((button)=>normalize(button.textContent)==='+'):null;
    if(!plus||plus.disabled)return false;
    plus.click();
    return true;
  })()`);
  assert.equal(clicked,true,`Could not add Commander deck card ${name}`);
  await sleep(30);
}

async function capture(browser:Browser,filename:string,stage:string,manifest:any[]){
  await settle(browser.cdp);
  await evaluate(browser.cdp,"window.scrollTo(0,0)");
  const metrics=await evaluate<any>(browser.cdp,`({
    href:location.href,
    innerWidth:window.innerWidth,
    innerHeight:window.innerHeight,
    scrollWidth:document.documentElement.scrollWidth,
    bodyText:(document.body?.innerText||'').slice(0,300)
  })`);
  assert.ok(metrics.scrollWidth<=metrics.innerWidth+2,`${stage} has horizontal overflow: ${metrics.scrollWidth}px > ${metrics.innerWidth}px`);
  const shot=await browser.cdp.call("Page.captureScreenshot",{format:"png",fromSurface:true,captureBeyondViewport:false});
  await mkdir(outputDir,{recursive:true});
  await writeFile(join(outputDir,filename),Buffer.from(shot.data,"base64"));
  manifest.push({browser:browser.label,stage,file:filename,...metrics});
}

async function waitForProcessExit(child:ChildProcess,timeoutMs:number){
  if(child.exitCode!=null||child.signalCode!=null)return true;
  return new Promise<boolean>((resolvePromise)=>{
    let finished=false;
    const finish=(exited:boolean)=>{
      if(finished)return;
      finished=true;
      clearTimeout(timer);
      child.removeListener("exit",onExit);
      resolvePromise(exited);
    };
    const onExit=()=>finish(true);
    const timer=setTimeout(()=>finish(false),timeoutMs);
    child.once("exit",onExit);
  });
}

async function shutdownBrowser(browser:Browser){
  try{browser.cdp.close();}catch{}
  if(browser.chrome.exitCode==null&&browser.chrome.signalCode==null)browser.chrome.kill("SIGTERM");
  const terminated=await waitForProcessExit(browser.chrome,1500);
  if(!terminated&&browser.chrome.exitCode==null&&browser.chrome.signalCode==null){
    browser.chrome.kill("SIGKILL");
    await waitForProcessExit(browser.chrome,2000);
  }
  await rm(browser.profileDir,{recursive:true,force:true,maxRetries:5,retryDelay:200}).catch(()=>{});
}

async function launchBrowser(label:string,chromePath:string):Promise<Browser>{
  const profileDir=await mkdtemp(join(tmpdir(),`runeforge-commander-${label}-`));
  const chrome=spawn(chromePath,[
    "--headless=new","--disable-gpu","--no-sandbox","--disable-dev-shm-usage","--hide-scrollbars","--mute-audio",
    CHROME_REMOTE_DEBUGGING_FLAG,`--user-data-dir=${profileDir}`,`--window-size=${viewport.width},${viewport.height}`,"about:blank",
  ],{stdio:["ignore","ignore","pipe"]});
  let stderr="";
  chrome.stderr.on("data",(chunk)=>{stderr+=String(chunk);});
  const port=await waitForChromeDevToolsPort({profileDir,chrome,getStderr:()=>stderr});
  const cdp=await CdpClient.connect(await waitForChrome(port));
  await cdp.call("Page.enable");
  await cdp.call("Runtime.enable");
  await cdp.call("Log.enable");
  await cdp.call("Emulation.setDeviceMetricsOverride",viewport);
  return {label,profileDir,chrome,cdp,get stderr(){return stderr;}};
}

async function registerPlayer(browser:Browser,displayName:string){
  await navigate(browser.cdp,"/api/health");
  const result=await evaluate<any>(browser.cdp,`(async()=>{
    const response=await fetch('/api/player',{
      method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({displayName:${JSON.stringify(displayName)}})
    });
    const body=await response.json().catch(()=>({}));
    return {status:response.status,body};
  })()`);
  assert.equal(result.status,201,`${browser.label} registration failed: ${JSON.stringify(result.body)}`);
  assert.equal(result.body?.ok,true,`${browser.label} registration did not return ok`);
  browser.identity={id:Number(result.body.player.id),name:String(result.body.player.name)};
}

function chooseLoadout(){
  const cards=allCards().filter((card)=>card.collectible!==false);
  const general=cards.find((candidate)=>{
    if(!candidate.isChampion&&!candidate.isLegend)return false;
    const sameRegion=cards.filter((card)=>card.defId!==candidate.defId&&card.region===candidate.region);
    const uniqueNames=new Set(sameRegion.map((card)=>card.name));
    return uniqueNames.size>=20;
  });
  assert.ok(general,"Commander browser cert requires a collectible Champion/Legend with at least 20 same-region cards");
  const seen=new Set<string>();
  const deckDefs=cards.filter((card)=>{
    if(card.defId===general.defId||card.region!==general.region||seen.has(card.name))return false;
    seen.add(card.name);
    return true;
  }).slice(0,20);
  assert.equal(deckDefs.length,20,"Commander browser cert requires 20 unique same-region deck definitions");
  return {
    general:{defId:general.defId,name:general.name,region:general.region},
    deckDefs:deckDefs.map((card)=>({defId:card.defId,name:card.name})),
    deckCards:deckDefs.flatMap((card)=>[card.defId,card.defId,card.defId]),
  };
}

async function seedOwnedLoadout(browsers:Browser[],loadout:ReturnType<typeof chooseLoadout>){
  const rows=browsers.flatMap((browser)=>{
    assert.ok(browser.identity);
    return [
      {playerId:browser.identity!.id,defId:loadout.general.defId,count:1},
      ...loadout.deckDefs.map((card)=>({playerId:browser.identity!.id,defId:card.defId,count:3})),
    ];
  });
  await db.insert(playerCards).values(rows);
}

async function configureLoadout(browser:Browser,loadout:ReturnType<typeof chooseLoadout>){
  await navigate(browser.cdp,"/commander");
  await waitForText(browser.cdp,"Commander 4P Alpha");
  await setGeneral(browser.cdp,loadout.general.defId);
  await waitForText(browser.cdp,`General fora do deck: ${loadout.general.name}`);
  for(const card of loadout.deckDefs){
    for(let copy=0;copy<3;copy++)await addCardCopy(browser.cdp,card.name);
  }
  await waitForText(browser.cdp,"60/60");
}

async function fetchCommander(browser:Browser,code:string){
  return evaluate<any>(browser.cdp,`(async()=>{
    const response=await fetch('/api/commander/${code}',{credentials:'include',cache:'no-store'});
    const body=await response.json().catch(()=>({}));
    return {status:response.status,body};
  })()`);
}

async function waitForAllRoomVersion(browsers:Browser[],code:string,minimumRevision:number,timeoutMs=20_000){
  return waitUntil(async()=>{
    const responses=await Promise.all(browsers.map((browser)=>fetchCommander(browser,code)));
    if(responses.some((response)=>response.status!==200||!response.body?.room?.combat))return false;
    const revisions=responses.map((response)=>Number(response.body.room.combat.revision));
    if(revisions.some((revision)=>revision<minimumRevision))return false;
    if(new Set(revisions).size!==1)return false;
    return responses;
  },`all four Commander clients at revision >= ${minimumRevision}`,timeoutMs);
}

function validateFourClientProjection(responses:any[],label:string){
  const rooms=responses.map((response)=>response.body.room);
  const revisions=rooms.map((room)=>room.combat.revision);
  assert.equal(new Set(revisions).size,1,`${label}: combat revisions must match across four clients`);
  const viewerSeats=rooms.map((room)=>room.viewerSeat).sort((a:number,b:number)=>a-b);
  assert.deepEqual(viewerSeats,[0,1,2,3],`${label}: all four distinct viewer seats must be represented`);
  const ownHands=new Map<number,string[]>();
  for(const room of rooms){
    assert.equal(room.state,"playing",`${label}: room must be playing`);
    assert.equal(room.combat.status,"active",`${label}: combat must be active`);
    const own=room.combat.seats.find((seat:any)=>seat.seat===room.viewerSeat);
    assert.ok(Array.isArray(own?.hand),`${label}: viewer P${room.viewerSeat+1} must receive private hand identities`);
    assert.equal(own.hand.length,5,`${label}: viewer P${room.viewerSeat+1} starting hand must contain 5 cards`);
    ownHands.set(room.viewerSeat,own.hand.map((card:any)=>String(card.instanceId)));
    for(const seat of room.combat.seats){
      if(seat.seat===room.viewerSeat)continue;
      assert.equal(seat.hand,undefined,`${label}: opponent P${seat.seat+1} hand identities must be hidden`);
      assert.equal(seat.handCount,5,`${label}: opponent P${seat.seat+1} public hand count must remain visible`);
    }
  }
  for(const room of rooms){
    const serialized=JSON.stringify(room);
    for(const [seat,ids] of ownHands){
      if(seat===room.viewerSeat)continue;
      for(const id of ids)assert.equal(serialized.includes(id),false,`${label}: P${room.viewerSeat+1} leaked P${seat+1} private hand identity ${id}`);
    }
  }
  return rooms;
}

async function main(){
  await mkdir(outputDir,{recursive:true});
  const chromePath=findChrome();
  const manifest:any[]=[];
  const browsers=await Promise.all([0,1,2,3].map((index)=>launchBrowser(`p${index+1}`,chromePath)));
  try{
    for(let i=0;i<browsers.length;i++)await registerPlayer(browsers[i],participantNames[i]);
    assert.equal(new Set(browsers.map((browser)=>browser.identity!.id)).size,4,"Commander certification requires four independent player identities");

    const loadout=chooseLoadout();
    assert.equal(loadout.deckCards.length,60);
    await seedOwnedLoadout(browsers,loadout);
    for(const browser of browsers)await configureLoadout(browser,loadout);

    const host=browsers[0];
    await waitForEnabledButton(host.cdp,"Criar sala 4P");
    await clickText(host.cdp,"Criar sala 4P",true);
    const roomCode=await waitUntil(()=>evaluate<string>(host.cdp,`(
      [...document.querySelectorAll('p')].map((node)=>(node.textContent||'').trim()).find((text)=>/^Sala [A-Z2-9]{6}$/.test(text))||''
    ).replace(/^Sala /,'')`),"Commander host room code");
    assert.match(roomCode,/^[A-Z2-9]{6}$/);

    for(const guest of browsers.slice(1)){
      await setInputValue(guest.cdp,'input[placeholder="Código da sala"]',roomCode);
      await waitForEnabledButton(guest.cdp,"Entrar");
      await clickText(guest.cdp,"Entrar",true);
      await waitForText(guest.cdp,`Sala ${roomCode}`);
    }

    await waitUntil(async()=>{
      const response=await fetchCommander(host,roomCode);
      return response.status===200&&response.body?.room?.seats?.length===4;
    },"Commander room to reach 4/4 seats");
    await waitForText(host.cdp,participantNames[3],20_000);
    await capture(host,"62-commander-4p-lobby.png","Commander four-player lobby at 4/4",manifest);

    for(const browser of browsers){
      await waitForEnabledButton(browser.cdp,"Estou pronto",20_000);
      await clickText(browser.cdp,"Estou pronto",true);
      await waitForText(browser.cdp,"Retirar ready",20_000);
    }
    await waitForEnabledButton(host.cdp,"Iniciar com 4 jogadores",30_000);
    await clickText(host.cdp,"Iniciar com 4 jogadores",true);

    await Promise.all(browsers.map(async(browser)=>{
      await waitForText(browser.cdp,"Partida 4P iniciada",30_000);
      await waitForText(browser.cdp,"PRIORIDADE",30_000);
    }));

    let responses=await waitForAllRoomVersion(browsers,roomCode,1,30_000);
    let rooms=validateFourClientProjection(responses,"initial Commander battlefield");
    const initialRevision=rooms[0].combat.revision;

    for(let i=0;i<browsers.length;i++){
      await capture(browsers[i],`${63+i}-commander-4p-seat-${i+1}.png`,`Commander live battlefield viewer P${i+1}`,manifest);
    }

    const holders:number[]=[];
    for(let pass=0;pass<4;pass++){
      rooms=responses.map((response)=>response.body.room);
      const revision=rooms[0].combat.revision;
      const holder=rooms[0].combat.prioritySeat;
      holders.push(holder);
      const holderRoom=rooms.find((room)=>room.viewerSeat===holder);
      assert.ok(holderRoom,`priority holder P${holder+1} must have a browser client`);
      const browser=browsers[holderRoom.viewerSeat];
      await waitForText(browser.cdp,`rev ${revision}`,15_000);
      await waitForEnabledButton(browser.cdp,"Passar prioridade",15_000);
      await clickText(browser.cdp,"Passar prioridade");
      responses=await waitForAllRoomVersion(browsers,roomCode,revision+1,20_000);
      validateFourClientProjection(responses,`after priority pass ${pass+1}`);
    }
    assert.equal(new Set(holders).size,4,`circular priority must reach all four seats before reset: ${holders.join(",")}`);
    for(let i=1;i<holders.length;i++){
      assert.equal(holders[i],(holders[i-1]+1)%4,`priority must rotate clockwise: ${holders.join(" -> ")}`);
    }

    const finalRooms=responses.map((response)=>response.body.room);
    const settledRevision=finalRooms[0].combat.revision;
    assert.equal(settledRevision,initialRevision+4,"four browser passes must commit four authoritative revisions");
    assert.equal(new Set(finalRooms.map((room)=>room.combat.revision)).size,1,"all four clients must converge on the settled revision");

    for(const browser of browsers){
      const runtimeExceptions=browser.cdp.notifications.filter((message)=>message.method==="Runtime.exceptionThrown");
      assert.equal(runtimeExceptions.length,0,`${browser.label} browser runtime exceptions detected: ${JSON.stringify(runtimeExceptions.slice(0,3))}`);
    }

    const report={
      ok:true,
      gitSha:process.env.GITHUB_SHA||null,
      capturedAt:new Date().toISOString(),
      baseUrl,
      roomCode,
      viewport,
      participants:browsers.map((browser)=>({label:browser.label,id:browser.identity!.id,name:browser.identity!.name})),
      loadout:{general:loadout.general,deckSize:loadout.deckCards.length,uniqueDeckDefinitions:loadout.deckDefs.length},
      initialRevision,
      settledRevision,
      priorityHolders:holders,
      proof:{
        independentBrowserProfiles:4,
        independentStablePlayerSessions:4,
        ownedCommanderLoadouts:true,
        realCommanderLobbyUi:true,
        realFourSeatReadyStart:true,
        perSeatPrivateProjection:true,
        opponentHandIdentityRedaction:true,
        circularPriorityViaUi:true,
        authoritativeRevisionConvergence:true,
        browserRuntimeExceptions:0,
      },
      screenshots:manifest,
    };
    await writeFile(join(outputDir,"commander-4p-browser-manifest.json"),`${JSON.stringify(report,null,2)}\n`);
    console.log(`COMMANDER 4P FOUR-BROWSER E2E: PASS — ${roomCode}, rev ${initialRevision} → ${settledRevision}, priority ${holders.map((seat)=>`P${seat+1}`).join(" → ")}`);
  }finally{
    await Promise.all(browsers.map((browser)=>shutdownBrowser(browser)));
    if(process.env.ALPHA_VISUAL_DEBUG==="1"){
      for(const browser of browsers)if(browser.stderr)console.error(`[${browser.label} Chrome]\n${browser.stderr}`);
    }
  }
}

void main().catch((error)=>{
  console.error("COMMANDER 4P FOUR-BROWSER E2E: FAIL",error);
  process.exitCode=1;
});
