import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { CHROME_REMOTE_DEBUGGING_FLAG, waitForChromeDevToolsPort } from "./chrome-devtools-bootstrap.mjs";

const baseUrl = (process.env.E2E_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const outputDir = resolve(process.env.ALPHA_VISUAL_DIR || "artifacts/alpha-visual");
const launchViewport = { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false };
const notebookMatrix = [
  { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false, label: "1280x720" },
  { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false, label: "1366x768" },
  { width: 1536, height: 864, deviceScaleFactor: 1, mobile: false, label: "1536x864" },
];

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function findChrome() {
  const candidates = [
    process.env.CHROME_BIN,
    "google-chrome",
    "google-chrome-stable",
    "chromium",
    "chromium-browser",
  ].filter(Boolean);
  for (const candidate of candidates) {
    const result = spawnSync("which", [candidate], { encoding: "utf8" });
    if (result.status === 0 && result.stdout.trim()) return result.stdout.trim();
  }
  throw new Error(`Chrome/Chromium not found. Tried: ${candidates.join(", ")}`);
}

async function waitForChrome(port, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (response.ok) {
        const targets = await response.json();
        const page = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl);
        if (page) return page.webSocketDebuggerUrl;
      }
    } catch (error) {
      lastError = error;
    }
    await sleep(100);
  }
  throw new Error(`Chrome remote debugging endpoint did not become ready${lastError ? `: ${lastError}` : ""}`);
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
  await rm(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
}

class CdpClient {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.notifications = [];
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(`${pending.method}: ${message.error.message}`));
        else pending.resolve(message.result || {});
        return;
      }
      this.notifications.push(message);
    });
    socket.addEventListener("close", () => {
      for (const pending of this.pending.values()) pending.reject(new Error("Chrome DevTools connection closed"));
      this.pending.clear();
    });
  }

  static async connect(url) {
    assert.equal(typeof WebSocket, "function", "Node 22 WebSocket global is required for notebook certification");
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
  const result = await cdp.call("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || "Runtime evaluation failed");
  }
  return result.result?.value;
}

async function waitUntil(check, label, timeoutMs = 20_000) {
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

async function waitForText(cdp, text, timeoutMs = 20_000) {
  const encoded = JSON.stringify(text);
  return waitUntil(
    () => evaluate(cdp, `document.body?.innerText?.includes(${encoded}) === true`),
    `text ${encoded}`,
    timeoutMs,
  );
}

async function waitForSelector(cdp, selector, timeoutMs = 20_000) {
  const encoded = JSON.stringify(selector);
  return waitUntil(
    () => evaluate(cdp, `Boolean(document.querySelector(${encoded}))`),
    `selector ${encoded}`,
    timeoutMs,
  );
}

async function clickText(cdp, text) {
  const encoded = JSON.stringify(text);
  const clicked = await evaluate(cdp, `(() => {
    const target = [...document.querySelectorAll('button,a,[role="button"]')]
      .find((element) => !element.disabled && (element.textContent || '').replace(/\\s+/g, ' ').trim().includes(${encoded}));
    if (!target) return false;
    target.scrollIntoView({ block: 'nearest', inline: 'center' });
    target.click();
    return true;
  })()`);
  assert.equal(clicked, true, `Could not click control containing text: ${text}`);
}

async function settle(cdp) {
  await evaluate(cdp, `Promise.all([
    document.fonts?.ready || Promise.resolve(),
    Promise.all([...document.images].map((image) => image.complete ? Promise.resolve() : new Promise((resolveImage) => {
      image.addEventListener('load', resolveImage, { once: true });
      image.addEventListener('error', resolveImage, { once: true });
      setTimeout(resolveImage, 3000);
    })))
  ])`);
  await sleep(250);
}

async function navigate(cdp, path) {
  const target = `${baseUrl}${path}`;
  await cdp.call("Page.navigate", { url: target });
  await waitUntil(
    () => evaluate(cdp, `location.href === ${JSON.stringify(target)} && ['interactive','complete'].includes(document.readyState)`),
    `navigation to ${target}`,
  );
  await settle(cdp);
}

async function prepareBattlefield(cdp) {
  await navigate(cdp, "/play");
  await waitUntil(
    () => evaluate(cdp, `(() => {
      const text = document.body?.innerText || '';
      return text.includes('SALVE SUA CHAVE DE RECUPERAÇÃO') || text.includes('PRIMEIRO ACESSO · ALPHA JOGÁVEL') || text.includes('Escolha seu deck');
    })()`),
    "play bootstrap surface",
    30_000,
  );

  const hasRecovery = await evaluate(cdp, "(document.body?.innerText || '').includes('SALVE SUA CHAVE DE RECUPERAÇÃO')");
  if (hasRecovery) {
    await clickText(cdp, "JÁ GUARDEI");
    await waitUntil(
      () => evaluate(cdp, "!(document.body?.innerText || '').includes('SALVE SUA CHAVE DE RECUPERAÇÃO')"),
      "recovery key handoff to close",
    );
  }

  const hasOnboarding = await evaluate(cdp, "(document.body?.innerText || '').includes('PRIMEIRO ACESSO · ALPHA JOGÁVEL')");
  if (hasOnboarding) {
    await clickText(cdp, "COMEÇAR TREINAMENTO");
  }

  await waitForText(cdp, "Escolha seu deck", 30_000);
  await clickText(cdp, "ENTRAR NO NEXUS");
  await waitForText(cdp, "Prepare sua mão inicial", 30_000);
  await clickText(cdp, "Manter mão inicial");
  await waitForSelector(cdp, ".tcg-arena", 30_000);
  await waitForText(cdp, "ARENA DO NEXUS", 30_000);

  const hasGuide = await evaluate(cdp, "Boolean(document.querySelector('.match-guide-backdrop'))");
  if (hasGuide) {
    await clickText(cdp, "Pular guia");
    await waitUntil(() => evaluate(cdp, "!document.querySelector('.match-guide-backdrop')"), "first match guide to close");
  }
  await settle(cdp);
}

async function measureBattlefield(cdp) {
  return evaluate(cdp, `(() => {
    const rectOf = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        width: rect.width,
        height: rect.height,
      };
    };
    const shell = document.querySelector('.tcg-arena > .mx-auto');
    return {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      bodyScrollHeight: document.body?.scrollHeight || 0,
      arena: rectOf('.tcg-arena'),
      shell: shell ? rectOf('.tcg-arena > .mx-auto') : null,
      rivalField: rectOf('.tcg-row[data-bench-side="ai"]'),
      playerField: rectOf('.tcg-row[data-bench-side="player"]'),
      hand: rectOf('.player-hand-shell'),
      actions: rectOf('.tcg-actions'),
      opponentPlate: rectOf('.tcg-playerbar[data-player-side="ai"], .tcg-playerbar:first-of-type'),
      playerPlate: rectOf('.tcg-playerbar[data-player-side="player"], .tcg-playerbar:last-of-type'),
      center: rectOf('.tcg-row[data-bench-side="ai"] + .relative.flex-1'),
    };
  })()`);
}

function assertFit(evidence, expected) {
  assert.equal(evidence.innerWidth, expected.width, `${expected.label} certification width mismatch`);
  assert.equal(evidence.innerHeight, expected.height, `${expected.label} certification height mismatch`);
  assert.ok(
    evidence.scrollWidth <= evidence.innerWidth + 2,
    `${expected.label} battlefield has horizontal page overflow: ${evidence.scrollWidth}px > ${evidence.innerWidth}px`,
  );
  assert.ok(
    evidence.scrollHeight <= evidence.innerHeight + 2,
    `${expected.label} battlefield requires vertical page scrolling: ${evidence.scrollHeight}px > ${evidence.innerHeight}px`,
  );

  for (const [label, rect] of Object.entries({
    arena: evidence.arena,
    rivalField: evidence.rivalField,
    playerField: evidence.playerField,
    hand: evidence.hand,
    actions: evidence.actions,
  })) {
    assert.ok(rect, `${expected.label} battlefield is missing ${label}`);
    assert.ok(rect.top >= -1, `${expected.label} battlefield clips ${label} above viewport: top=${rect.top}`);
    assert.ok(
      rect.bottom <= evidence.innerHeight + 1,
      `${expected.label} battlefield clips ${label} below viewport: bottom=${rect.bottom}, viewport=${evidence.innerHeight}`,
    );
  }

  assert.ok(evidence.rivalField.height >= 92, `${expected.label} rival field became too short to read: ${evidence.rivalField.height}px`);
  assert.ok(evidence.playerField.height >= 92, `${expected.label} player field became too short to read: ${evidence.playerField.height}px`);
  assert.ok(evidence.hand.height >= 112, `${expected.label} hand became too short to read: ${evidence.hand.height}px`);
  assert.ok(evidence.actions.height >= 32, `${expected.label} action rail became too short to use: ${evidence.actions.height}px`);
}

async function capture(cdp, filename) {
  const screenshot = await cdp.call("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  await writeFile(join(outputDir, filename), Buffer.from(screenshot.data, "base64"));
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const profileDir = await mkdtemp(join(tmpdir(), "runeforge-notebook-matrix-"));
  const chromePath = findChrome();
  const chrome = spawn(chromePath, [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--hide-scrollbars",
    "--mute-audio",
    CHROME_REMOTE_DEBUGGING_FLAG,
    `--user-data-dir=${profileDir}`,
    `--window-size=${launchViewport.width},${launchViewport.height}`,
    "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });

  let stderr = "";
  chrome.stderr.on("data", (chunk) => { stderr += String(chunk); });
  let cdp;
  try {
    const port = await waitForChromeDevToolsPort({ profileDir, chrome, getStderr: () => stderr });
    const websocketUrl = await waitForChrome(port);
    cdp = await CdpClient.connect(websocketUrl);
    await cdp.call("Page.enable");
    await cdp.call("Runtime.enable");
    await cdp.call("Log.enable");
    await cdp.call("Emulation.setDeviceMetricsOverride", launchViewport);

    await prepareBattlefield(cdp);

    const results = [];
    for (const target of notebookMatrix) {
      await cdp.call("Emulation.setDeviceMetricsOverride", target);
      await settle(cdp);
      await evaluate(cdp, "window.scrollTo(0, 0)");
      const evidence = await measureBattlefield(cdp);
      assertFit(evidence, target);
      const filename = `05n-battlefield-notebook-${target.label}.png`;
      await capture(cdp, filename);
      results.push({ viewport: target.label, screenshot: filename, ...evidence });
      console.log(`NOTEBOOK BATTLEFIELD CERT: ${target.label} PASS — ${JSON.stringify(evidence)}`);
    }

    const runtimeExceptions = cdp.notifications.filter((message) => message.method === "Runtime.exceptionThrown");
    assert.equal(runtimeExceptions.length, 0, `notebook certification browser runtime exceptions: ${JSON.stringify(runtimeExceptions.slice(0, 3))}`);

    const report = {
      ok: true,
      gitSha: process.env.GITHUB_SHA || null,
      baseUrl,
      capturedAt: new Date().toISOString(),
      matrix: results,
    };
    await writeFile(join(outputDir, "notebook-battlefield-matrix.json"), `${JSON.stringify(report, null, 2)}\n`);
    console.log(`NOTEBOOK BATTLEFIELD MATRIX: PASS — ${results.map((entry) => entry.viewport).join(", ")}`);
  } finally {
    try { cdp?.close(); } catch {}
    await shutdownChrome(chrome, profileDir);
    if (process.env.ALPHA_VISUAL_DEBUG === "1" && stderr) console.error(`[Notebook Chrome]\n${stderr}`);
  }
}

void main().catch((error) => {
  console.error("NOTEBOOK BATTLEFIELD MATRIX: FAIL", error);
  process.exitCode = 1;
});
