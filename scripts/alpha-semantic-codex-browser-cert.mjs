import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { CHROME_REMOTE_DEBUGGING_FLAG, waitForChromeDevToolsPort } from "./chrome-devtools-bootstrap.mjs";

const baseUrl = (process.env.E2E_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const outputDir = resolve(process.env.ALPHA_VISUAL_DIR || "artifacts/alpha-visual");
const viewport = { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false };

const probes = [
  {
    defId: "rfalpha_ember_structure_forge_bastion",
    query: "Bastião da Forja Rubra",
    label: "Estrutura",
    screenshot: "10b-codex-structure.png",
  },
  {
    defId: "rfalpha_tide_ritual_memory_tide",
    query: "Liturgia da Maré da Memória",
    label: "Ritual",
    screenshot: "10c-codex-mana-ritual-tooltip.png",
    tooltip: true,
  },
  {
    defId: "rfalpha_tide_trap_countercurrent",
    query: "Selo da Contramaré",
    label: "Armadilha",
    screenshot: "10d-codex-trap.png",
  },
];

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

async function waitUntil(check, label, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await sleep(125);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function settle(cdp) {
  await evaluate(cdp, `Promise.all([document.fonts?.ready || Promise.resolve(), Promise.all([...document.images].map((image) => image.complete ? Promise.resolve() : new Promise((resolveImage) => { image.addEventListener('load', resolveImage, { once: true }); image.addEventListener('error', resolveImage, { once: true }); setTimeout(resolveImage, 3000); })))])`);
  await sleep(250);
}

async function navigate(cdp, path) {
  const target = `${baseUrl}${path}`;
  await cdp.call("Page.navigate", { url: target });
  await waitUntil(() => evaluate(cdp, `location.href === ${JSON.stringify(target)} && document.readyState !== 'loading'`), `navigation to ${target}`);
  await settle(cdp);
}

async function setSearch(cdp, value) {
  const encoded = JSON.stringify(value);
  const changed = await evaluate(cdp, `(() => {
    const input = [...document.querySelectorAll('input')].find((element) => (element.placeholder || '').includes('Nome, habilidade'));
    if (!input) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter.call(input, ${encoded});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  assert.equal(changed, true, "Codex search input not found");
}

async function selectCard(cdp, defId) {
  const selector = `[data-card-tip-def-id=${JSON.stringify(defId)}]`;
  await waitUntil(() => evaluate(cdp, `Boolean(document.querySelector(${JSON.stringify(selector)}))`), `Codex card ${defId}`);
  const clicked = await evaluate(cdp, `(() => {
    const host = document.querySelector(${JSON.stringify(selector)});
    if (!host) return false;
    host.scrollIntoView({ block: 'center', inline: 'center' });
    const clickable = host.matches('button,[role="button"]') ? host : host.querySelector('button,[role="button"]');
    (clickable || host).click();
    return true;
  })()`);
  assert.equal(clicked, true, `Could not select ${defId}`);
  await sleep(250);
  return selector;
}

async function hover(cdp, selector) {
  // Approach the card from a neutral point first. This produces the same
  // mouse-enter/mouse-move sequence as a real player and prevents the prior
  // probe's hover-close timer from racing the next Codex card.
  await cdp.call("Input.dispatchMouseEvent", { type: "mouseMoved", x: 2, y: 2 });
  await sleep(160);

  const scrolled = await evaluate(cdp, `(() => {
    const target = document.querySelector(${JSON.stringify(selector)});
    if (!target) return false;
    target.scrollIntoView({ block: 'center', inline: 'center' });
    return true;
  })()`);
  assert.equal(scrolled, true, `Could not locate hover target ${selector}`);
  await sleep(120);

  const point = await evaluate(cdp, `(() => {
    const target = document.querySelector(${JSON.stringify(selector)});
    if (!target) return null;
    const rect = target.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const candidates = [
      [0.50, 0.50], [0.35, 0.50], [0.65, 0.50],
      [0.50, 0.35], [0.50, 0.65], [0.35, 0.35], [0.65, 0.65],
    ];
    for (const [rx, ry] of candidates) {
      const x = rect.left + rect.width * rx;
      const y = rect.top + rect.height * ry;
      const hit = document.elementFromPoint(x, y);
      if (hit && (hit === target || target.contains(hit))) {
        return { x, y, defId: target.getAttribute('data-card-tip-def-id') };
      }
    }
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const hit = document.elementFromPoint(centerX, centerY);
    return {
      blocked: true,
      x: centerX,
      y: centerY,
      defId: target.getAttribute('data-card-tip-def-id'),
      hitTag: hit?.tagName || null,
      hitDefId: hit?.closest?.('[data-card-tip-def-id]')?.getAttribute('data-card-tip-def-id') || null,
    };
  })()`);
  assert.ok(point, `Could not hover ${selector}`);
  assert.notEqual(point.blocked, true, `Hover target ${point.defId || selector} is obscured (hit ${point.hitTag || 'unknown'} / ${point.hitDefId || 'no-card'})`);

  // Two nearby physical moves make React receive an actual mouse-move after
  // the post-scroll layout has settled, while still exercising the real UI.
  await cdp.call("Input.dispatchMouseEvent", { type: "mouseMoved", x: Math.max(1, point.x - 2), y: point.y });
  await sleep(40);
  await cdp.call("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y });
  await sleep(80);
}

async function capture(cdp, filename) {
  await settle(cdp);
  const metrics = await evaluate(cdp, `({ innerWidth: window.innerWidth, scrollWidth: document.documentElement.scrollWidth })`);
  assert.ok(metrics.scrollWidth <= metrics.innerWidth + 2, `${filename} has horizontal overflow`);
  const screenshot = await cdp.call("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  await writeFile(join(outputDir, filename), Buffer.from(screenshot.data, "base64"));
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const profileDir = await mkdtemp(join(tmpdir(), "runeforge-semantic-codex-"));
  let port = 0;
  const chrome = spawn(findChrome(), [
    "--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars", "--mute-audio",
    CHROME_REMOTE_DEBUGGING_FLAG, `--user-data-dir=${profileDir}`, `--window-size=${viewport.width},${viewport.height}`, "about:blank",
  ], { stdio: "ignore" });

  let cdp;
  try {
    port = await waitForChromeDevToolsPort({ profileDir: profileDir, chrome });
    cdp = await CdpClient.connect(await waitForChrome(port));
    await cdp.call("Page.enable");
    await cdp.call("Runtime.enable");
    await cdp.call("Emulation.setDeviceMetricsOverride", viewport);
    await navigate(cdp, "/codex");

    for (const probe of probes) {
      await setSearch(cdp, probe.query);
      const selector = await selectCard(cdp, probe.defId);
      const pageText = await evaluate(cdp, "document.body?.innerText || ''");
      assert.match(pageText, new RegExp(probe.label, "i"), `${probe.defId} must expose semantic label ${probe.label}`);
      assert.match(pageText, new RegExp(probe.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "i"), `${probe.defId} name must be visible`);

      if (probe.tooltip) {
        await hover(cdp, selector);
        await waitUntil(() => evaluate(cdp, `Boolean(document.querySelector('[data-card-intelligence-panel="true"]'))`), "Ritual intelligence tooltip");
        const tooltipText = await evaluate(cdp, `document.querySelector('[data-card-intelligence-panel="true"]')?.textContent || ''`);
        assert.match(tooltipText, /Ritual/i, "Ritual tooltip must expose its semantic identity");
        assert.match(tooltipText, /mana/i, "Ritual tooltip must expose its mana identity");
      }

      await capture(cdp, probe.screenshot);
      await cdp.call("Input.dispatchMouseEvent", { type: "mouseMoved", x: 2, y: 2 });
    }

    console.log("SEMANTIC CODEX BROWSER CERT: PASS — Structure, Mana Ritual tooltip and Trap captured");
  } finally {
    try { cdp?.close(); } catch {}
    if (chrome.exitCode == null && chrome.signalCode == null) chrome.kill("SIGTERM");
    await sleep(300);
    if (chrome.exitCode == null && chrome.signalCode == null) chrome.kill("SIGKILL");
    await rm(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }).catch(() => {});
  }
}

void main().catch((error) => {
  console.error("SEMANTIC CODEX BROWSER CERT: FAIL", error);
  process.exitCode = 1;
});