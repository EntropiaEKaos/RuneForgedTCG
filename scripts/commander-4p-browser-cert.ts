import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { commanderRooms, customCards, playerCards } from "@/db/schema";
import { allCards } from "@/game/cards";
import { refreshCustomCardCache } from "@/game/catalog";
import { validateAuthorableCardWithSemanticTypes } from "@/game/semantic-card-type-authoring";
import type { CardDef } from "@/game/types";
import { createFourPlayerResolutionFlow } from "@/game/four-player-flow";
import type { FourPlayerSeat } from "@/game/four-player-general";
import { commanderCombatPersistence, isCommanderCombatEnvelope } from "@/lib/commander-combat";
// @ts-expect-error Shared Chrome bootstrap is an intentional JavaScript E2E helper without a declaration file.
import { CHROME_REMOTE_DEBUGGING_FLAG, waitForChromeDevToolsPort } from "./chrome-devtools-bootstrap.mjs";

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
      if(value)return value as T;
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

async function waitForSelector(cdp:CdpClient,selector:string,timeoutMs=25_000){
  const encoded=JSON.stringify(selector);
  return waitUntil(()=>evaluate(cdp,`Boolean(document.querySelector(${encoded}))`),`selector ${encoded}`,timeoutMs);
}

async function waitForCommanderUiAuthority(
  browser:Browser,
  revision:number,
  priorityState:"yours"|"urgent"|"waiting"="yours",
  timeoutMs=25_000,
){
  await evaluate(browser.cdp,`(()=>{ window.dispatchEvent(new Event('focus')); return true; })()`);
  const revisionText=JSON.stringify(`rev ${revision}`);
  const state=JSON.stringify(priorityState);
  return waitUntil(()=>evaluate(browser.cdp,`(()=>{
    const bodyText=document.body?.innerText||'';
    const priority=document.querySelector('[data-commander-priority-state]');
    return bodyText.includes(${revisionText})&&priority?.getAttribute('data-commander-priority-state')===${state};
  })()`),`${browser.label} Commander UI revision ${revision} with priority state ${priorityState}`,timeoutMs);
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

async function waitForDisabledButton(cdp:CdpClient,text:string,timeoutMs=25_000){
  const encoded=JSON.stringify(text);
  return waitUntil(()=>evaluate(cdp,`(()=>{
    const normalize=(value)=>String(value||'').replace(/\\s+/g,' ').trim();
    return Boolean([...document.querySelectorAll('button')].find((button)=>normalize(button.textContent).includes(${encoded})&&button.disabled));
  })()`),`disabled button containing ${text}`,timeoutMs);
}

async function sendForgedCommanderCombatCommand(
  browser:Browser,
  code:string,
  expectedRevision:number,
  commandType:string,
  payload:Record<string,unknown>,
){
  return evaluate<any>(browser.cdp,`(async()=>{
    const response=await fetch('/api/commander/${code}',{
      method:'POST',credentials:'include',headers:{'content-type':'application/json'},
      body:JSON.stringify({
        action:'combat-command',
        commandType:${JSON.stringify(commandType)},
        expectedRevision:${expectedRevision},
        commandId:crypto.randomUUID(),
        payload:${JSON.stringify(payload)}
      })
    });
    const body=await response.json().catch(()=>({}));
    return {status:response.status,body};
  })()`);
}

function validateCiAuthoredCard(raw:Partial<CardDef>):CardDef{
  const result=validateAuthorableCardWithSemanticTypes(raw);
  if(!result.ok)throw new Error(`CI Commander legality fixture must pass Studio authoring validation: ${result.error}`);
  return result.card;
}

async function seedCommanderLegalityCatalog(){
  const cards=[
    validateCiAuthoredCard({
      defId:`ci_cmd_unit_${runId}`,
      name:`CI Tide Unit ${runId}`,
      region:"Tidecall",
      type:"Unit",
      cost:1,
      power:1,
      health:1,
      description:"CI-only Commander reaction legality fixture.",
      rarity:"Common",
      emoji:"🧪",
    }),
    validateCiAuthoredCard({
      defId:`ci_cmd_spell_counter_${runId}`,
      name:`CI Spell-Only Deny ${runId}`,
      region:"Tidecall",
      type:"Spell",
      cost:1,
      speed:"Burst",
      spell:{kind:"negateSpell",amount:0,target:"spellOnStack"},
      customKeywords:["counter_spell"],
      description:"CI-only Burst counter restricted to Spells.",
      rarity:"Rare",
      emoji:"🧪",
    }),
    validateCiAuthoredCard({
      defId:`ci_cmd_uncounterable_${runId}`,
      name:`CI Uncounterable Current ${runId}`,
      region:"Tidecall",
      type:"Spell",
      cost:1,
      speed:"Fast",
      spell:{kind:"draw",amount:1,target:"none"},
      customKeywords:["uncounterable"],
      description:"CI-only Fast Spell that cannot be countered.",
      rarity:"Rare",
      emoji:"🧪",
    }),
  ];
  await db.insert(customCards).values(cards.map((card)=>({
    defId:card.defId,
    name:card.name,
    region:card.region,
    type:card.type,
    cost:card.cost,
    enabled:true,
    data:card,
  })));
  await refreshCustomCardCache();
  const catalog=new Map(allCards().map((card)=>[card.defId,card]));
  for(const card of cards)assert.ok(catalog.has(card.defId),`custom Commander legality fixture ${card.defId} must enter the server catalog`);
  return {
    unit:cards[0],
    spellOnlyCounter:cards[1],
    uncounterableSpell:cards[2],
    defIds:cards.map((card)=>card.defId),
  };
}

async function cleanupCommanderLegalityCatalog(defIds:string[]){
  for(const defId of defIds){
    await db.delete(playerCards).where(eq(playerCards.defId,defId));
    await db.delete(customCards).where(eq(customCards.defId,defId));
  }
  await refreshCustomCardCache();
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

function chooseLoadout(legality:Awaited<ReturnType<typeof seedCommanderLegalityCatalog>>){
  const cards=allCards().filter((card)=>card.collectible!==false);
  const sourceSpell=cards.find((card)=>card.defId==="tide_erosion");
  const counterSpell=cards.find((card)=>card.defId==="tide_deny");
  assert.ok(sourceSpell&&counterSpell,"Commander reaction cert requires Tidecall source/counter fixtures");
  assert.equal(sourceSpell.region,counterSpell.region,"Commander reaction source and counter must share a legal Commander region");
  assert.equal(counterSpell.speed,"Burst");
  assert.equal(counterSpell.spell?.kind,"negateSpell");
  assert.equal(sourceSpell.spell?.kind,"mill");
  const sourceAmount=Number(sourceSpell.spell?.amount||0);
  assert.ok(sourceAmount>0,"Commander reaction source fixture must mill at least one card");

  const general=cards.find((candidate)=>{
    if((!candidate.isChampion&&!candidate.isLegend)||candidate.region!==sourceSpell.region)return false;
    const sameRegion=cards.filter((card)=>card.defId!==candidate.defId&&card.region===candidate.region);
    const uniqueNames=new Set(sameRegion.map((card)=>card.name));
    return uniqueNames.size>=20;
  });
  assert.ok(general,"Commander browser cert requires a Tidecall Champion/Legend with at least 20 same-region cards");

  const required=[sourceSpell,counterSpell,legality.unit,legality.spellOnlyCounter,legality.uncounterableSpell];
  const seen=new Set(required.map((card)=>card.name));
  const fillers=cards.filter((card)=>{
    if(card.defId===general.defId||card.region!==general.region||required.some((requiredCard)=>requiredCard.defId===card.defId)||seen.has(card.name))return false;
    seen.add(card.name);
    return true;
  });
  const deckDefs=[...required,...fillers].slice(0,20);
  assert.equal(deckDefs.length,20,"Commander browser cert requires 20 unique same-region deck definitions");

  return {
    general:{defId:general.defId,name:general.name,region:general.region},
    deckDefs:deckDefs.map((card)=>({defId:card.defId,name:card.name})),
    deckCards:deckDefs.flatMap((card)=>[card.defId,card.defId,card.defId]),
    reaction:{
      source:{defId:sourceSpell.defId,name:sourceSpell.name,amount:sourceAmount},
      counter:{defId:counterSpell.defId,name:counterSpell.name},
    },
    legality:{
      unit:{defId:legality.unit.defId,name:legality.unit.name},
      spellOnlyCounter:{defId:legality.spellOnlyCounter.defId,name:legality.spellOnlyCounter.name},
      uncounterableSpell:{defId:legality.uncounterableSpell.defId,name:legality.uncounterableSpell.name},
    },
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

function swapDefinitionIntoHand(
  zones:any,
  seat:FourPlayerSeat,
  defId:string,
){
  const source=zones[seat];
  const existing=source.hand.find((card:any)=>card.defId===defId);
  if(existing)return {zones,card:existing};
  const deckIndex=source.deck.findIndex((card:any)=>card.defId===defId);
  assert.ok(deckIndex>=0,`${seat} reaction fixture is missing ${defId} in its deck`);
  const card=source.deck[deckIndex];
  const displaced=source.hand[0];
  const deck=[...source.deck];
  deck.splice(deckIndex,1);
  if(displaced)deck.push(displaced);
  const hand=displaced?[card,...source.hand.slice(1)]:[...source.hand,card];
  return {
    card,
    zones:{...zones,[seat]:{...source,hand,deck}},
  };
}

async function seedCommanderReactionFixture(roomCode:string,loadout:ReturnType<typeof chooseLoadout>){
  const [row]=await db.select().from(commanderRooms).where(eq(commanderRooms.code,roomCode)).limit(1);
  assert.ok(row&&isCommanderCombatEnvelope(row.gameState),"Commander reaction fixture requires a live combat envelope");

  let zones=row.gameState.zones;
  const sourceSwap=swapDefinitionIntoHand(zones,"p1",loadout.reaction.source.defId);
  zones=sourceSwap.zones;
  const counterSwap=swapDefinitionIntoHand(zones,"p2",loadout.reaction.counter.defId);
  zones=counterSwap.zones;
  const counterOfCounterSwap=swapDefinitionIntoHand(zones,"p3",loadout.reaction.counter.defId);
  zones=counterOfCounterSwap.zones;

  const match={
    ...row.gameState.match,
    phase:"main_1" as const,
    turn:{...row.gameState.match.turn,activeSeat:"p1" as const},
    seats:{
      ...row.gameState.match.seats,
      p1:{...row.gameState.match.seats.p1,mana:10,maxMana:10,spellMana:3},
      p2:{...row.gameState.match.seats.p2,mana:10,maxMana:10,spellMana:3},
      p3:{...row.gameState.match.seats.p3,mana:10,maxMana:10,spellMana:3},
    },
    resolution:createFourPlayerResolutionFlow(
      "p1",
      row.gameState.match.turn.eliminatedSeats,
      row.gameState.match.resolution.priority.mode,
    ),
  };
  const next={
    ...row.gameState,
    match,
    zones,
    protocol:{...row.gameState.protocol,revision:row.gameState.protocol.revision+1},
  };
  const persistence=commanderCombatPersistence(next);
  const [updated]=await db.update(commanderRooms).set({...persistence,updatedAt:new Date()})
    .where(eq(commanderRooms.id,row.id)).returning();
  assert.ok(updated,"Commander reaction fixture failed to persist");
  return {
    revision:next.protocol.revision,
    sourceInstanceId:sourceSwap.card.instanceId,
    counterInstanceId:counterSwap.card.instanceId,
    counterOfCounterInstanceId:counterOfCounterSwap.card.instanceId,
    targetDeckCount:next.zones.p2.deck.length,
  };
}

async function seedCommanderLegalityFixture(
  roomCode:string,
  sourceDefId:string,
  responderDefId:string,
){
  const [row]=await db.select().from(commanderRooms).where(eq(commanderRooms.code,roomCode)).limit(1);
  assert.ok(row&&isCommanderCombatEnvelope(row.gameState),"Commander legality fixture requires a live combat envelope");

  let zones=row.gameState.zones;
  const sourceSwap=swapDefinitionIntoHand(zones,"p1",sourceDefId);
  zones=sourceSwap.zones;
  const responderSwap=swapDefinitionIntoHand(zones,"p2",responderDefId);
  zones=responderSwap.zones;

  const match={
    ...row.gameState.match,
    phase:"main_1" as const,
    turn:{...row.gameState.match.turn,activeSeat:"p1" as const},
    seats:{
      ...row.gameState.match.seats,
      p1:{...row.gameState.match.seats.p1,mana:10,maxMana:10,spellMana:3},
      p2:{...row.gameState.match.seats.p2,mana:10,maxMana:10,spellMana:3},
    },
    resolution:createFourPlayerResolutionFlow(
      "p1",
      row.gameState.match.turn.eliminatedSeats,
      row.gameState.match.resolution.priority.mode,
    ),
  };
  const next={
    ...row.gameState,
    match,
    zones,
    protocol:{...row.gameState.protocol,revision:row.gameState.protocol.revision+1},
  };
  const persistence=commanderCombatPersistence(next);
  const [updated]=await db.update(commanderRooms).set({...persistence,updatedAt:new Date()})
    .where(eq(commanderRooms.id,row.id)).returning();
  assert.ok(updated,"Commander legality fixture failed to persist");
  return {
    revision:next.protocol.revision,
    sourceInstanceId:sourceSwap.card.instanceId,
    responderInstanceId:responderSwap.card.instanceId,
    sourceHandCount:next.zones.p1.hand.length,
    sourceDeckCount:next.zones.p1.deck.length,
    responderHandCount:next.zones.p2.hand.length,
    handCounts:[
      next.zones.p1.hand.length,
      next.zones.p2.hand.length,
      next.zones.p3.hand.length,
      next.zones.p4.hand.length,
    ] as [number,number,number,number],
  };
}

async function joinCommanderRoomViaCode(browser:Browser,code:string){
  await setInputValue(browser.cdp,'input[placeholder="Código da sala"]',code);
  await waitUntil(()=>evaluate(browser.cdp,`(()=>{
    const input=document.querySelector('input[placeholder="Código da sala"]');
    const button=input?.parentElement?.querySelector('button');
    return Boolean(button&&!button.disabled&&(button.textContent||'').trim()==='Entrar');
  })()`),`${browser.label} code-join button for ${code}`);
  const clicked=await evaluate<boolean>(browser.cdp,`(()=>{
    const input=document.querySelector('input[placeholder="Código da sala"]');
    const button=input?.parentElement?.querySelector('button');
    if(!button||button.disabled||(button.textContent||'').trim()!=='Entrar')return false;
    button.click();
    return true;
  })()`);
  assert.equal(clicked,true,`${browser.label} could not click the code-specific Commander join button`);

  const joined=await waitUntil(async()=>{
    const response=await fetchCommander(browser,code);
    if(response.status===200&&response.body?.room?.code===code)return response;
    const error=await evaluate<string>(browser.cdp,`document.querySelector('.text-red-200')?.textContent||''`);
    if(error)throw new Error(`${browser.label} Commander join UI error: ${error}`);
    return false;
  },`${browser.label} authoritative membership in Commander room ${code}`,20_000);
  assert.equal(joined.body.room.code,code,`${browser.label} joined the wrong Commander room`);
  assert.ok(Number.isInteger(joined.body.room.viewerSeat),`${browser.label} must receive an authoritative Commander viewer seat after join`);

  await sleep(500);
  const roomVisible=await evaluate<boolean>(browser.cdp,`document.body?.innerText?.includes(${JSON.stringify(`Sala ${code}`)})===true`);
  if(!roomVisible){
    await navigate(browser.cdp,"/commander");
    await waitForText(browser.cdp,"Commander 4P Alpha");
    const encodedRoomLabel=JSON.stringify(`Sala ${code}`);
    await waitUntil(()=>evaluate(browser.cdp,`(()=>{
      const normalize=(value)=>String(value||'').replace(/\\s+/g,' ').trim();
      const article=[...document.querySelectorAll('article')].find((node)=>normalize(node.textContent).includes(${encodedRoomLabel}));
      const button=article?.querySelector('button');
      return Boolean(button&&!button.disabled&&['Abrir','Entrar'].includes(normalize(button.textContent)));
    })()`),`${browser.label} reconnect room card for ${code}`,20_000);
    const opened=await evaluate<boolean>(browser.cdp,`(()=>{
      const normalize=(value)=>String(value||'').replace(/\\s+/g,' ').trim();
      const article=[...document.querySelectorAll('article')].find((node)=>normalize(node.textContent).includes(${encodedRoomLabel}));
      const button=article?.querySelector('button');
      if(!button||button.disabled||!['Abrir','Entrar'].includes(normalize(button.textContent)))return false;
      button.click();
      return true;
    })()`);
    assert.equal(opened,true,`${browser.label} could not reopen the joined Commander room card ${code}`);
  }
  await waitForText(browser.cdp,`Sala ${code}`,20_000);
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

function validateFourClientProjection(
  responses:any[],
  label:string,
  expectedHandCounts:[number,number,number,number]=[5,5,5,5],
){
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
    assert.equal(own.hand.length,expectedHandCounts[room.viewerSeat],`${label}: viewer P${room.viewerSeat+1} private hand count must match authoritative expectation`);
    ownHands.set(room.viewerSeat,own.hand.map((card:any)=>String(card.instanceId)));
    for(const seat of room.combat.seats){
      if(seat.seat===room.viewerSeat)continue;
      assert.equal(seat.hand,undefined,`${label}: opponent P${seat.seat+1} hand identities must be hidden`);
      assert.equal(seat.handCount,expectedHandCounts[seat.seat],`${label}: opponent P${seat.seat+1} public hand count must remain visible`);
    }
  }
  for(const room of rooms){
    const serialized=JSON.stringify(room);
    for(const [seat,ids] of ownHands){
      if(seat===room.viewerSeat)continue;
      for(const id of ids)assert.equal(serialized.includes(JSON.stringify(id)),false,`${label}: P${room.viewerSeat+1} leaked P${seat+1} private hand identity ${id}`);
    }
  }
  return rooms;
}

async function main(){
  await mkdir(outputDir,{recursive:true});
  const chromePath=findChrome();
  const manifest:any[]=[];
  const browsers=await Promise.all([0,1,2,3].map((index)=>launchBrowser(`p${index+1}`,chromePath)));
  let legalityCatalog:Awaited<ReturnType<typeof seedCommanderLegalityCatalog>>|null=null;
  try{
    legalityCatalog=await seedCommanderLegalityCatalog();
    for(let i=0;i<browsers.length;i++)await registerPlayer(browsers[i],participantNames[i]);
    assert.equal(new Set(browsers.map((browser)=>browser.identity!.id)).size,4,"Commander certification requires four independent player identities");

    const loadout=chooseLoadout(legalityCatalog);
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
      await joinCommanderRoomViaCode(guest,roomCode);
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
      await waitForSelector(browser.cdp,'[data-commander-surface="table"] [data-commander-battlefield="cinematic-v1"]',30_000);
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
      await waitForCommanderUiAuthority(browser,revision,"yours",20_000);
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

    const reactionFixture=await seedCommanderReactionFixture(roomCode,loadout);
    responses=await waitForAllRoomVersion(browsers,roomCode,reactionFixture.revision,20_000);
    rooms=validateFourClientProjection(responses,"Commander deterministic reaction fixture");
    assert.equal(rooms[0].combat.phase,"main_1","reaction fixture must reopen a legal main phase");
    assert.equal(rooms[0].combat.prioritySeat,0,"reaction fixture must begin with P1 priority");

    const sourceBrowser=browsers[0];
    await waitForCommanderUiAuthority(sourceBrowser,reactionFixture.revision,"yours",20_000);
    await waitForEnabledButton(sourceBrowser.cdp,loadout.reaction.source.name,15_000);
    await clickText(sourceBrowser.cdp,loadout.reaction.source.name);
    await waitForEnabledButton(sourceBrowser.cdp,"Nexus P2",15_000);
    await clickText(sourceBrowser.cdp,"Nexus P2",true);

    responses=await waitForAllRoomVersion(browsers,roomCode,reactionFixture.revision+1,20_000);
    rooms=validateFourClientProjection(responses,"after Commander source spell",[4,5,5,5]);
    const sourceRevision=rooms[0].combat.revision;
    assert.equal(rooms[0].combat.stack.length,1,"source spell must open exactly one real Commander stack item");
    assert.equal(rooms[0].combat.stack[0].defId,loadout.reaction.source.defId,"source spell identity must be projected on the public stack");
    assert.equal(rooms[0].combat.prioritySeat,1,"priority must move from source P1 to responder P2");

    const counterBrowser=browsers[1];
    await waitForCommanderUiAuthority(counterBrowser,sourceRevision,"yours",20_000);
    await waitForText(counterBrowser.cdp,"Janela de reação aberta",15_000);
    await capture(counterBrowser,"67-commander-4p-reaction-window-p2.png","Commander P2 authoritative reaction window",manifest);
    await waitForEnabledButton(counterBrowser.cdp,loadout.reaction.counter.name,15_000);
    await clickText(counterBrowser.cdp,loadout.reaction.counter.name);
    await waitForEnabledButton(counterBrowser.cdp,loadout.reaction.source.name,15_000);
    await clickText(counterBrowser.cdp,loadout.reaction.source.name);

    responses=await waitForAllRoomVersion(browsers,roomCode,sourceRevision+1,20_000);
    rooms=validateFourClientProjection(responses,"after Commander Burst counter",[4,4,5,5]);
    const counterRevision=rooms[0].combat.revision;
    assert.equal(rooms[0].combat.stack.length,2,"Burst counter must stack above the source spell");
    assert.equal(rooms[0].combat.stack[1].defId,loadout.reaction.counter.defId,"counter must be the LIFO stack top");
    assert.equal(rooms[0].combat.prioritySeat,2,"counter action must move priority clockwise to P3");
    await capture(browsers[2],"68-commander-4p-counter-stack.png","Commander counter stacked with P3 holding priority",manifest);

    const reactionHolders:number[]=[];
    for(let pass=0;pass<4;pass++){
      rooms=responses.map((response)=>response.body.room);
      const revision=rooms[0].combat.revision;
      const holder=rooms[0].combat.prioritySeat;
      reactionHolders.push(holder);
      const browser=browsers[holder];
      await waitForCommanderUiAuthority(browser,revision,"yours",20_000);
      await waitForEnabledButton(browser.cdp,"Passar reação",15_000);
      await clickText(browser.cdp,"Passar reação");
      responses=await waitForAllRoomVersion(browsers,roomCode,revision+1,20_000);
      validateFourClientProjection(responses,`after counter priority pass ${pass+1}`,[4,4,5,5]);
    }
    assert.deepEqual(reactionHolders,[2,3,0,1],"counter resolution priority must rotate P3 → P4 → P1 → P2");

    const counterSettledRooms=responses.map((response)=>response.body.room);
    const counterSettledRevision=counterSettledRooms[0].combat.revision;
    assert.equal(counterSettledRevision,counterRevision+4,"counter resolution requires one full four-player pass cycle");
    assert.equal(counterSettledRooms[0].combat.stack.length,0,"resolved negateSpell must remove itself and the targeted source spell");
    assert.equal(counterSettledRooms[0].combat.seats[1].deckCount,reactionFixture.targetDeckCount,"countered Tidal Erosion must not mill P2");
    assert.ok(counterSettledRooms[0].combat.seats[0].graveyard.some((card:any)=>card.defId===loadout.reaction.source.defId),"countered source spell must settle to P1 graveyard");
    assert.ok(counterSettledRooms[0].combat.seats[1].graveyard.some((card:any)=>card.defId===loadout.reaction.counter.defId),"resolved counter must settle to P2 graveyard");
    await capture(host,"69-commander-4p-counter-settled.png","Commander Burst negateSpell settled without source effect",manifest);

    const counterChainFixture=await seedCommanderReactionFixture(roomCode,loadout);
    responses=await waitForAllRoomVersion(browsers,roomCode,counterChainFixture.revision,20_000);
    rooms=validateFourClientProjection(responses,"Commander counter-chain fixture",[4,4,5,5]);
    assert.equal(rooms[0].combat.prioritySeat,0,"counter-chain fixture must reopen P1 priority");

    await waitForCommanderUiAuthority(browsers[0],counterChainFixture.revision,"yours",20_000);
    await waitForEnabledButton(browsers[0].cdp,loadout.reaction.source.name,15_000);
    await clickText(browsers[0].cdp,loadout.reaction.source.name);
    await waitForEnabledButton(browsers[0].cdp,"Nexus P2",15_000);
    await clickText(browsers[0].cdp,"Nexus P2",true);

    responses=await waitForAllRoomVersion(browsers,roomCode,counterChainFixture.revision+1,20_000);
    rooms=validateFourClientProjection(responses,"counter-chain source cast",[3,4,5,5]);
    const chainSourceRevision=rooms[0].combat.revision;
    const chainSourceStackId=rooms[0].combat.stack[0]?.id;
    assert.ok(chainSourceStackId,"counter-chain source spell must expose a public stack id");
    assert.equal(rooms[0].combat.prioritySeat,1,"counter-chain source must hand priority to P2");

    await waitForCommanderUiAuthority(browsers[1],chainSourceRevision,"yours",20_000);
    await waitForEnabledButton(browsers[1].cdp,loadout.reaction.counter.name,15_000);
    await clickText(browsers[1].cdp,loadout.reaction.counter.name);
    await waitForEnabledButton(browsers[1].cdp,loadout.reaction.source.name,15_000);
    await clickText(browsers[1].cdp,loadout.reaction.source.name);

    responses=await waitForAllRoomVersion(browsers,roomCode,chainSourceRevision+1,20_000);
    rooms=validateFourClientProjection(responses,"counter-chain first counter",[3,3,5,5]);
    const chainCounterRevision=rooms[0].combat.revision;
    const chainCounterStackId=rooms[0].combat.stack.at(-1)?.id;
    assert.ok(chainCounterStackId,"P2 counter must expose a public stack id");
    assert.equal(rooms[0].combat.stack.length,2,"counter-chain must contain source plus P2 counter before P3 answers");
    assert.equal(rooms[0].combat.prioritySeat,2,"P2 counter must hand priority to P3");

    await waitForCommanderUiAuthority(browsers[2],chainCounterRevision,"yours",20_000);
    await waitForEnabledButton(browsers[2].cdp,loadout.reaction.counter.name,15_000);
    await clickText(browsers[2].cdp,loadout.reaction.counter.name);
    await waitForEnabledButton(browsers[2].cdp,"TOPO · "+loadout.reaction.counter.name,15_000);
    await clickText(browsers[2].cdp,"TOPO · "+loadout.reaction.counter.name);

    responses=await waitForAllRoomVersion(browsers,roomCode,chainCounterRevision+1,20_000);
    rooms=validateFourClientProjection(responses,"counter-chain P3 counter-of-counter",[3,3,4,5]);
    const counterOfCounterRevision=rooms[0].combat.revision;
    assert.equal(rooms[0].combat.stack.length,3,"counter-of-counter proof requires three simultaneous stack objects");
    assert.equal(rooms[0].combat.stack[0].id,chainSourceStackId,"original source must remain at stack base");
    assert.equal(rooms[0].combat.stack[1].id,chainCounterStackId,"P2 counter must remain between source and P3 answer");
    assert.equal(rooms[0].combat.stack[2].defId,loadout.reaction.counter.defId,"P3 Deny must be the LIFO top");
    assert.equal(rooms[0].combat.prioritySeat,3,"P3 counter-of-counter must hand priority to P4");
    await capture(browsers[3],"70-commander-4p-counter-chain-three-stack.png","Commander source + counter + counter-of-counter on real stack",manifest);

    const counterOfCounterHolders:number[]=[];
    for(let pass=0;pass<4;pass++){
      rooms=responses.map((response)=>response.body.room);
      const revision=rooms[0].combat.revision;
      const holder=rooms[0].combat.prioritySeat;
      counterOfCounterHolders.push(holder);
      const browser=browsers[holder];
      await waitForCommanderUiAuthority(browser,revision,"yours",20_000);
      await waitForEnabledButton(browser.cdp,"Passar reação",15_000);
      await clickText(browser.cdp,"Passar reação");
      responses=await waitForAllRoomVersion(browsers,roomCode,revision+1,20_000);
      validateFourClientProjection(responses,`after counter-of-counter priority pass ${pass+1}`,[3,3,4,5]);
    }
    assert.deepEqual(counterOfCounterHolders,[3,0,1,2],"counter-of-counter resolution priority must rotate P4 → P1 → P2 → P3");

    const counterOfCounterSettled=responses.map((response)=>response.body.room);
    const counterOfCounterSettledRevision=counterOfCounterSettled[0].combat.revision;
    assert.equal(counterOfCounterSettledRevision,counterOfCounterRevision+4,"counter-of-counter requires one full four-player pass cycle");
    assert.equal(counterOfCounterSettled[0].combat.stack.length,1,"counter-of-counter must remove P2 counter while leaving source pending");
    assert.equal(counterOfCounterSettled[0].combat.stack[0].id,chainSourceStackId,"original source spell must survive the counter chain");
    assert.equal(counterOfCounterSettled[0].combat.seats[1].deckCount,counterChainFixture.targetDeckCount,"source must remain unresolved after the first counter-chain cycle");
    assert.ok(counterOfCounterSettled[0].combat.seats[1].graveyard.some((card:any)=>card.defId===loadout.reaction.counter.defId),"countered P2 Deny must settle to P2 graveyard");
    assert.ok(counterOfCounterSettled[0].combat.seats[2].graveyard.some((card:any)=>card.defId===loadout.reaction.counter.defId),"resolved P3 Deny must settle to P3 graveyard");
    assert.equal(counterOfCounterSettled[0].combat.seats[0].graveyard.some((card:any)=>card.instanceId===counterChainFixture.sourceInstanceId),false,"original source must not enter graveyard before its own resolution");
    assert.equal(counterOfCounterSettled[0].combat.prioritySeat,0,"surviving source spell must restart reaction priority at P1");
    await capture(browsers[0],"71-commander-4p-counter-chain-source-survives.png","Commander counter-of-counter leaves original source pending",manifest);

    const sourceResolutionHolders:number[]=[];
    for(let pass=0;pass<4;pass++){
      rooms=responses.map((response)=>response.body.room);
      const revision=rooms[0].combat.revision;
      const holder=rooms[0].combat.prioritySeat;
      sourceResolutionHolders.push(holder);
      const browser=browsers[holder];
      await waitForCommanderUiAuthority(browser,revision,"yours",20_000);
      await waitForEnabledButton(browser.cdp,"Passar reação",15_000);
      await clickText(browser.cdp,"Passar reação");
      responses=await waitForAllRoomVersion(browsers,roomCode,revision+1,20_000);
      validateFourClientProjection(responses,`after surviving-source priority pass ${pass+1}`,[3,3,4,5]);
    }
    assert.deepEqual(sourceResolutionHolders,[0,1,2,3],"surviving source resolution priority must rotate P1 → P2 → P3 → P4");

    const counterChainSettled=responses.map((response)=>response.body.room);
    const counterChainSettledRevision=counterChainSettled[0].combat.revision;
    assert.equal(counterChainSettledRevision,counterOfCounterSettledRevision+4,"surviving source requires its own full four-player pass cycle");
    assert.equal(counterChainSettled[0].combat.stack.length,0,"surviving source must resolve after the second full priority cycle");
    assert.equal(counterChainSettled[0].combat.seats[1].deckCount,counterChainFixture.targetDeckCount-loadout.reaction.source.amount,"Tidal Erosion must mill its exact catalog amount after its counter is countered");
    assert.ok(counterChainSettled[0].combat.seats[0].graveyard.some((card:any)=>card.instanceId===counterChainFixture.sourceInstanceId),"resolved original source must settle to P1 graveyard");
    await capture(host,"72-commander-4p-counter-chain-source-resolved.png","Commander original source resolves after counter-of-counter",manifest);

    const filteredCounterFixture=await seedCommanderLegalityFixture(
      roomCode,
      loadout.legality.unit.defId,
      loadout.legality.spellOnlyCounter.defId,
    );
    responses=await waitForAllRoomVersion(browsers,roomCode,filteredCounterFixture.revision,20_000);
    rooms=validateFourClientProjection(responses,"Commander spell-only counter legality fixture",filteredCounterFixture.handCounts);
    assert.equal(rooms[0].combat.prioritySeat,0,"filtered-counter fixture must begin with P1 priority");

    await waitForCommanderUiAuthority(browsers[0],filteredCounterFixture.revision,"yours",20_000);
    await waitForEnabledButton(browsers[0].cdp,loadout.legality.unit.name,15_000);
    await clickText(browsers[0].cdp,loadout.legality.unit.name);

    responses=await waitForAllRoomVersion(browsers,roomCode,filteredCounterFixture.revision+1,20_000);
    rooms=validateFourClientProjection(responses,"after Commander Unit opens filtered-counter window",[
      filteredCounterFixture.handCounts[0]-1,
      filteredCounterFixture.handCounts[1],
      filteredCounterFixture.handCounts[2],
      filteredCounterFixture.handCounts[3],
    ]);
    const filteredCounterRevision=rooms[0].combat.revision;
    const filteredUnitStack=rooms[0].combat.stack.at(-1);
    assert.ok(filteredUnitStack,"filtered-counter fixture must expose the Unit stack item");
    assert.equal(filteredUnitStack.actionKind,"unit","filtered-counter fixture must expose a Unit action kind");
    assert.equal(rooms[0].combat.prioritySeat,1,"Unit cast must move priority to P2");

    await waitForCommanderUiAuthority(browsers[1],filteredCounterRevision,"yours",20_000);
    await waitForDisabledButton(browsers[1].cdp,loadout.legality.spellOnlyCounter.name,15_000);
    await capture(browsers[1],"73-commander-4p-counter-filter-disabled.png","Commander spell-only counter disabled against Unit stack target",manifest);

    const forgedFilteredCounter=await sendForgedCommanderCombatCommand(
      browsers[1],
      roomCode,
      filteredCounterRevision,
      "play_card",
      {instanceId:filteredCounterFixture.responderInstanceId,stackTargetId:filteredUnitStack.id},
    );
    assert.equal(forgedFilteredCounter.status,409,"forged spell-only counter against Unit must fail closed");
    assert.equal(forgedFilteredCounter.body?.ok,false,"forged filtered counter rejection must return ok:false");
    assert.match(String(forgedFilteredCounter.body?.error||""),/(Only legal Fast\/Burst reaction spells|cannot counter stack item)/i,"server must reject the illegal filtered counter target");

    responses=await Promise.all(browsers.map((browser)=>fetchCommander(browser,roomCode)));
    rooms=validateFourClientProjection(responses,"after forged filtered-counter rejection",[
      filteredCounterFixture.handCounts[0]-1,
      filteredCounterFixture.handCounts[1],
      filteredCounterFixture.handCounts[2],
      filteredCounterFixture.handCounts[3],
    ]);
    assert.equal(rooms[0].combat.revision,filteredCounterRevision,"illegal filtered counter must not advance Commander revision");
    assert.equal(rooms[0].combat.stack.length,1,"illegal filtered counter must not mutate the stack");
    assert.equal(rooms[0].combat.seats[1].handCount,filteredCounterFixture.responderHandCount,"illegal filtered counter must remain in P2 hand");

    const uncounterableFixture=await seedCommanderLegalityFixture(
      roomCode,
      loadout.legality.uncounterableSpell.defId,
      loadout.reaction.counter.defId,
    );
    responses=await waitForAllRoomVersion(browsers,roomCode,uncounterableFixture.revision,20_000);
    rooms=validateFourClientProjection(responses,"Commander uncounterable legality fixture",uncounterableFixture.handCounts);
    assert.equal(rooms[0].combat.prioritySeat,0,"uncounterable fixture must begin with P1 priority");

    await waitForCommanderUiAuthority(browsers[0],uncounterableFixture.revision,"yours",20_000);
    await waitForEnabledButton(browsers[0].cdp,loadout.legality.uncounterableSpell.name,15_000);
    await clickText(browsers[0].cdp,loadout.legality.uncounterableSpell.name);

    responses=await waitForAllRoomVersion(browsers,roomCode,uncounterableFixture.revision+1,20_000);
    rooms=validateFourClientProjection(responses,"after uncounterable Commander Spell",[
      uncounterableFixture.handCounts[0]-1,
      uncounterableFixture.handCounts[1],
      uncounterableFixture.handCounts[2],
      uncounterableFixture.handCounts[3],
    ]);
    const uncounterableRevision=rooms[0].combat.revision;
    const protectedStackItem=rooms[0].combat.stack.at(-1);
    assert.ok(protectedStackItem,"uncounterable fixture must expose a stack item");
    assert.equal(protectedStackItem.actionKind,"spell","uncounterable fixture must project a Spell action kind");
    assert.equal(protectedStackItem.uncounterable,true,"Commander projection must publish authoritative uncounterable state");
    assert.equal(rooms[0].combat.prioritySeat,1,"uncounterable Spell must move priority to P2");

    await waitForCommanderUiAuthority(browsers[1],uncounterableRevision,"yours",20_000);
    await waitForDisabledButton(browsers[1].cdp,loadout.reaction.counter.name,15_000);
    await capture(browsers[1],"74-commander-4p-uncounterable-deny-disabled.png","Commander Deny disabled against authoritative uncounterable Spell",manifest);

    const forgedUncounterableCounter=await sendForgedCommanderCombatCommand(
      browsers[1],
      roomCode,
      uncounterableRevision,
      "play_card",
      {instanceId:uncounterableFixture.responderInstanceId,stackTargetId:protectedStackItem.id},
    );
    assert.equal(forgedUncounterableCounter.status,409,"forged Deny against uncounterable Spell must fail closed");
    assert.equal(forgedUncounterableCounter.body?.ok,false,"uncounterable counter rejection must return ok:false");
    assert.match(String(forgedUncounterableCounter.body?.error||""),/(Only legal Fast\/Burst reaction spells|cannot counter stack item)/i,"server must reject the uncounterable target");

    responses=await Promise.all(browsers.map((browser)=>fetchCommander(browser,roomCode)));
    rooms=validateFourClientProjection(responses,"after forged uncounterable counter rejection",[
      uncounterableFixture.handCounts[0]-1,
      uncounterableFixture.handCounts[1],
      uncounterableFixture.handCounts[2],
      uncounterableFixture.handCounts[3],
    ]);
    assert.equal(rooms[0].combat.revision,uncounterableRevision,"illegal uncounterable counter must not advance revision");
    assert.equal(rooms[0].combat.stack.length,1,"illegal uncounterable counter must leave protected source on stack");
    assert.equal(rooms[0].combat.seats[1].handCount,uncounterableFixture.responderHandCount,"rejected Deny must remain in P2 hand");

    const uncounterableHolders:number[]=[];
    for(let pass=0;pass<4;pass++){
      rooms=responses.map((response)=>response.body.room);
      const revision=rooms[0].combat.revision;
      const holder=rooms[0].combat.prioritySeat;
      uncounterableHolders.push(holder);
      const browser=browsers[holder];
      await waitForCommanderUiAuthority(browser,revision,"yours",20_000);
      await waitForEnabledButton(browser.cdp,"Passar reação",15_000);
      await clickText(browser.cdp,"Passar reação");
      responses=await waitForAllRoomVersion(browsers,roomCode,revision+1,20_000);
      validateFourClientProjection(
        responses,
        `after uncounterable priority pass ${pass+1}`,
        pass===3
          ? uncounterableFixture.handCounts
          : [
              uncounterableFixture.handCounts[0]-1,
              uncounterableFixture.handCounts[1],
              uncounterableFixture.handCounts[2],
              uncounterableFixture.handCounts[3],
            ],
      );
    }
    assert.deepEqual(uncounterableHolders,[1,2,3,0],"uncounterable source priority must rotate P2 → P3 → P4 → P1");

    const uncounterableSettled=responses.map((response)=>response.body.room);
    const uncounterableSettledRevision=uncounterableSettled[0].combat.revision;
    assert.equal(uncounterableSettledRevision,uncounterableRevision+4,"uncounterable source requires one complete four-player pass cycle");
    assert.equal(uncounterableSettled[0].combat.stack.length,0,"uncounterable source must resolve after all players pass");
    assert.equal(uncounterableSettled[0].combat.seats[0].handCount,uncounterableFixture.sourceHandCount,"draw-one protected source must restore P1 hand count after resolving");
    assert.equal(uncounterableSettled[0].combat.seats[0].deckCount,uncounterableFixture.sourceDeckCount-1,"protected draw-one source must consume exactly one P1 deck card");
    assert.ok(uncounterableSettled[0].combat.seats[0].graveyard.some((card:any)=>card.instanceId===uncounterableFixture.sourceInstanceId),"resolved uncounterable source must settle to P1 graveyard");
    assert.equal(new Set(uncounterableSettled.map((room)=>room.combat.revision)).size,1,"all four clients must converge after uncounterable source resolution");
    await capture(host,"75-commander-4p-uncounterable-source-resolved.png","Commander uncounterable source resolves after rejected Deny",manifest);

    // Playable Lab v1 closure: authoritative end-turn, hard refresh recovery, then UI concede to terminal winner.
    rooms=responses.map((response)=>response.body.room);
    const preEndTurnHandCounts=rooms[0].combat.seats.map((seat:any)=>seat.handCount) as [number,number,number,number];
    const preEndTurnRevision=rooms[0].combat.revision;
    const activeSeatBeforeEnd=rooms[0].combat.activeSeat;
    const activeBrowser=browsers[activeSeatBeforeEnd];
    await waitForCommanderUiAuthority(activeBrowser,preEndTurnRevision,"yours",20_000);
    await waitForEnabledButton(activeBrowser.cdp,"Encerrar turno",15_000);
    await clickText(activeBrowser.cdp,"Encerrar turno",true);
    responses=await waitForAllRoomVersion(browsers,roomCode,preEndTurnRevision+1,20_000);
    const endTurnRooms=responses.map((response)=>response.body.room);
    const activeSeatAfterEnd=endTurnRooms[0].combat.activeSeat;
    const postEndTurnHandCounts=[...preEndTurnHandCounts] as [number,number,number,number];
    postEndTurnHandCounts[activeSeatAfterEnd]+=1;
    rooms=validateFourClientProjection(responses,"after authoritative Commander end turn",postEndTurnHandCounts);
    const endTurnRevision=rooms[0].combat.revision;
    assert.notEqual(activeSeatAfterEnd,activeSeatBeforeEnd,"end_turn must advance the authoritative active seat");
    assert.equal(rooms[0].combat.prioritySeat,activeSeatAfterEnd,"new active seat must receive authoritative priority after end_turn");
    await waitUntil(async()=>await evaluate<boolean>(browsers[activeSeatAfterEnd].cdp,`document.querySelector('[data-commander-surface="table"] [data-commander-battlefield="cinematic-v1"]')!==null`),"Commander fullscreen four-seat table",20_000);
    await capture(browsers[activeSeatAfterEnd],"76-commander-4p-fullscreen-table.png","Commander fullscreen four-seat battlefield after authoritative end-turn",manifest);

    const recoveryBrowser=browsers[activeSeatAfterEnd];
    await navigate(recoveryBrowser.cdp,"/commander");
    const recoveryRoomLabel=JSON.stringify(`Sala ${roomCode}`);
    await waitUntil(async()=>{
      const direct=await evaluate<boolean>(recoveryBrowser.cdp,`document.body?.innerText?.includes(${recoveryRoomLabel})===true&&document.body?.innerText?.includes('PRIORIDADE')===true`);
      if(direct)return "direct";
      const opened=await evaluate<boolean>(recoveryBrowser.cdp,`(()=>{
        const normalize=(value)=>String(value||'').replace(/\\s+/g,' ').trim();
        const article=[...document.querySelectorAll('article')].find((node)=>normalize(node.textContent).includes(${recoveryRoomLabel}));
        const button=article?.querySelector('button');
        if(!button||button.disabled||!['Abrir','Entrar'].includes(normalize(button.textContent)))return false;
        button.click();
        return true;
      })()`);
      return opened?"opened":false;
    },`${recoveryBrowser.label} Commander recovery path`,20_000);
    await waitForText(recoveryBrowser.cdp,`Sala ${roomCode}`,20_000);
    await waitUntil(async()=>await evaluate<boolean>(recoveryBrowser.cdp,`document.querySelector('[data-commander-surface="table"] [data-commander-battlefield="cinematic-v1"]')!==null`),"Commander recovery restores fullscreen table",20_000);
    await waitForCommanderUiAuthority(recoveryBrowser,endTurnRevision,"yours",20_000);
    const recovered=await fetchCommander(recoveryBrowser,roomCode);
    assert.equal(recovered.status,200,"hard-refresh recovery must reload the Commander room");
    assert.equal(recovered.body.room.combat.revision,endTurnRevision,"hard-refresh recovery must preserve the exact authoritative revision without replay");
    assert.equal(recovered.body.room.combat.activeSeat,activeSeatAfterEnd,"hard-refresh recovery must preserve the authoritative active seat");
    await capture(recoveryBrowser,"77-commander-4p-refresh-recovered-table.png","Commander hard-refresh authoritative fullscreen table recovery",manifest);

    const concedeSeats=[0,1,2,3].filter((seat)=>seat!==activeSeatAfterEnd).slice(0,3);
    let terminalRevision=endTurnRevision;
    for(let index=0;index<concedeSeats.length;index++){
      const seat=concedeSeats[index];
      await waitForCommanderUiAuthority(browsers[seat],terminalRevision,rooms[0].combat.prioritySeat===seat?"yours":"waiting",20_000);
      await waitForEnabledButton(browsers[seat].cdp,"Conceder partida",15_000);
      await clickText(browsers[seat].cdp,"Conceder partida",true);
      terminalRevision+=1;
      responses=await waitUntil(async()=>{
        const projected=await Promise.all(browsers.map((browser)=>fetchCommander(browser,roomCode)));
        if(projected.some((response)=>response.status!==200||!response.body?.room?.combat))return false;
        const revisions=projected.map((response)=>Number(response.body.room.combat.revision));
        if(revisions.some((revision)=>revision<terminalRevision)||new Set(revisions).size!==1)return false;
        if(projected.some((response)=>response.body.room.combat.seats[seat].eliminated!==true))return false;
        return projected;
      },`P${seat+1} authoritative concede at revision >= ${terminalRevision}`,20_000);
      rooms=responses.map((response)=>response.body.room);
      terminalRevision=rooms[0].combat.revision;
      assert.equal(rooms[0].combat.seats[seat].eliminated,true,`P${seat+1} concede must project authoritative elimination`);
    }
    rooms=responses.map((response)=>response.body.room);
    assert.equal(rooms[0].combat.status,"completed","three UI concedes must complete the four-player match");
    assert.equal(rooms[0].combat.winnerSeat,activeSeatAfterEnd,"the sole surviving seat must be the authoritative winner");
    assert.equal(new Set(rooms.map((room)=>room.combat.winnerSeat)).size,1,"all four clients must converge on the same authoritative winner");
    await waitUntil(async()=>{
      const terminal=await evaluate(browsers[activeSeatAfterEnd].cdp,`(()=>{const node=document.querySelector('[data-commander-phaser-runtime="presentation-only"]');return node?{status:node.getAttribute("data-match-status"),winnerSeat:node.getAttribute("data-winner-seat")}:null})()`);
      return terminal?.status==="completed"&&terminal?.winnerSeat===String(activeSeatAfterEnd);
    },"authoritative terminal outcome projected into Commander Phaser runtime",20_000);
    await capture(browsers[activeSeatAfterEnd],"78-commander-4p-authoritative-winner.png","Commander terminal winner after real UI concedes",manifest);

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
      reaction:{
        fixtureRevision:reactionFixture.revision,
        sourceRevision,
        counterRevision,
        settledRevision:counterSettledRevision,
        source:loadout.reaction.source,
        counter:loadout.reaction.counter,
        priorityHolders:reactionHolders,
        deterministicCiSetup:true,
      },
      counterChain:{
        fixtureRevision:counterChainFixture.revision,
        sourceRevision:chainSourceRevision,
        counterRevision:chainCounterRevision,
        counterOfCounterRevision,
        counterOfCounterSettledRevision,
        settledRevision:counterChainSettledRevision,
        counterOfCounterPriorityHolders:counterOfCounterHolders,
        sourceResolutionPriorityHolders:sourceResolutionHolders,
        source:loadout.reaction.source,
        counter:loadout.reaction.counter,
        targetDeckBeforeResolution:counterChainFixture.targetDeckCount,
        targetDeckAfterResolution:counterChainSettled[0].combat.seats[1].deckCount,
        deterministicCiSetup:true,
      },
      legality:{
        studioAuthoringValidatedFixtures:true,
        filteredCounter:{
          fixtureRevision:filteredCounterFixture.revision,
          sourceRevision:filteredCounterRevision,
          source:loadout.legality.unit,
          counter:loadout.legality.spellOnlyCounter,
          forgedStatus:forgedFilteredCounter.status,
        },
        uncounterable:{
          fixtureRevision:uncounterableFixture.revision,
          sourceRevision:uncounterableRevision,
          settledRevision:uncounterableSettledRevision,
          source:loadout.legality.uncounterableSpell,
          counter:loadout.reaction.counter,
          priorityHolders:uncounterableHolders,
          forgedStatus:forgedUncounterableCounter.status,
        },
      },
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
        authoritativeReactionWindowViaUi:true,
        burstNegateSpellViaUi:true,
        counterPreventedSourceResolution:true,
        reactionRevisionConvergence:true,
        counterOfCounterViaUi:true,
        threeObjectLifoStackViaUi:true,
        counteredCounterLeftSourcePending:true,
        originalSourceResolvedAfterCounterChain:true,
        counterChainRevisionConvergence:true,
        studioAuthoringValidatedLegalityFixtures:true,
        counterFilterDisabledIllegalTargetViaUi:true,
        serverRejectedForgedFilteredCounter:true,
        uncounterableProjectedAuthoritatively:true,
        denyDisabledAgainstUncounterableViaUi:true,
        serverRejectedForgedUncounterableCounter:true,
        uncounterableSourceResolvedAfterRejectedCounter:true,
        legalityRevisionConvergence:true,
        browserRuntimeExceptions:0,
      },
      screenshots:manifest,
    };
    await writeFile(join(outputDir,"commander-4p-browser-manifest.json"),`${JSON.stringify(report,null,2)}\n`);
    console.log(`COMMANDER 4P FOUR-BROWSER E2E: PASS — ${roomCode}, baseline rev ${initialRevision} → ${settledRevision}; Burst counter rev ${reactionFixture.revision} → ${counterSettledRevision}; counter-chain rev ${counterChainFixture.revision} → ${counterChainSettledRevision}; legality rev ${filteredCounterFixture.revision} → ${uncounterableSettledRevision}`);
  }finally{
    try{
      await Promise.all(browsers.map((browser)=>shutdownBrowser(browser)));
      if(process.env.ALPHA_VISUAL_DEBUG==="1"){
        for(const browser of browsers)if(browser.stderr)console.error(`[${browser.label} Chrome]\n${browser.stderr}`);
      }
    }finally{
      if(legalityCatalog)await cleanupCommanderLegalityCatalog(legalityCatalog.defIds);
    }
  }
}

void main().catch((error)=>{
  console.error("COMMANDER 4P FOUR-BROWSER E2E: FAIL",error);
  process.exitCode=1;
});
