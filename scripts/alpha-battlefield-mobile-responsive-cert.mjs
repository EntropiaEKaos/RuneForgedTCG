import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { CHROME_REMOTE_DEBUGGING_FLAG, waitForChromeDevToolsPort } from "./chrome-devtools-bootstrap.mjs";

const baseUrl = (process.env.E2E_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const outputDir = resolve(process.env.ALPHA_VISUAL_DIR || "artifacts/alpha-visual-4-3-mobile");
const viewports = [
  { name: "portrait", width: 390, height: 844, deviceScaleFactor: 1, mobile: true, touch: true, minAction: 44 },
  { name: "landscape", width: 844, height: 390, deviceScaleFactor: 1, mobile: true, touch: true, minAction: 38 },
];
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

async function waitUntil(check, label, timeoutMs = 30_000) {
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
    stage = await waitForStage(cdp, ["battle"], "battlefield arena");
  }
  assert.equal(stage, "battle", `unexpected final Alpha entry stage: ${stage}`);
  if (await evaluate(cdp, `Boolean(document.querySelector('.match-guide-backdrop'))`)) {
    await clickText(cdp, "Pular guia");
    await waitUntil(() => evaluate(cdp, `!document.querySelector('.match-guide-backdrop')`), "match guide to close");
  }
  await settle(cdp);
}

async function setViewport(cdp, viewport) {
  await cdp.call("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: viewport.deviceScaleFactor,
    mobile: viewport.mobile,
    screenWidth: viewport.width,
    screenHeight: viewport.height,
  });
  await cdp.call("Emulation.setTouchEmulationEnabled", { enabled: viewport.touch, maxTouchPoints: viewport.touch ? 5 : 1 });
  await settle(cdp);
}

async function ensureHandState(cdp, expanded) {
  await waitUntil(
    () => evaluate(cdp, `(()=>{const shell=document.querySelector('.player-hand-shell');const button=document.querySelector('.mobile-hand-toggle');if(!shell||!button)return false;const current=shell.classList.contains('expanded');if(current===${expanded})return true;button.click();return false;})()`),
    `mobile hand ${expanded ? "expanded" : "collapsed"}`,
  );
  await settle(cdp);
}

async function ensureEnabledBattlefieldAction(cdp) {
  await waitUntil(
    () => evaluate(cdp, `document.querySelector('.tcg-actions button:not(:disabled)') !== null`),
    "player battlefield action after opponent turn",
    30_000,
  );
  await settle(cdp);
}

async function collectEvidence(cdp) {
  return evaluate(cdp, `(()=>{const rect=selector=>{const e=document.querySelector(selector);if(!e)return null;const r=e.getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height}};const hit=selector=>{const e=document.querySelector(selector);if(!e)return false;const r=e.getBoundingClientRect();const x=Math.max(0,Math.min(innerWidth-1,r.left+r.width/2));const y=Math.max(0,Math.min(innerHeight-1,r.top+r.height/2));const h=document.elementFromPoint(x,y);return h===e||e.contains(h)};const actions=[...document.querySelectorAll('.tcg-actions button:not(:disabled)')].map(button=>{const r=button.getBoundingClientRect();return{text:(button.textContent||'').trim(),width:r.width,height:r.height,top:r.top,bottom:r.bottom}});const handShell=document.querySelector('.player-hand-shell');const handCards=document.querySelector('#player-hand-cards');return{innerWidth,innerHeight,document:{scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight},arena:rect('.tcg-arena'),rivalField:rect('.tcg-row[data-bench-side="ai"]'),playerField:rect('.tcg-row[data-bench-side="player"]'),hand:rect('.player-hand-shell'),actionsRect:rect('.tcg-actions'),toggle:rect('.mobile-hand-toggle'),toggleHit:hit('.mobile-hand-toggle'),handExpanded:Boolean(handShell?.classList.contains('expanded')),handCardsDisplay:handCards?getComputedStyle(handCards).display:null,actions}})()`);
}

function assertCollapsedEvidence(evidence, viewport) {
  assert.equal(evidence.innerWidth, viewport.width, `${viewport.name}: viewport width mismatch`);
  assert.equal(evidence.innerHeight, viewport.height, `${viewport.name}: viewport height mismatch`);
  assert.ok(evidence.document.scrollWidth <= evidence.innerWidth + 2, `${viewport.name}: horizontal document overflow`);
  assert.ok(evidence.document.scrollHeight <= evidence.innerHeight + 2, `${viewport.name}: vertical document overflow`);
  for (const [label, box] of Object.entries({ arena: evidence.arena, rivalField: evidence.rivalField, playerField: evidence.playerField, hand: evidence.hand, actions: evidence.actionsRect, toggle: evidence.toggle })) {
    assert.ok(box, `${viewport.name}: missing ${label}`);
    assert.ok(box.top >= -1, `${viewport.name}: ${label} clips above viewport (${box.top})`);
    assert.ok(box.bottom <= evidence.innerHeight + 1, `${viewport.name}: ${label} clips below viewport (${box.bottom})`);
  }
  assert.equal(evidence.handExpanded, false, `${viewport.name}: hand must start collapsed`);
  assert.equal(evidence.handCardsDisplay, "none", `${viewport.name}: collapsed hand must remove card shelf from layout`);
  assert.equal(evidence.toggleHit, true, `${viewport.name}: hand toggle must be physically hit-testable`);
  assert.ok(evidence.actions.length > 0, `${viewport.name}: expected an enabled battlefield action`);
  assert.ok(evidence.actions.some((action) => action.height >= viewport.minAction - 1), `${viewport.name}: no action reaches the touch-height floor ${viewport.minAction}px`);
}

function assertExpandedEvidence(evidence, viewport) {
  assert.ok(evidence.document.scrollWidth <= evidence.innerWidth + 2, `${viewport.name} expanded: horizontal document overflow`);
  assert.ok(evidence.document.scrollHeight <= evidence.innerHeight + 2, `${viewport.name} expanded: vertical document overflow`);
  assert.equal(evidence.handExpanded, true, `${viewport.name}: hand drawer did not expand`);
  assert.notEqual(evidence.handCardsDisplay, "none", `${viewport.name}: expanded drawer must expose cards`);
  assert.ok(evidence.hand && evidence.hand.top >= -1 && evidence.hand.bottom <= evidence.innerHeight + 1, `${viewport.name}: expanded hand drawer must stay inside viewport`);
  assert.ok(evidence.actionsRect && evidence.actionsRect.top >= -1 && evidence.actionsRect.bottom <= evidence.innerHeight + 1, `${viewport.name}: action rail must remain visible with drawer open`);
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
  const profileDir = await mkdtemp(join(tmpdir(), "runeforge-v4-3-mobile-"));
  const chrome = spawn(findChrome(), ["--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars", "--mute-audio", CHROME_REMOTE_DEBUGGING_FLAG, `--user-data-dir=${profileDir}`, "--window-size=920,920", "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
  let browserStderr = "";
  chrome.stderr.on("data", (chunk) => { browserStderr += String(chunk); });
  let cdp;
  try {
    const port = await waitForChromeDevToolsPort({ profileDir, chrome, getStderr: () => browserStderr });
    cdp = await CdpClient.connect(await waitForChrome(port));
    await cdp.call("Page.enable");
    await cdp.call("Runtime.enable");
    await setViewport(cdp, viewports[0]);
    try {
      await enterTrainingBattle(cdp);
      await ensureEnabledBattlefieldAction(cdp);
      const report = [];
      for (const viewport of viewports) {
        await setViewport(cdp, viewport);
        await ensureHandState(cdp, false);
        const collapsed = await collectEvidence(cdp);
        assertCollapsedEvidence(collapsed, viewport);
        await capture(cdp, `battlefield-mobile-${viewport.name}-${viewport.width}x${viewport.height}.png`);

        await ensureHandState(cdp, true);
        const expanded = await collectEvidence(cdp);
        assertExpandedEvidence(expanded, viewport);
        await capture(cdp, `battlefield-mobile-${viewport.name}-hand-open-${viewport.width}x${viewport.height}.png`);
        report.push({ viewport, collapsed, expanded });
        await ensureHandState(cdp, false);
      }
      await writeFile(join(outputDir, "visual-4-3-mobile-report.json"), `${JSON.stringify({ ok: true, report, gitSha: process.env.GITHUB_SHA || null, capturedAt: new Date().toISOString() }, null, 2)}\n`);
      console.log(`VISUAL 4.3 MOBILE RESPONSIVE: PASS — ${JSON.stringify(report.map((entry) => ({ viewport: entry.viewport.name, document: entry.collapsed.document, hand: entry.collapsed.hand, actions: entry.collapsed.actionsRect })))}`);
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
  console.error("VISUAL 4.3 MOBILE RESPONSIVE: FAIL", error);
  process.exitCode = 1;
});