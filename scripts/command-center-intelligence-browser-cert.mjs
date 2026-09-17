import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { CHROME_REMOTE_DEBUGGING_FLAG, waitForChromeDevToolsPort } from "./chrome-devtools-bootstrap.mjs";

const baseUrl = (process.env.E2E_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const outputDir = resolve(process.env.ALPHA_VISUAL_DIR || "artifacts/alpha-visual");
const viewport = { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false };
const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

function findChrome() {
  const candidates = [process.env.CHROME_BIN, "google-chrome", "google-chrome-stable", "chromium", "chromium-browser"].filter(Boolean);
  for (const candidate of candidates) {
    const result = spawnSync("which", [candidate], { encoding: "utf8" });
    if (result.status === 0 && result.stdout.trim()) return result.stdout.trim();
  }
  throw new Error(`Chrome/Chromium not found. Tried: ${candidates.join(", ")}`);
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
    try { last = await check(); if (last) return last; } catch (error) { last = error; }
    await sleep(125);
  }
  throw new Error(`Timed out waiting for ${label}${last instanceof Error ? `: ${last.message}` : ""}`);
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

async function shutdown(chrome, profileDir) {
  if (chrome.exitCode == null && chrome.signalCode == null) chrome.kill("SIGTERM");
  await sleep(300);
  if (chrome.exitCode == null && chrome.signalCode == null) chrome.kill("SIGKILL");
  await rm(profileDir, { recursive:true, force:true, maxRetries:5, retryDelay:200 }).catch(() => {});
}

async function main() {
  await mkdir(outputDir, { recursive:true });
  const profileDir = await mkdtemp(join(tmpdir(), "forged-command-center-"));
  const chrome = spawn(findChrome(), ["--headless=new","--disable-gpu","--no-sandbox","--disable-dev-shm-usage","--hide-scrollbars","--mute-audio",CHROME_REMOTE_DEBUGGING_FLAG,`--user-data-dir=${profileDir}`,`--window-size=${viewport.width},${viewport.height}`,"about:blank"], { stdio:["ignore","ignore","pipe"] });
  let stderr = ""; chrome.stderr.on("data", (chunk) => { stderr += String(chunk); });
  let cdp;
  try {
    const port = await waitForChromeDevToolsPort({ profileDir, chrome, getStderr: () => stderr });
    cdp = await CdpClient.connect(await waitForChrome(port));
    await cdp.call("Page.enable"); await cdp.call("Runtime.enable"); await cdp.call("Emulation.setDeviceMetricsOverride", viewport);
    await cdp.call("Page.navigate", { url:`${baseUrl}/admin/studio` });
    await waitUntil(() => evaluate(cdp, `["interactive","complete"].includes(document.readyState)`), "Studio shell");
    await login(cdp);
    await cdp.call("Page.navigate", { url:`${baseUrl}/admin/studio/command-center` });
    await waitUntil(() => evaluate(cdp, `["interactive","complete"].includes(document.readyState)`), "Command Center navigation");
    await waitUntil(() => evaluate(cdp, `document.body?.innerText?.includes('INTELLIGENCE 1.7') && document.body?.innerText?.includes('Saúde operacional e movimento do funil')`), "Intelligence 1.7 panel");
    await waitUntil(() => evaluate(cdp, `document.body?.innerText?.includes('24h atuais') && document.body?.innerText?.includes('Maior vazamento absoluto')`), "Intelligence comparison contract");
    const evidence = await evaluate(cdp, `(() => {
      const text = (document.body?.innerText || '').replace(/\\s+/g,' ').trim();
      const root = document.documentElement;
      return {
        href: location.href,
        innerWidth: window.innerWidth,
        scrollWidth: root.scrollWidth,
        intelligence: text.includes('INTELLIGENCE 1.7'),
        title: text.includes('Saúde operacional e movimento do funil'),
        absoluteLeak: text.includes('Maior vazamento absoluto'),
        comparison: text.includes('24h atuais') && text.includes('24h anteriores'),
        neutralDirection: text.includes('Setas descrevem direção matemática, não julgamento.'),
        signalLabels: ['DAU / MAU','DAU / WAU','Conclusão PvP 24h','Aprovação pagamentos 24h'].filter((label) => text.includes(label)),
      };
    })()`);
    assert.equal(evidence.intelligence, true);
    assert.equal(evidence.title, true);
    assert.equal(evidence.absoluteLeak, true);
    assert.equal(evidence.comparison, true);
    assert.equal(evidence.neutralDirection, true);
    assert.equal(evidence.signalLabels.length, 4, `Missing operational signals: ${JSON.stringify(evidence)}`);
    assert.ok(evidence.scrollWidth <= evidence.innerWidth + 2, `Command Center has horizontal overflow: ${evidence.scrollWidth}px > ${evidence.innerWidth}px`);
    const screenshot = await cdp.call("Page.captureScreenshot", { format:"png", fromSurface:true, captureBeyondViewport:false });
    await writeFile(join(outputDir, "44-studio-command-center-intelligence.png"), Buffer.from(screenshot.data, "base64"));
    await writeFile(join(outputDir, "command-center-intelligence-manifest.json"), `${JSON.stringify({ version:"1.8", viewport, evidence, screenshots:["44-studio-command-center-intelligence.png"] }, null, 2)}\n`, "utf8");
    console.log("Command Center Intelligence browser certification PASS", JSON.stringify(evidence));
  } finally {
    cdp?.close();
    await shutdown(chrome, profileDir);
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
