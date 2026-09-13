import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { CHROME_REMOTE_DEBUGGING_FLAG, waitForChromeDevToolsPort } from "./chrome-devtools-bootstrap.mjs";

const baseUrl = (process.env.E2E_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const outputDir = resolve(process.env.ALPHA_VISUAL_DIR || "artifacts/alpha-visual-4-2");
const viewport = { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false };
const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

function findChrome() {
  const candidates = [process.env.CHROME_BIN, "google-chrome", "google-chrome-stable", "chromium", "chromium-browser"].filter(Boolean);
  for (const candidate of candidates) {
    const result = spawnSync("which", [candidate], { encoding: "utf8" });
    if (result.status === 0 && result.stdout.trim()) return result.stdout.trim();
  }
  throw new Error(`Chrome/Chromium not found. Tried: ${candidates.join(", ")}`);
}

async function waitForChrome(port, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
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

async function waitForProcessExit(child, timeoutMs) {
  if (child.exitCode != null || child.signalCode != null) return true;
  return new Promise((resolvePromise) => {
    const onExit = () => { clearTimeout(timer); resolvePromise(true); };
    const timer = setTimeout(() => { child.removeListener("exit", onExit); resolvePromise(false); }, timeoutMs);
    child.once("exit", onExit);
  });
}

async function shutdownChrome(chrome, profileDir) {
  if (chrome.exitCode == null && chrome.signalCode == null) chrome.kill("SIGTERM");
  if (!(await waitForProcessExit(chrome, 1500)) && chrome.exitCode == null && chrome.signalCode == null) {
    chrome.kill("SIGKILL");
    await waitForProcessExit(chrome, 2000);
  }
  await rm(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

class CdpClient {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(`${pending.method}: ${message.error.message}`));
      else pending.resolve(message.result || {});
    });
  }
  static async connect(url) {
    assert.equal(typeof WebSocket, "function", "Node 22 WebSocket global is required");
    const socket = new WebSocket(url);
    await new Promise((resolvePromise, reject) => {
      const timer = setTimeout(() => reject(new Error("Timed out opening Chrome DevTools WebSocket")), 10_000);
      socket.addEventListener("open", () => { clearTimeout(timer); resolvePromise(); }, { once: true });
      socket.addEventListener("error", () => { clearTimeout(timer); reject(new Error("Failed to open Chrome DevTools WebSocket")); }, { once: true });
    });
    return new CdpClient(socket);
  }
  call(method, params = {}) {
    const id = this.nextId++;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolvePromise, reject) => this.pending.set(id, { resolve: resolvePromise, reject, method }));
  }
  close() { this.socket.close(); }
}

async function evaluate(cdp, expression) {
  const result = await cdp.call("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || "Runtime evaluation failed");
  return result.result?.value;
}

async function waitUntil(check, label, timeoutMs = 25_000) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    try {
      last = await check();
      if (last) return last;
    } catch (error) { last = error; }
    await sleep(125);
  }
  throw new Error(`Timed out waiting for ${label}${last instanceof Error ? `: ${last.message}` : ""}`);
}

async function clickText(cdp, text, timeoutMs = 30_000) {
  await waitUntil(
    () => evaluate(cdp, `(()=>{const needle=${JSON.stringify(text)};const n=v=>(v||'').replace(/\\s+/g,' ').trim();const e=[...document.querySelectorAll('button,a,[role="button"]')].find(x=>!x.disabled&&n(x.textContent).includes(needle));if(!e)return false;e.click();return true;})()`),
    `hydrated enabled control containing ${JSON.stringify(text)}`,
    timeoutMs,
  );
}

async function settle(cdp) {
  await evaluate(cdp, `Promise.all([document.fonts?.ready||Promise.resolve(),Promise.all([...document.images].map(image=>image.complete?Promise.resolve():new Promise(resolveImage=>{image.addEventListener('load',resolveImage,{once:true});image.addEventListener('error',resolveImage,{once:true});setTimeout(resolveImage,2500)})))])`);
  await sleep(250);
}

async function navigate(cdp, path) {
  const target = `${baseUrl}${path}`;
  await cdp.call("Page.navigate", { url: target });
  await waitUntil(() => evaluate(cdp, `location.href===${JSON.stringify(target)}&&['interactive','complete'].includes(document.readyState)`), `navigation to ${target}`);
  await settle(cdp);
}

async function recoveryDialogPresent(cdp) {
  return evaluate(cdp, `[...document.querySelectorAll('[role="dialog"]')].some(element=>(element.textContent||'').includes('SALVE SUA CHAVE DE RECUPERAÇÃO'))`);
}

async function dismissRecoveryAfterHydration(cdp) {
  await waitUntil(
    () => evaluate(cdp, `(()=>{const dialogs=[...document.querySelectorAll('[role="dialog"]')];const dialog=dialogs.find(element=>(element.textContent||'').includes('SALVE SUA CHAVE DE RECUPERAÇÃO'));if(!dialog)return true;const button=[...dialog.querySelectorAll('button')].find(element=>!element.disabled&&(element.textContent||'').replace(/\\s+/g,' ').trim()==='JÁ GUARDEI');if(button)button.click();return false;})()`),
    "recovery-key handoff dismissal after hydration",
    30_000,
  );
}

async function visibleStage(cdp) {
  if (await recoveryDialogPresent(cdp)) return "recovery";
  return evaluate(cdp, `(()=>{const text=document.body?.innerText||'';if(text.includes('PRIMEIRO ACESSO · ALPHA JOGÁVEL'))return'onboarding';if(text.includes('Escolha seu deck'))return'deck';if(text.includes('Prepare sua mão inicial'))return'mulligan';if(document.querySelector('.tcg-arena'))return'battle';return null})()`);
}

async function waitForStage(cdp, allowed, label, timeoutMs = 30_000) {
  return waitUntil(async () => {
    const stage = await visibleStage(cdp);
    return allowed.includes(stage) ? stage : false;
  }, label, timeoutMs);
}

async function enterTrainingBattle(cdp) {
  await navigate(cdp, "/play");
  let stage = await waitForStage(cdp, ["recovery", "onboarding", "deck", "mulligan", "battle"], "Alpha entry stage");
  if (stage === "recovery") {
    await dismissRecoveryAfterHydration(cdp);
    stage = await waitForStage(cdp, ["onboarding", "deck", "mulligan", "battle"], "post-recovery stage");
  }
  if (stage === "onboarding") {
    await clickText(cdp, "COMEÇAR TREINAMENTO");
    stage = await waitForStage(cdp, ["deck", "mulligan", "battle"], "post-onboarding stage");
  }
  if (stage === "deck") {
    await clickText(cdp, "ENTRAR NO NEXUS");
    stage = await waitForStage(cdp, ["mulligan", "battle"], "post-deck stage");
  }
  if (stage === "mulligan") {
    await clickText(cdp, "Manter mão inicial");
    stage = await waitForStage(cdp, ["battle"], "battlefield arena", 30_000);
  }
  assert.equal(stage, "battle", `unexpected final Alpha entry stage: ${stage}`);
  if (await evaluate(cdp, `Boolean(document.querySelector('.match-guide-backdrop'))`)) {
    await clickText(cdp, "Pular guia");
    await waitUntil(() => evaluate(cdp, `!document.querySelector('.match-guide-backdrop')`), "match guide to close");
  }
  await settle(cdp);
}

async function installDensityStressFixture(cdp) {
  return evaluate(cdp, `(()=>{const style=document.createElement('style');style.dataset.visualStressFixture='true';style.textContent='.rf-v4-density-probe{flex:0 0 84px;width:84px;height:104px;border:1px solid rgba(255,255,255,.12);border-radius:10px;background:rgba(15,23,42,.62);box-sizing:border-box}.rf-v4-hand-probe{height:118px;flex-basis:78px;width:78px}';document.head.appendChild(style);const makeProbe=(className,index)=>{const node=document.createElement('div');node.className=className;node.dataset.visualStressClone=String(index);node.setAttribute('aria-hidden','true');return node};const rows=[...document.querySelectorAll('.tcg-row[data-bench-side]')];for(const row of rows)for(let i=0;i<12;i+=1)row.appendChild(makeProbe('rf-v4-density-probe',i));const hand=document.querySelector('#player-hand-cards');if(!hand)return{ok:false,reason:'missing hand container'};for(let i=0;i<14;i+=1)hand.appendChild(makeProbe('rf-v4-density-probe rf-v4-hand-probe',i));return{ok:rows.length===2,rows:rows.length,handChildren:hand.children.length}})()`);
}

async function hoverRealHandCard(cdp) {
  const point = await evaluate(cdp, `(async()=>{const target=document.querySelector('#player-hand-cards [data-card-tip-def-id]');if(!target)return null;target.scrollIntoView({block:'center',inline:'center'});await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const rect=target.getBoundingClientRect();return{x:rect.left+rect.width/2,y:rect.top+rect.height/2}})()`);
  assert.ok(point && Number.isFinite(point.x) && Number.isFinite(point.y), "stress certification requires at least one real hand card");
  await cdp.call("Input.dispatchMouseEvent", { type: "mouseMoved", x: 2, y: 2 });
  await sleep(120);
  await cdp.call("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y });
  await waitUntil(() => evaluate(cdp, `Boolean(document.querySelector('[data-tooltip-panel="true"]'))`), "card intelligence tooltip");
}

async function collectStressEvidence(cdp) {
  return evaluate(cdp, `(()=>{const rect=selector=>{const e=document.querySelector(selector);if(!e)return null;const r=e.getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height}};const scroll=selector=>{const e=document.querySelector(selector);return e?{clientWidth:e.clientWidth,scrollWidth:e.scrollWidth,clientHeight:e.clientHeight,scrollHeight:e.scrollHeight}:null};const actionButtons=[...document.querySelectorAll('.tcg-actions button:not(:disabled)')].map(button=>{const r=button.getBoundingClientRect();const x=Math.max(0,Math.min(innerWidth-1,r.left+r.width/2));const y=Math.max(0,Math.min(innerHeight-1,r.top+r.height/2));const hit=document.elementFromPoint(x,y);return{text:(button.textContent||'').trim(),rect:{top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height},hitTestable:hit===button||button.contains(hit)}});return{innerWidth,innerHeight,document:{scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight},arena:rect('.tcg-arena'),rivalField:rect('.tcg-row[data-bench-side="ai"]'),playerField:rect('.tcg-row[data-bench-side="player"]'),hand:rect('.player-hand-shell'),actions:rect('.tcg-actions'),tooltip:rect('[data-tooltip-panel="true"]'),rivalScroll:scroll('.tcg-row[data-bench-side="ai"]'),playerScroll:scroll('.tcg-row[data-bench-side="player"]'),handScroll:scroll('#player-hand-cards'),actionButtons,probeCount:document.querySelectorAll('[data-visual-stress-clone]').length}})()`);
}

function assertStressEvidence(evidence) {
  assert.equal(evidence.innerWidth, viewport.width, "stress viewport width mismatch");
  assert.equal(evidence.innerHeight, viewport.height, "stress viewport height mismatch");
  assert.ok(evidence.document.scrollWidth <= evidence.innerWidth + 2, `density stress created horizontal page overflow: ${evidence.document.scrollWidth}px > ${evidence.innerWidth}px`);
  assert.ok(evidence.document.scrollHeight <= evidence.innerHeight + 2, `density stress created vertical page overflow: ${evidence.document.scrollHeight}px > ${evidence.innerHeight}px`);
  for (const [label, box] of Object.entries({ arena: evidence.arena, rivalField: evidence.rivalField, playerField: evidence.playerField, hand: evidence.hand, actions: evidence.actions })) {
    assert.ok(box, `density stress is missing ${label}`);
    assert.ok(box.top >= -1, `density stress clips ${label} above viewport: ${box.top}`);
    assert.ok(box.bottom <= evidence.innerHeight + 1, `density stress clips ${label} below viewport: ${box.bottom}`);
  }
  assert.ok(evidence.rivalScroll.scrollWidth > evidence.rivalScroll.clientWidth + 20, "rival row stress did not create local horizontal density");
  assert.ok(evidence.playerScroll.scrollWidth > evidence.playerScroll.clientWidth + 20, "player row stress did not create local horizontal density");
  assert.ok(evidence.handScroll.scrollWidth > evidence.handScroll.clientWidth + 20, "hand stress did not create local horizontal density");
  assert.ok(evidence.probeCount >= 38, `density stress fixture did not install enough probes: ${evidence.probeCount}`);
  assert.ok(evidence.tooltip, "card intelligence tooltip disappeared under density stress");
  assert.ok(evidence.tooltip.left >= 0 && evidence.tooltip.top >= 0 && evidence.tooltip.right <= evidence.innerWidth + 1 && evidence.tooltip.bottom <= evidence.innerHeight + 1, "stress tooltip escapes viewport bounds");
  assert.ok(evidence.actionButtons.length > 0, "stress certification requires an enabled primary action");
  assert.ok(evidence.actionButtons.some((button) => button.hitTestable), "no enabled battlefield action remains hit-testable under density stress");
}

async function capture(cdp, filename) {
  const shot = await cdp.call("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  await writeFile(join(outputDir, filename), Buffer.from(shot.data, "base64"));
}

async function writeFailureEvidence(cdp, error) {
  try {
    const diagnostic = await evaluate(cdp, `({href:location.href,innerWidth,innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,bodyText:(document.body?.innerText||'').slice(0,4000)})`);
    await writeFile(join(outputDir, "failure-diagnostic.json"), `${JSON.stringify({ error: String(error?.stack || error), diagnostic }, null, 2)}\n`);
    await capture(cdp, "failure-diagnostic.png");
  } catch {}
}

async function main() {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  const profileDir = await mkdtemp(join(tmpdir(), "runeforge-v4-2-density-"));
  const chrome = spawn(findChrome(), ["--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars", "--mute-audio", CHROME_REMOTE_DEBUGGING_FLAG, `--user-data-dir=${profileDir}`, `--window-size=${viewport.width},${viewport.height}`, "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
  let browserStderr = "";
  chrome.stderr.on("data", (chunk) => { browserStderr += String(chunk); });
  let cdp;
  try {
    const port = await waitForChromeDevToolsPort({ profileDir, chrome, getStderr: () => browserStderr });
    cdp = await CdpClient.connect(await waitForChrome(port));
    await cdp.call("Page.enable");
    await cdp.call("Runtime.enable");
    await cdp.call("Emulation.setDeviceMetricsOverride", viewport);
    try {
      await enterTrainingBattle(cdp);
      const fixture = await installDensityStressFixture(cdp);
      assert.equal(fixture.ok, true, `could not install notebook density stress fixture: ${JSON.stringify(fixture)}`);
      await settle(cdp);
      await hoverRealHandCard(cdp);
      await settle(cdp);
      const evidence = await collectStressEvidence(cdp);
      assertStressEvidence(evidence);
      await capture(cdp, "battlefield-density-stress-1280x720.png");
      const report = { ok: true, viewport, fixture, evidence, gitSha: process.env.GITHUB_SHA || null, capturedAt: new Date().toISOString() };
      await writeFile(join(outputDir, "battlefield-density-stress-1280x720.json"), `${JSON.stringify(report, null, 2)}\n`);
      console.log(`VISUAL 4.2 NOTEBOOK DENSITY STRESS: PASS — ${JSON.stringify(evidence)}`);
    } catch (error) {
      await writeFailureEvidence(cdp, error);
      throw error;
    }
  } finally {
    try { cdp?.close(); } catch {}
    await shutdownChrome(chrome, profileDir);
  }
}

void main().catch((error) => {
  console.error("VISUAL 4.2 NOTEBOOK DENSITY STRESS: FAIL", error);
  process.exitCode = 1;
});