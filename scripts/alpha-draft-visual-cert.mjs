import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { CHROME_REMOTE_DEBUGGING_FLAG, waitForChromeDevToolsPort } from "./chrome-devtools-bootstrap.mjs";

const baseUrl = (process.env.E2E_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const outputDir = resolve(process.env.ALPHA_VISUAL_DIR || "artifacts/alpha-visual");
const viewport = { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false };

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
    let finished = false;
    const finish = (exited) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      child.removeListener("exit", onExit);
      resolvePromise(exited);
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
  await rm(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => null);
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
    socket.addEventListener("close", () => {
      for (const pending of this.pending.values()) pending.reject(new Error("Chrome DevTools connection closed"));
      this.pending.clear();
    });
  }

  static async connect(url) {
    assert.equal(typeof WebSocket, "function", "Node 22 WebSocket global is required for dependency-free CDP capture");
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
    } catch (error) {
      last = error;
    }
    await sleep(125);
  }
  throw new Error(`Timed out waiting for ${label}${last instanceof Error ? `: ${last.message}` : ""}`);
}

async function settle(cdp) {
  await evaluate(cdp, `Promise.all([document.fonts?.ready || Promise.resolve(), Promise.all([...document.images].map((image) => image.complete ? Promise.resolve() : new Promise((resolveImage) => { image.addEventListener('load', resolveImage, { once:true }); image.addEventListener('error', resolveImage, { once:true }); setTimeout(resolveImage, 3000); })))])`);
  await sleep(300);
}

async function navigate(cdp, path) {
  const target = `${baseUrl}${path}`;
  await cdp.call("Page.navigate", { url: target });
  await waitUntil(() => evaluate(cdp, `location.href === ${JSON.stringify(target)} && ['interactive','complete'].includes(document.readyState)`), `navigation to ${target}`);
  await settle(cdp);
}

async function bootstrapPlayerSession(cdp) {
  const displayName = `Draft Visual ${Date.now().toString(36)}`;
  return evaluate(cdp, `(async () => {
    const read = async (response) => ({ status: response.status, body: await response.json().catch(() => ({})) });
    const current = await fetch('/api/player', { cache: 'no-store' });
    if (current.ok) return read(current);
    let created = await fetch('/api/player', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ displayName: ${JSON.stringify(displayName)} }),
    });
    if (created.status === 409) {
      created = await fetch('/api/player', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
    }
    return read(created);
  })()`);
}

async function draftSnapshot(cdp) {
  return evaluate(cdp, `(async () => {
    const response = await fetch('/api/draft', { cache: 'no-store' });
    return { status: response.status, body: await response.json().catch(() => ({})) };
  })()`);
}

async function chooseFirstCard(cdp, cardId) {
  return evaluate(cdp, `(async () => {
    const response = await fetch('/api/draft', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cardId: ${JSON.stringify(cardId)} }),
    });
    return { status: response.status, body: await response.json().catch(() => ({})) };
  })()`);
}

async function draftEvidence(cdp) {
  return evaluate(cdp, `(() => {
    const q = (selector) => Boolean(document.querySelector(selector));
    const choices = [...document.querySelectorAll('[aria-labelledby="draft-pick-heading"] button[aria-label^="Escolher "]')];
    const progress = document.querySelector('[aria-label="Progresso do Draft"]');
    const deck = document.querySelector('[aria-labelledby="draft-deck-heading"]');
    return {
      href: location.href,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      bodyText: document.body?.innerText || '',
      status: q('[aria-label="Estado do Draft"]'),
      pick: q('[aria-labelledby="draft-pick-heading"]'),
      regions: q('[aria-label="Regiões da identidade atual"]'),
      progress: Boolean(progress),
      deck: Boolean(deck),
      complete: q('[aria-labelledby="draft-complete-heading"]'),
      choiceCount: choices.length,
      choiceLabels: choices.map((element) => element.getAttribute('aria-label') || ''),
      progressNow: progress?.getAttribute('aria-valuenow') || null,
      deckText: deck?.textContent?.replace(/\\s+/g, ' ').trim() || '',
    };
  })()`);
}

async function capture(cdp, filename) {
  await settle(cdp);
  const screenshot = await cdp.call("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  await writeFile(join(outputDir, filename), Buffer.from(screenshot.data, "base64"));
}

async function writeDiagnostic(cdp, error) {
  let evidence = null;
  let snapshot = null;
  try { evidence = await draftEvidence(cdp); } catch {}
  try { snapshot = await draftSnapshot(cdp); } catch {}
  try { await capture(cdp, "31-draft-diagnostic.png"); } catch {}
  const report = {
    ok: false,
    gitSha: process.env.GITHUB_SHA || null,
    capturedAt: new Date().toISOString(),
    viewport,
    error: error instanceof Error ? error.message : String(error),
    evidence: evidence ? { ...evidence, bodyText: evidence.bodyText.slice(0, 1200) } : null,
    snapshot: snapshot ? {
      status: snapshot.status,
      ok: snapshot.body?.ok,
      step: snapshot.body?.step,
      total: snapshot.body?.total,
      regions: snapshot.body?.regions,
      poolCount: Array.isArray(snapshot.body?.pool) ? snapshot.body.pool.length : null,
    } : null,
    screenshots: ["31-draft-diagnostic.png"],
  };
  await writeFile(join(outputDir, "draft-visual-manifest.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.error("ALPHA DRAFT VISUAL CERT DIAGNOSTIC", JSON.stringify(report));
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const profileDir = await mkdtemp(join(tmpdir(), "runeforge-draft-visual-"));
  const chromePath = findChrome();
  const chrome = spawn(chromePath, [
    "--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars", "--mute-audio",
    CHROME_REMOTE_DEBUGGING_FLAG, `--user-data-dir=${profileDir}`, `--window-size=${viewport.width},${viewport.height}`, "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  let browserStderr = "";
  chrome.stderr.on("data", (chunk) => { browserStderr += String(chunk); });

  let cdp;
  try {
    const port = await waitForChromeDevToolsPort({ profileDir, chrome, getStderr: () => browserStderr });
    const websocketUrl = await waitForChrome(port);
    cdp = await CdpClient.connect(websocketUrl);
    await cdp.call("Page.enable");
    await cdp.call("Runtime.enable");
    await cdp.call("Emulation.setDeviceMetricsOverride", viewport);

    try {
      await navigate(cdp, "/api/health");
      const session = await bootstrapPlayerSession(cdp);
      assert.ok([200, 201].includes(session.status), `Draft visual session bootstrap failed: ${JSON.stringify(session)}`);
      assert.equal(session.body?.ok, true, `Draft visual session bootstrap returned invalid payload: ${JSON.stringify(session)}`);

      const initial = await draftSnapshot(cdp);
      assert.equal(initial.status, 200, `GET /api/draft must initialize a readable Draft session: ${JSON.stringify(initial.body)}`);
      assert.equal(initial.body?.ok, true, `GET /api/draft returned invalid snapshot: ${JSON.stringify(initial.body)}`);
      assert.equal(initial.body?.step, 0, "Fresh Draft visual session must begin at step 0");
      assert.ok(Array.isArray(initial.body?.pool) && initial.body.pool.length === 3, "Fresh Draft visual session must expose exactly three authoritative choices");

      await navigate(cdp, "/draft");
      await waitUntil(() => evaluate(cdp, `Boolean(document.querySelector('[aria-labelledby="draft-pick-heading"]'))`), "Draft pick chamber");
      await evaluate(cdp, "window.scrollTo(0, 0)");
      const top = await draftEvidence(cdp);
      assert.ok(top.href.endsWith("/draft"), `expected /draft, got ${top.href}`);
      assert.ok(top.scrollWidth <= top.innerWidth + 2, `Draft has horizontal overflow: ${top.scrollWidth}px > ${top.innerWidth}px`);
      assert.match(top.bodyText, /Arena Draft/);
      assert.match(top.bodyText, /Escolha 1 de/);
      assert.ok(top.status && top.pick && top.progress && top.deck, `Draft semantic surface incomplete: ${JSON.stringify(top)}`);
      assert.equal(top.choiceCount, 3, "Draft pick chamber must render the three server-provided choices");
      await capture(cdp, "31-draft-pick-chamber.png");

      const firstCardId = String(initial.body.pool[0]?.defId || "");
      assert.ok(firstCardId, "Draft visual certificate requires a concrete first pool card id");
      const picked = await chooseFirstCard(cdp, firstCardId);
      assert.equal(picked.status, 200, `Draft authoritative first pick failed: ${JSON.stringify(picked.body)}`);
      assert.equal(picked.body?.ok, true, `Draft first pick returned invalid payload: ${JSON.stringify(picked.body)}`);
      assert.equal(picked.body?.step, 1, "Draft first authoritative pick must advance exactly one step");
      assert.ok(Array.isArray(picked.body?.deck) && picked.body.deck.length === 1, "Draft first pick must create a one-card authoritative deck");

      await navigate(cdp, "/draft");
      await waitUntil(() => evaluate(cdp, `document.querySelector('[aria-labelledby="draft-deck-heading"]')?.textContent?.includes('1/') === true`), "Draft forge tray after first pick");
      await evaluate(cdp, `document.querySelector('[aria-labelledby="draft-deck-heading"]')?.scrollIntoView({ block:'center' })`);
      await sleep(250);
      const tray = await draftEvidence(cdp);
      assert.ok(tray.scrollWidth <= tray.innerWidth + 2, "Draft forge tray view must not overflow horizontally");
      assert.ok(tray.deck && tray.pick && tray.progress, "Draft forge tray must keep pick/progress surfaces mounted");
      assert.equal(tray.choiceCount, 3, "Draft next pick must still render exactly three authoritative choices");
      assert.match(tray.deckText, /1\//, "Draft forge tray must show one confirmed card after first pick");
      await capture(cdp, "32-draft-forge-tray.png");

      const report = {
        ok: true,
        gitSha: process.env.GITHUB_SHA || null,
        capturedAt: new Date().toISOString(),
        viewport,
        authority: {
          initialStep: initial.body.step,
          total: initial.body.total,
          initialPoolCount: initial.body.pool.length,
          pickedStep: picked.body.step,
          pickedDeckCount: picked.body.deck.length,
          pickedRegions: picked.body.regions,
        },
        screenshots: ["31-draft-pick-chamber.png", "32-draft-forge-tray.png"],
        top: { ...top, bodyText: top.bodyText.slice(0, 600) },
        tray: { ...tray, bodyText: tray.bodyText.slice(0, 600) },
      };
      await writeFile(join(outputDir, "draft-visual-manifest.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
      console.log("ALPHA DRAFT VISUAL CERT: PASS — authoritative three-choice chamber + first-pick forge tray screenshots captured");
    } catch (error) {
      await writeDiagnostic(cdp, error);
      throw error;
    }
  } finally {
    try { cdp?.close(); } catch {}
    await shutdownChrome(chrome, profileDir);
  }
}

void main().catch((error) => {
  console.error("ALPHA DRAFT VISUAL CERT: FAIL", error);
  process.exitCode = 1;
});
