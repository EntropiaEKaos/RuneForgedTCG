import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { CHROME_REMOTE_DEBUGGING_FLAG, waitForChromeDevToolsPort } from "./chrome-devtools-bootstrap.mjs";

const baseUrl = (process.env.E2E_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const outputDir = resolve(process.env.ALPHA_VISUAL_DIR || "artifacts/alpha-visual-4-2");
const viewport = { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false };

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

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
    let finished = false;
    const finish = (value) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      child.removeListener("exit", onExit);
      resolvePromise(value);
    };
    const onExit = () => finish(true);
    const timer = setTimeout(() => finish(false), timeoutMs);
    child.once("exit", onExit);
  });
}

async function shutdownChrome(chrome, profileDir) {
  if (chrome.exitCode == null && chrome.signalCode == null) chrome.kill("SIGTERM");
  const terminated = await waitForProcessExit(chrome, 1500);
  if (!terminated && chrome.exitCode == null && chrome.signalCode == null) {
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
      const timeout = setTimeout(() => reject(new Error("Timed out opening Chrome DevTools WebSocket")), 10_000);
      socket.addEventListener("open", () => { clearTimeout(timeout); resolvePromise(); }, { once: true });
      socket.addEventListener("error", () => { clearTimeout(timeout); reject(new Error("Failed to open Chrome DevTools WebSocket")); }, { once: true });
    });
    return new CdpClient(socket);
  }

  call(method, params = {}) {
    const id = this.nextId++;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolvePromise, reject) => this.pending.set(id, { resolve: resolvePromise, reject, method }));
  }

  close() {
    this.socket.close();
  }
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
    } catch (error) {
      last = error;
    }
    await sleep(125);
  }
  throw new Error(`Timed out waiting for ${label}${last instanceof Error ? `: ${last.message}` : ""}`);
}

async function waitForText(cdp, text, timeoutMs = 25_000) {
  const encoded = JSON.stringify(text);
  return waitUntil(() => evaluate(cdp, `document.body?.innerText?.includes(${encoded}) === true`), `text ${encoded}`, timeoutMs);
}

async function clickText(cdp, text) {
  const encoded = JSON.stringify(text);
  const clicked = await evaluate(cdp, `(() => {
    const target = [...document.querySelectorAll('button,a,[role="button"]')]
      .find((element) => !element.disabled && (element.textContent || '').replace(/\\s+/g, ' ').trim().includes(${encoded}));
    if (!target) return false;
    target.click();
    return true;
  })()`);
  assert.equal(clicked, true, `Could not click control containing text: ${text}`);
}

async function settle(cdp) {
  await evaluate(cdp, `Promise.all([document.fonts?.ready || Promise.resolve(), Promise.all([...document.images].map((image) => image.complete ? Promise.resolve() : new Promise((resolveImage) => { image.addEventListener('load', resolveImage, { once: true }); image.addEventListener('error', resolveImage, { once: true }); setTimeout(resolveImage, 2500); })))])`);
  await sleep(250);
}

async function navigate(cdp, path) {
  const target = `${baseUrl}${path}`;
  await cdp.call("Page.navigate", { url: target });
  await waitUntil(() => evaluate(cdp, `location.href === ${JSON.stringify(target)} && (document.readyState === 'interactive' || document.readyState === 'complete')`), `navigation to ${target}`);
  await settle(cdp);
}

async function enterTrainingBattle(cdp) {
  await navigate(cdp, "/play");
  if (await evaluate(cdp, `document.body?.innerText?.includes('SALVE SUA CHAVE DE RECUPERAÇÃO') === true`)) {
    await clickText(cdp, "JÁ GUARDEI");
    await waitUntil(() => evaluate(cdp, `document.body?.innerText?.includes('SALVE SUA CHAVE DE RECUPERAÇÃO') !== true`), "recovery handoff to close");
  }
  if (await evaluate(cdp, `document.body?.innerText?.includes('PRIMEIRO ACESSO · ALPHA JOGÁVEL') === true`)) {
    await clickText(cdp, "COMEÇAR TREINAMENTO");
  }
  await waitForText(cdp, "Escolha seu deck");
  await clickText(cdp, "ENTRAR NO NEXUS");
  await waitForText(cdp, "Prepare sua mão inicial", 30_000);
  await clickText(cdp, "Manter mão inicial");
  await waitUntil(() => evaluate(cdp, `Boolean(document.querySelector('.tcg-arena'))`), "battlefield arena", 30_000);
  if (await evaluate(cdp, `Boolean(document.querySelector('.match-guide-backdrop'))`)) {
    await clickText(cdp, "Pular guia");
    await waitUntil(() => evaluate(cdp, `!document.querySelector('.match-guide-backdrop')`), "match guide to close");
  }
  await settle(cdp);
}

async function installDensityStressFixture(cdp) {
  return evaluate(cdp, `(() => {
    const style = document.createElement('style');
    style.dataset.visualStressFixture = 'true';
    style.textContent = '.rf-v4-density-probe{flex:0 0 84px;width:84px;height:104px;border:1px solid rgba(255,255,255,.12);border-radius:10px;background:rgba(15,23,42,.62);box-sizing:border-box}.rf-v4-hand-probe{height:118px;flex-basis:78px;width:78px}';
    document.head.appendChild(style);
    const makeProbe = (className, index) => {
      const node = document.createElement('div');
      node.className = className;
      node.dataset.visualStressClone = String(index);
      node.setAttribute('aria-hidden', 'true');
      return node;
    };
    const rows = [...document.querySelectorAll('.tcg-row[data-bench-side]')];
    for (const row of rows) {
      for (let i = 0; i < 12; i += 1) row.appendChild(makeProbe('rf-v4-density-probe', i));
    }
    const hand = document.querySelector('#player-hand-cards');
    if (!hand) return { ok: false, reason: 'missing hand container' };
    for (let i = 0; i < 14; i += 1) hand.appendChild(makeProbe('rf-v4-density-probe rf-v4-hand-probe', i));
    return { ok: rows.length === 2, rows: rows.length, handChildren: hand.children.length };
  })()`);
}

async function hoverRealHandCard(cdp) {
  const point = await evaluate(cdp, `(() => {
    const target = document.querySelector('#player-hand-cards [data-card-tip-def-id]');
    if (!target) return null;
    const rect = target.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + Math.min(rect.height / 2, 36) };
  })()`);
  assert.ok(point, "stress certification requires at least one real hand card");
  await cdp.call("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y });
  await waitUntil(() => evaluate(cdp, `Boolean(document.querySelector('[data-tooltip-panel="true"]'))`), "card intelligence tooltip");
}

async function collectStressEvidence(cdp) {
  return evaluate(cdp, `(() => {
    const rect = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const r = element.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height };
    };
    const scroll = (selector) => {
      const element = document.querySelector(selector);
      return element ? { clientWidth: element.clientWidth, scrollWidth: element.scrollWidth, clientHeight: element.clientHeight, scrollHeight: element.scrollHeight } : null;
    };
    const tooltip = rect('[data-tooltip-panel="true"]');
    const actionButtons = [...document.querySelectorAll('.tcg-actions button:not(:disabled)')].map((button) => {
      const r = button.getBoundingClientRect();
      const x = Math.max(0, Math.min(innerWidth - 1, r.left + r.width / 2));
      const y = Math.max(0, Math.min(innerHeight - 1, r.top + r.height / 2));
      const hit = document.elementFromPoint(x, y);
      return { text: (button.textContent || '').trim(), rect: { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height }, hitTestable: hit === button || button.contains(hit) };
    });
    return {
      innerWidth,
      innerHeight,
      document: { scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight },
      arena: rect('.tcg-arena'),
      rivalField: rect('.tcg-row[data-bench-side="ai"]'),
      playerField: rect('.tcg-row[data-bench-side="player"]'),
      hand: rect('.player-hand-shell'),
      actions: rect('.tcg-actions'),
      rivalScroll: scroll('.tcg-row[data-bench-side="ai"]'),
      playerScroll: scroll('.tcg-row[data-bench-side="player"]'),
      handScroll: scroll('#player-hand-cards'),
      tooltip,
      actionButtons,
      probeCount: document.querySelectorAll('[data-visual-stress-clone]').length,
    };
  })()`);
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
  assert.ok(evidence.tooltip.left >= 0 && evidence.tooltip.top >= 0, "stress tooltip escapes top/left viewport bounds");
  assert.ok(evidence.tooltip.right <= evidence.innerWidth + 1, "stress tooltip escapes right viewport bound");
  assert.ok(evidence.tooltip.bottom <= evidence.innerHeight + 1, "stress tooltip escapes bottom viewport bound");
  assert.ok(evidence.actionButtons.length > 0, "stress certification requires an enabled primary action");
  assert.ok(evidence.actionButtons.some((button) => button.hitTestable), "no enabled battlefield action remains hit-testable under density stress");
}

async function capture(cdp, filename) {
  const shot = await cdp.call("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  await writeFile(join(outputDir, filename), Buffer.from(shot.data, "base64"));
}

async function main() {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  const profileDir = await mkdtemp(join(tmpdir(), "runeforge-v4-2-density-"));
  const chromePath = findChrome();
  const chrome = spawn(chromePath, ["--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars", "--mute-audio", CHROME_REMOTE_DEBUGGING_FLAG, `--user-data-dir=${profileDir}`, `--window-size=${viewport.width},${viewport.height}`, "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
  let browserStderr = "";
  chrome.stderr.on("data", (chunk) => { browserStderr += String(chunk); });
  let cdp;
  try {
    const port = await waitForChromeDevToolsPort({ profileDir, chrome, getStderr: () => browserStderr });
    cdp = await CdpClient.connect(await waitForChrome(port));
    await cdp.call("Page.enable");
    await cdp.call("Runtime.enable");
    await cdp.call("Emulation.setDeviceMetricsOverride", viewport);
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
  } finally {
    try { cdp?.close(); } catch {}
    await shutdownChrome(chrome, profileDir);
  }
}

void main().catch((error) => {
  console.error("VISUAL 4.2 NOTEBOOK DENSITY STRESS: FAIL", error);
  process.exitCode = 1;
});
