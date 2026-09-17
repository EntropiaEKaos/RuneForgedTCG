import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { CHROME_REMOTE_DEBUGGING_FLAG, waitForChromeDevToolsPort } from "./chrome-devtools-bootstrap.mjs";

const baseUrl = (process.env.E2E_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const outputDir = resolve(process.env.ALPHA_VISUAL_DIR || "artifacts/alpha-visual");
const presets = ["summon", "attack", "damage", "heal", "death", "levelup", "poison", "barrier", "barrierbreak", "frost", "stun"];
const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

function findChrome() {
  for (const candidate of [process.env.CHROME_BIN, "google-chrome", "google-chrome-stable", "chromium", "chromium-browser"].filter(Boolean)) {
    const result = spawnSync("which", [candidate], { encoding: "utf8" });
    if (result.status === 0 && result.stdout.trim()) return result.stdout.trim();
  }
  throw new Error("Chrome/Chromium not found");
}

async function stopChrome(chrome) {
  if (chrome.exitCode !== null || chrome.signalCode !== null) return;
  const exited = new Promise((resolvePromise) => chrome.once("exit", resolvePromise));
  chrome.kill("SIGTERM");
  await Promise.race([exited, sleep(5_000)]);
  if (chrome.exitCode === null && chrome.signalCode === null) {
    const killed = new Promise((resolvePromise) => chrome.once("exit", resolvePromise));
    chrome.kill("SIGKILL");
    await Promise.race([killed, sleep(2_000)]);
  }
}

class CdpClient {
  constructor(socket) {
    this.socket = socket; this.nextId = 1; this.pending = new Map();
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id) return;
      const pending = this.pending.get(message.id); if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(`${pending.method}: ${message.error.message}`));
      else pending.resolve(message.result || {});
    });
  }
  static async connect(url) {
    assert.equal(typeof WebSocket, "function", "Node 22 WebSocket global is required");
    assert.equal(typeof url, "string", "Chrome page WebSocket URL is required");
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
  while (Date.now() < deadline) { if (await check()) return; await sleep(100); }
  throw new Error(`Timed out waiting for ${label}`);
}

async function navigate(cdp, path) {
  const target = `${baseUrl}${path}`;
  await cdp.call("Page.navigate", { url: target });
  await waitUntil(() => evaluate(cdp, `location.href === ${JSON.stringify(target)} && ['interactive','complete'].includes(document.readyState)`), `navigation to ${target}`, 30_000);
  await sleep(250);
}

async function waitForText(cdp, text) {
  return waitUntil(() => evaluate(cdp, `document.body?.innerText?.includes(${JSON.stringify(text)}) === true`), `text ${JSON.stringify(text)}`);
}

async function login(cdp) {
  const password = process.env.ADMIN_PASSWORD?.trim();
  assert.ok(password, "ADMIN_PASSWORD is required");
  const payload = JSON.stringify({ username: process.env.ADMIN_USERNAME?.trim() || "admin", password });
  const result = await evaluate(cdp, `(async () => {
    const response = await fetch('/api/admin/login', { method:'POST', credentials:'include', headers:{'content-type':'application/json'}, body:${JSON.stringify(payload)} });
    return { status:response.status, body:await response.json().catch(() => null) };
  })()`);
  assert.equal(result?.status, 200, `Admin login failed: ${JSON.stringify(result)}`);
  assert.equal(result?.body?.ok, true, "Admin login did not return ok=true");
}

async function clickText(cdp, text) {
  await waitUntil(() => evaluate(cdp, `(() => { const n=v=>(v||'').replace(/\\s+/g,' ').trim(); return [...document.querySelectorAll('button,a,[role="button"]')].some(x=>!x.disabled&&n(x.textContent).includes(${JSON.stringify(text)})); })()`), `interactive ${text}`);
  assert.equal(await evaluate(cdp, `(() => { const n=v=>(v||'').replace(/\\s+/g,' ').trim(); const x=[...document.querySelectorAll('button,a,[role="button"]')].find(x=>!x.disabled&&n(x.textContent).includes(${JSON.stringify(text)})); if(!x)return false; x.scrollIntoView({block:'center'}); x.click(); return true; })()`), true);
}

async function screenshot(cdp, name) {
  const shot = await cdp.call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  const { writeFile } = await import("node:fs/promises");
  await writeFile(join(outputDir, name), Buffer.from(shot.data, "base64"));
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const profile = await mkdtemp(join(tmpdir(), "forged-fx-cert-"));
  let chromeStderr = "";
  const chrome = spawn(findChrome(), ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage", CHROME_REMOTE_DEBUGGING_FLAG, `--user-data-dir=${profile}`, "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
  chrome.stderr?.setEncoding("utf8");
  chrome.stderr?.on("data", (chunk) => { chromeStderr = `${chromeStderr}${chunk}`.slice(-8_000); });
  let cdp;
  try {
    const port = await waitForChromeDevToolsPort({ profileDir: profile, chrome, getStderr: () => chromeStderr });
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    cdp = await CdpClient.connect(targets.find((target) => target.type === "page")?.webSocketDebuggerUrl);
    await cdp.call("Page.enable"); await cdp.call("Runtime.enable");
    await cdp.call("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });

    await navigate(cdp, "/admin/studio");
    await waitForText(cdp, "Runeforge Studio Access");
    await login(cdp);
    await navigate(cdp, "/admin/studio/cards");
    await waitForText(cdp, "Card Authoring Studio");
    if (!(await evaluate(cdp, "document.querySelector('[data-card-fx-studio=true]') !== null"))) await clickText(cdp, "FX Studio");
    await waitUntil(() => evaluate(cdp, "document.querySelector('[data-card-fx-studio=true]') !== null"), "FX Studio panel");

    for (const preset of presets) {
      await clickText(cdp, preset);
      await clickText(cdp, "Run production FX");
      await waitUntil(() => evaluate(cdp, "document.body?.innerText?.includes('● LIVE') === true"), `${preset} live marker`);
      await sleep(120);
      await screenshot(cdp, `fx-${preset}-active.png`);
      await waitUntil(() => evaluate(cdp, "document.body?.innerText?.includes('● LIVE') !== true"), `${preset} cleanup`, 3_000);
    }

    assert.equal(await evaluate(cdp, "document.querySelectorAll('canvas').length <= 1"), true, "FX cleanup left unexpected canvas layers");
    console.log(`FX VISUAL BROWSER CERT: PASS — ${presets.length} transient presets captured`);
  } finally {
    cdp?.close();
    await stopChrome(chrome);
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

main().catch((error) => { console.error(`FX VISUAL BROWSER CERT: FAIL — ${error.message}`); process.exitCode = 1; });
