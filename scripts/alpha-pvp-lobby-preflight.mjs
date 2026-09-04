import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { CHROME_REMOTE_DEBUGGING_FLAG, waitForChromeDevToolsPort } from "./chrome-devtools-bootstrap.mjs";

const baseUrl = (process.env.E2E_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const playerName = `PVP Preflight ${Date.now().toString(36).slice(-7)}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function findChrome() {
  for (const candidate of [process.env.CHROME_BIN, "google-chrome", "google-chrome-stable", "chromium", "chromium-browser"].filter(Boolean)) {
    const found = spawnSync("which", [candidate], { encoding: "utf8" });
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error("Chrome/Chromium not found");
}

class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(`${pending.method}: ${message.error.message}`));
        else pending.resolve(message.result || {});
      } else this.events.push(message);
    });
  }
  call(method, params = {}) {
    const id = this.nextId++;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject, method }));
  }
  close() { this.socket.close(); }
}

function stderrTail(stderr) {
  const trimmed = String(stderr || "").trim();
  if (!trimmed) return "<no Chrome stderr>";
  return trimmed.slice(-4_000);
}

function chromeExitSummary(chrome, stderr) {
  return `exitCode=${chrome.exitCode ?? "null"} signal=${chrome.signalCode ?? "null"} stderr=${stderrTail(stderr)}`;
}

async function connect(port, chrome, getStderr) {
  const deadline = Date.now() + 20_000;
  let lastError;

  while (Date.now() < deadline) {
    if (chrome.exitCode != null || chrome.signalCode != null) {
      throw new Error(`Chrome exited before CDP connection: ${chromeExitSummary(chrome, getStderr())}`);
    }

    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (response.ok) {
        const targets = await response.json();
        const page = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl);
        if (page) {
          const socket = new WebSocket(page.webSocketDebuggerUrl);
          await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error("CDP WebSocket timeout")), 10_000);
            socket.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
            socket.addEventListener("error", () => { clearTimeout(timer); reject(new Error("CDP WebSocket failed")); }, { once: true });
          });
          return new Cdp(socket);
        }
      } else {
        lastError = new Error(`CDP discovery returned HTTP ${response.status}`);
      }
    } catch (error) {
      lastError = error;
    }
    await sleep(100);
  }

  throw new Error(
    `Chrome debugging endpoint was discovered on port ${port} but no page target became ready${lastError instanceof Error ? `: ${lastError.message}` : ""}; ${chromeExitSummary(chrome, getStderr())}`,
  );
}

async function evaluate(cdp, expression) {
  const result = await cdp.call("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || "Runtime.evaluate failed");
  return result.result?.value;
}

async function waitUntil(check, label, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check().catch(() => false)) return;
    await sleep(125);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function main() {
  assert.equal(typeof WebSocket, "function", "Node 22 WebSocket global required");
  const profileDir = await mkdtemp(join(tmpdir(), "runeforge-pvp-preflight-"));
  const chrome = spawn(findChrome(), [
    "--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage", "--mute-audio",
    CHROME_REMOTE_DEBUGGING_FLAG, `--user-data-dir=${profileDir}`, "--window-size=1440,1000", "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  let stderr = "";
  chrome.stderr.on("data", (chunk) => { stderr += String(chunk); });
  let cdp;
  try {
    const port = await waitForChromeDevToolsPort({ profileDir, chrome, getStderr: () => stderr });
    cdp = await connect(port, chrome, () => stderr);
    await cdp.call("Page.enable");
    await cdp.call("Runtime.enable");
    await cdp.call("Network.enable");
    await cdp.call("Page.navigate", { url: `${baseUrl}/api/health` });
    await waitUntil(() => evaluate(cdp, "document.readyState === 'complete'"), "health navigation");

    const registered = await evaluate(cdp, `(async () => {
      const response = await fetch('/api/player', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: ${JSON.stringify(playerName)} }),
      });
      return { status: response.status, body: await response.json().catch(() => ({})) };
    })()`);
    assert.equal(registered.status, 201, JSON.stringify(registered));

    await cdp.call("Page.navigate", { url: `${baseUrl}/pvp` });
    await waitUntil(() => evaluate(cdp, `document.body?.innerText?.includes('PvP casual') === true`), "PvP lobby");
    await waitUntil(() => evaluate(cdp, `document.body?.innerText?.includes(${JSON.stringify(playerName)}) === true`), "stable player identity");
    await waitUntil(() => evaluate(cdp, `Boolean([...document.querySelectorAll('button')].find((button) => (button.textContent || '').includes('Criar nova sala') && !button.disabled))`), "enabled create-room control");

    const clicked = await evaluate(cdp, `(() => {
      const button = [...document.querySelectorAll('button')].find((item) => (item.textContent || '').includes('Criar nova sala') && !item.disabled);
      if (!button) return false;
      button.click();
      return true;
    })()`);
    assert.equal(clicked, true);

    await sleep(2500);
    const ui = await evaluate(cdp, `(() => ({
      href: location.href,
      text: (document.body?.innerText || '').slice(0, 5000),
      status: [...document.querySelectorAll('[role="status"]')].map((node) => (node.textContent || '').replace(/\\s+/g, ' ').trim()).filter(Boolean),
      deck: document.querySelector('select')?.value || null,
      roomCode: [...document.querySelectorAll('h2')].map((node) => (node.textContent || '').trim()).find((text) => /^[A-Z2-9]{6}$/.test(text)) || null,
    }))()`);
    const session = await evaluate(cdp, `(async () => {
      const response = await fetch('/api/player', { credentials: 'include', cache: 'no-store' });
      return { status: response.status, body: await response.json().catch(() => ({})) };
    })()`);
    const lobby = await evaluate(cdp, `(async () => {
      const response = await fetch('/api/pvp', { credentials: 'include', cache: 'no-store' });
      return { status: response.status, body: await response.json().catch(() => ({})) };
    })()`);

    const post = [...cdp.events].reverse().find((event) => {
      if (event.method !== "Network.requestWillBeSent" || event.params?.request?.method !== "POST") return false;
      try { return new URL(event.params.request.url).pathname === "/api/pvp"; } catch { return false; }
    });
    const responseEvent = post && [...cdp.events].reverse().find((event) => event.method === "Network.responseReceived" && event.params?.requestId === post.params.requestId);
    let responseBody = null;
    if (responseEvent) responseBody = await cdp.call("Network.getResponseBody", { requestId: post.params.requestId }).then((value) => value.body).catch((error) => `<<${error.message}>>`);
    const network = post ? {
      request: { url: post.params.request.url, postData: post.params.request.postData || null },
      response: responseEvent ? { status: responseEvent.params.response.status, statusText: responseEvent.params.response.statusText } : null,
      responseBody,
    } : null;
    const exceptions = cdp.events.filter((event) => event.method === "Runtime.exceptionThrown").map((event) => event.params?.exceptionDetails?.exception?.description || event.params?.exceptionDetails?.text).filter(Boolean);
    const diagnostic = { ui, session, lobby, network, exceptions };
    console.log(`PVP LOBBY PREFLIGHT DIAGNOSTIC ${JSON.stringify(diagnostic)}`);

    const authoritativeCode = lobby.body?.myRoom?.code;
    const visibleRoom = typeof ui.roomCode === "string" && ui.roomCode === authoritativeCode;
    const authoritativeRoom = lobby.status === 200 && lobby.body?.myRoom?.state === "waiting" && /^[A-Z2-9]{6}$/.test(String(authoritativeCode || ""));
    assert.equal(visibleRoom, true, `create-room UI did not render the authoritative room code: ${JSON.stringify(diagnostic)}`);
    assert.equal(authoritativeRoom, true, `server did not retain the waiting room: ${JSON.stringify(diagnostic)}`);
    assert.equal(network?.response?.status, 200, `browser POST /api/pvp did not return 200: ${JSON.stringify(diagnostic)}`);
    assert.equal(exceptions.length, 0, `browser runtime exceptions detected: ${JSON.stringify(diagnostic)}`);
    console.log(`PVP LOBBY PREFLIGHT: PASS — ${authoritativeCode}`);
  } finally {
    try { cdp?.close(); } catch {}
    if (chrome.exitCode == null && chrome.signalCode == null) chrome.kill("SIGTERM");
    await sleep(500);
    if (chrome.exitCode == null && chrome.signalCode == null) chrome.kill("SIGKILL");
    await rm(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }).catch(() => {});
    if (process.env.ALPHA_VISUAL_DEBUG === "1" && stderr) console.error(stderr);
  }
}

void main().catch((error) => {
  console.error("PVP LOBBY PREFLIGHT: FAIL", error);
  process.exitCode = 1;
});
