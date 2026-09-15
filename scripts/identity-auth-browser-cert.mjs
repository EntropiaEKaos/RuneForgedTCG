import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { CHROME_REMOTE_DEBUGGING_FLAG, waitForChromeDevToolsPort } from "./chrome-devtools-bootstrap.mjs";

const baseUrl = (process.env.E2E_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const outputDir = resolve(process.env.ALPHA_VISUAL_DIR || "artifacts/alpha-visual");
const viewport = { width:1440, height:1000, deviceScaleFactor:1, mobile:false };
const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
const normalizeText = (value) => String(value || "").toLocaleLowerCase("pt-BR");

function findChrome() {
  for (const candidate of [process.env.CHROME_BIN,"google-chrome","google-chrome-stable","chromium","chromium-browser"].filter(Boolean)) {
    const result = spawnSync("which", [candidate], { encoding:"utf8" });
    if (result.status === 0 && result.stdout.trim()) return result.stdout.trim();
  }
  throw new Error("Chrome/Chromium not found");
}
async function waitForChrome(port) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (response.ok) {
        const targets = await response.json();
        const page = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl);
        if (page) return page.webSocketDebuggerUrl;
      }
    } catch {}
    await sleep(100);
  }
  throw new Error("Chrome remote debugging endpoint did not become ready");
}
class CdpClient {
  constructor(socket) {
    this.socket=socket; this.nextId=1; this.pending=new Map(); this.notifications=[];
    socket.addEventListener("message", (event) => {
      const message=JSON.parse(String(event.data));
      if (message.id) {
        const pending=this.pending.get(message.id); if (!pending) return; this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(`${pending.method}: ${message.error.message}`)); else pending.resolve(message.result || {});
      } else this.notifications.push(message);
    });
  }
  static async connect(url) {
    assert.equal(typeof WebSocket,"function","Node 22 WebSocket global is required");
    const socket=new WebSocket(url);
    await new Promise((resolvePromise,reject)=>{const timer=setTimeout(()=>reject(new Error("Timed out opening DevTools WebSocket")),10_000);socket.addEventListener("open",()=>{clearTimeout(timer);resolvePromise();},{once:true});socket.addEventListener("error",()=>{clearTimeout(timer);reject(new Error("Failed to open DevTools WebSocket"));},{once:true});});
    return new CdpClient(socket);
  }
  call(method,params={}) { const id=this.nextId++; this.socket.send(JSON.stringify({id,method,params})); return new Promise((resolvePromise,reject)=>this.pending.set(id,{resolve:resolvePromise,reject,method})); }
  close(){this.socket.close();}
}
async function evaluate(cdp,expression){const result=await cdp.call("Runtime.evaluate",{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text||"Runtime evaluation failed");return result.result?.value;}
async function waitUntil(check,label,timeoutMs=25_000){const deadline=Date.now()+timeoutMs;let last;while(Date.now()<deadline){try{last=await check();if(last)return last;}catch(error){last=error;}await sleep(125);}throw new Error(`Timed out waiting for ${label}${last instanceof Error?`: ${last.message}`:""}`);}
async function navigate(cdp,path){const target=`${baseUrl}${path}`;await cdp.call("Page.navigate",{url:target});await waitUntil(()=>evaluate(cdp,`location.href === ${JSON.stringify(target)} && ['interactive','complete'].includes(document.readyState)`),`navigation to ${target}`,30_000);await sleep(250);}
async function waitForText(cdp,text){const needle=normalizeText(text);return waitUntil(()=>evaluate(cdp,`(document.body?.innerText||'').toLocaleLowerCase('pt-BR').includes(${JSON.stringify(needle)})`),`text ${JSON.stringify(text)}`);}
async function clickText(cdp,text){const clicked=await evaluate(cdp,`(() => { const n=(v)=>(v||'').replace(/\\s+/g,' ').trim(); const el=[...document.querySelectorAll('button,a,[role="button"]')].find((node)=>!node.disabled&&n(node.textContent).includes(${JSON.stringify(text)})); if(!el)return false; el.click(); return true; })()`);assert.equal(clicked,true,`Could not click ${text}`);}
async function capture(cdp,filename,stage){const metrics=await evaluate(cdp,`({innerWidth:window.innerWidth,scrollWidth:document.documentElement.scrollWidth,bodyText:(document.body?.innerText||'').replace(/\\s+/g,' ').trim()})`);assert.ok(metrics.scrollWidth<=metrics.innerWidth+2,`${stage} has horizontal overflow`);assert.ok(metrics.bodyText.length>50,`${stage} rendered suspiciously little text`);const shot=await cdp.call("Page.captureScreenshot",{format:"png",fromSurface:true,captureBeyondViewport:false});await writeFile(join(outputDir,filename),Buffer.from(shot.data,"base64"));console.log(`IDENTITY AUTH BROWSER CERT: captured ${filename} — ${stage}`);return metrics;}
async function login(cdp){const password=process.env.ADMIN_PASSWORD?.trim();assert.ok(password,"ADMIN_PASSWORD is required");const payload=JSON.stringify({username:process.env.ADMIN_USERNAME?.trim()||"admin",password});const result=await evaluate(cdp,`(async()=>{const r=await fetch('/api/admin/login',{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:${JSON.stringify(payload)}});return {status:r.status,body:await r.json().catch(()=>null)}})()`);assert.equal(result?.status,200,`Admin login failed: ${JSON.stringify(result)}`);assert.equal(result?.body?.ok,true,"Admin login did not return ok=true");}
async function logout(cdp){const status=await evaluate(cdp,`(async()=> (await fetch('/api/admin/login',{method:'DELETE',credentials:'include'})).status)()`);assert.equal(status,200,"Admin logout failed");}
async function clearPlayerSession(cdp,label){const status=await evaluate(cdp,`(async()=> (await fetch('/api/player',{method:'DELETE',credentials:'include'})).status)()`);assert.equal(status,200,`${label}: player-session cleanup failed`);}
async function dismissRecovery(cdp){await waitUntil(()=>evaluate(cdp,`(()=>{const dialog=[...document.querySelectorAll('[role="dialog"]')].find(node=>(node.textContent||'').includes('SALVE SUA CHAVE DE RECUPERAÇÃO'));if(!dialog)return true;const button=[...dialog.querySelectorAll('button')].find(node=>!node.disabled&&(node.textContent||'').replace(/\\s+/g,' ').trim()==='JÁ GUARDEI');if(button)button.click();return false;})()`),"recovery handoff dismissal",30_000);}
async function fillNickname(cdp,name){const filled=await evaluate(cdp,`(()=>{const input=[...document.querySelectorAll('input')].find(node=>node.getAttribute('placeholder')==='Seu nome na Forja');if(!input)return false;const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;if(!setter)return false;setter.call(input,${JSON.stringify(name)});input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`);assert.equal(filled,true,"Nickname input is required for Identity/Auth browser certification");}
function isExpectedAuthTransitionNetworkLog(message){
  if(message.method!=="Log.entryAdded") return false;
  const entry=message.params?.entry;
  if(entry?.source!=="network"||entry?.level!=="error") return false;
  const url=String(entry.url||"");
  const text=String(entry.text||"");
  if(text.includes("401 (Unauthorized)")&&(url.endsWith("/api/admin/session")||url.endsWith("/api/player")||url.endsWith("/api/player/cosmetics"))) return true;
  return text.includes("404 (Not Found)")&&url.endsWith("/favicon.ico");
}
async function shutdown(chrome,profileDir){if(chrome.exitCode==null&&chrome.signalCode==null)chrome.kill("SIGTERM");await sleep(300);if(chrome.exitCode==null&&chrome.signalCode==null)chrome.kill("SIGKILL");await rm(profileDir,{recursive:true,force:true,maxRetries:5,retryDelay:200}).catch(()=>{});}

async function main(){
  await mkdir(outputDir,{recursive:true});
  const profileDir=await mkdtemp(join(tmpdir(),"forged-identity-auth-chrome-"));
  const chrome=spawn(findChrome(),["--headless=new","--disable-gpu","--no-sandbox","--disable-dev-shm-usage","--hide-scrollbars","--mute-audio",CHROME_REMOTE_DEBUGGING_FLAG,`--user-data-dir=${profileDir}`,`--window-size=${viewport.width},${viewport.height}`,"about:blank"],{stdio:["ignore","ignore","pipe"]});
  let stderr=""; chrome.stderr.on("data",(chunk)=>{stderr+=String(chunk);}); let cdp;
  try {
    const port=await waitForChromeDevToolsPort({profileDir,chrome,getStderr:()=>stderr}); cdp=await CdpClient.connect(await waitForChrome(port));
    await cdp.call("Page.enable"); await cdp.call("Runtime.enable"); await cdp.call("Log.enable"); await cdp.call("Emulation.setDeviceMetricsOverride",viewport);

    await navigate(cdp,"/admin/studio"); await waitForText(cdp,"Runeforge Studio Access"); await login(cdp);
    await navigate(cdp,"/admin/studio/identity"); await waitForText(cdp,"Autenticação & Provedores"); await waitForText(cdp,"Google Client ID"); await waitForText(cdp,"Resend API Key");
    const studio=await capture(cdp,"59-studio-identity-provider-vault.png","Studio → Identity/Auth provider vault");
    const studioText=normalizeText(studio.bodyText);
    assert.ok(studioText.includes("google")&&studioText.includes("discord")&&studioText.includes("e-mail / magic link"),"Studio must expose all supported provider controls");
    await logout(cdp);
    await clearPlayerSession(cdp,"anonymous entry setup");

    await navigate(cdp,"/play"); await waitForText(cdp,"Entre na"); await waitForText(cdp,"CONTINUAR COMO CONVIDADO");
    const preGuestState=await evaluate(cdp,`(async()=>{const recovery=[...document.querySelectorAll('[role="dialog"]')].some(node=>(node.textContent||'').includes('SALVE SUA CHAVE DE RECUPERAÇÃO'));const playerStatus=(await fetch('/api/player',{cache:'no-store',credentials:'include'})).status;return {recovery,playerStatus};})()`);
    assert.equal(preGuestState?.recovery,false,"Anonymous auth entry must not issue a recovery key before explicit Guest choice");
    assert.equal(preGuestState?.playerStatus,401,"Anonymous auth entry must not create a player session before explicit Guest choice");
    const entry=await capture(cdp,"57-identity-auth-entry.png","Player Identity/Auth → explicit entry");
    assert.ok(normalizeText(entry.bodyText).includes(normalizeText("Escolha como quer continuar")),"Auth entry must explain explicit identity choice");
    await clickText(cdp,"CONTINUAR COMO CONVIDADO");
    await waitForText(cdp,"SALVE SUA CHAVE DE RECUPERAÇÃO");
    await dismissRecovery(cdp);
    await waitForText(cdp,"FORJE SUA IDENTIDADE");
    await waitForText(cdp,"FORJAR IDENTIDADE");
    await capture(cdp,"58-identity-auth-nickname.png","Player Identity/Auth → nickname forging");
    await fillNickname(cdp,"Identity Cert"); await clickText(cdp,"FORJAR IDENTIDADE"); await waitForText(cdp,"PRIMEIRO ACESSO · ALPHA JOGÁVEL");

    await navigate(cdp,"/profile/security"); await waitForText(cdp,"Identidades vinculadas"); await waitForText(cdp,"Player ID"); await waitForText(cdp,"Contrato de segurança");
    const security=await capture(cdp,"60-profile-access-security.png","Player profile → access and security linking workspace");
    const securityText=normalizeText(security.bodyText);
    assert.ok(securityText.includes("google")&&securityText.includes("discord")&&securityText.includes("e-mail"),"Player security workspace must expose all supported identity methods");
    assert.ok(securityText.includes(normalizeText("Segredos dos provedores ficam no Vault administrativo")),"Player security workspace must state secret isolation");

    await clearPlayerSession(cdp,"guest browser teardown");

    const severe=cdp.notifications.filter((message)=>message.method==="Runtime.exceptionThrown"||(message.method==="Log.entryAdded"&&["error","assert"].includes(message.params?.entry?.level)&&!isExpectedAuthTransitionNetworkLog(message)));
    assert.equal(severe.length,0,`Browser emitted runtime errors: ${JSON.stringify(severe.slice(0,3))}`);
    const screenshots=["57-identity-auth-entry.png","58-identity-auth-nickname.png","59-studio-identity-provider-vault.png","60-profile-access-security.png"];
    await writeFile(join(outputDir,"57-60-identity-auth-browser-cert.json"),`${JSON.stringify({ok:true,gitSha:process.env.GITHUB_SHA||null,screenshots,anonymousUntilGuestChoice:true,guestFallback:true,providerControls:["google","discord","email"],playerLinkingWorkspace:true},null,2)}\n`);
    console.log("IDENTITY AUTH BROWSER CERT: PASS — anonymous explicit entry + explicit Guest creation + nickname + Studio provider vault + player linking workspace certified in real browser");
  } catch(error) {
    if(cdp){try{console.error("--- Identity/Auth browser snapshot ---",await evaluate(cdp,`({href:location.href,title:document.title,bodyText:(document.body?.innerText||'').replace(/\\s+/g,' ').trim().slice(0,1200)})`));}catch{}}
    if(stderr.trim())console.error(stderr.slice(-5000)); throw error;
  } finally { if(cdp)cdp.close(); await shutdown(chrome,profileDir); }
}
main().catch((error)=>{console.error("IDENTITY AUTH BROWSER CERT: FAIL",error);process.exitCode=1;});
