import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import net from "node:net";

const baseUrl = (process.env.E2E_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const outputDir = resolve(process.env.ALPHA_VISUAL_DIR || "artifacts/alpha-visual");
const viewport = { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false };
const defId = "ember_champion";
const cardName = "Pyra, the Everflame";
const artPath = "/art/cards/flagship/emberhold/ember_champion.webp";

function sleep(ms) { return new Promise((resolvePromise) => setTimeout(resolvePromise, ms)); }

async function freePort() {
  return new Promise((resolvePromise, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : null;
      server.close(() => port ? resolvePromise(port) : reject(new Error("Could not allocate Chrome debugging port")));
    });
  });
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

  close() { this.socket.close(); }
}

async function evaluate(cdp, expression) {
  const result = await cdp.call("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || "Runtime evaluation failed");
  return result.result?.value;
}

async function waitUntil(check, label, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await sleep(125);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function settle(cdp) {
  await evaluate(cdp, `Promise.all([document.fonts?.ready || Promise.resolve(), Promise.all([...document.images].map((image) => image.complete ? Promise.resolve() : new Promise((resolveImage) => { image.addEventListener('load', resolveImage, { once: true }); image.addEventListener('error', resolveImage, { once: true }); setTimeout(resolveImage, 3000); })))])`);
  await sleep(300);
}

async function navigate(cdp, path) {
  const target = `${baseUrl}${path}`;
  await cdp.call("Page.navigate", { url: target });
  await waitUntil(() => evaluate(cdp, `location.href === ${JSON.stringify(target)} && document.readyState !== 'loading'`), `navigation to ${target}`);
  await settle(cdp);
}

async function setSearch(cdp, placeholderFragment, value) {
  const changed = await evaluate(cdp, `(() => {
    const input = [...document.querySelectorAll('input')].find((element) => (element.placeholder || '').includes(${JSON.stringify(placeholderFragment)}));
    if (!input) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  assert.equal(changed, true, `Search input containing ${placeholderFragment} not found`);
}

async function hoverCard(cdp) {
  const selector = `[data-card-tip-def-id=${JSON.stringify(defId)}]`;
  await waitUntil(() => evaluate(cdp, `Boolean(document.querySelector(${JSON.stringify(selector)}))`), `${defId} card`);
  const point = await evaluate(cdp, `(() => {
    const target = document.querySelector(${JSON.stringify(selector)});
    if (!target) return null;
    target.scrollIntoView({ block: 'center', inline: 'center' });
    const rect = target.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`);
  assert.ok(point, `Could not locate ${defId}`);
  await cdp.call("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y });
  await waitUntil(() => evaluate(cdp, `Boolean(document.querySelector('[data-tooltip-panel="true"]'))`), "card intelligence tooltip");
  await waitUntil(() => evaluate(cdp, `Boolean(document.querySelector('[data-card-art-viewer-trigger="${defId}"]'))`), "VER ARTE trigger");
}

async function openViewer(cdp) {
  const clicked = await evaluate(cdp, `(() => {
    const trigger = document.querySelector('[data-card-art-viewer-trigger="${defId}"]');
    if (!trigger) return false;
    trigger.click();
    return true;
  })()`);
  assert.equal(clicked, true, "VER ARTE button could not be clicked");
  await waitUntil(() => evaluate(cdp, `Boolean(document.querySelector('[data-card-art-viewer="${defId}"]'))`), "full-art dialog");
  const state = await evaluate(cdp, `(() => {
    const dialog = document.querySelector('[data-card-art-viewer="${defId}"]');
    const image = document.querySelector('[data-card-art-viewer-image="${defId}"]');
    return {
      role: dialog?.getAttribute('role') || '',
      modal: dialog?.getAttribute('aria-modal') || '',
      label: dialog?.getAttribute('aria-label') || '',
      background: image ? getComputedStyle(image).backgroundImage : '',
      overflow: document.body.style.overflow,
    };
  })()`);
  assert.equal(state.role, "dialog", "full-art viewer must expose dialog semantics");
  assert.equal(state.modal, "true", "full-art viewer must be modal");
  assert.match(state.label, /Pyra/i, "full-art viewer must identify the card");
  assert.ok(state.background.includes(artPath), `full-art viewer must render ${artPath}`);
  assert.equal(state.overflow, "hidden", "full-art viewer must lock background scrolling");
}

async function closeViewer(cdp) {
  await evaluate(cdp, `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`);
  await waitUntil(() => evaluate(cdp, `!document.querySelector('[data-card-art-viewer="${defId}"]')`), "full-art dialog to close");
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
  const artResponse = await fetch(`${baseUrl}${artPath}`);
  assert.equal(artResponse.ok, true, `${artPath} must be served by the built app`);
  assert.match(artResponse.headers.get("content-type") || "", /^image\/webp/i, `${artPath} must remain WebP`);

  const profileDir = await mkdtemp(join(tmpdir(), "runeforge-card-art-viewer-"));
  const port = await freePort();
  const chrome = spawn(findChrome(), [
    "--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars", "--mute-audio",
    `--remote-debugging-port=${port}`, `--user-data-dir=${profileDir}`, `--window-size=${viewport.width},${viewport.height}`, "about:blank",
  ], { stdio: "ignore" });

  let cdp;
  try {
    cdp = await CdpClient.connect(await waitForChrome(port));
    await cdp.call("Page.enable");
    await cdp.call("Runtime.enable");
    await cdp.call("Emulation.setDeviceMetricsOverride", viewport);

    await navigate(cdp, "/codex");
    await setSearch(cdp, "Nome, habilidade", cardName);
    await hoverCard(cdp);
    await openViewer(cdp);
    await capture(cdp, "10k-codex-art-viewer.png");
    await closeViewer(cdp);

    await navigate(cdp, "/collection");
    await waitUntil(() => evaluate(cdp, `Boolean([...document.querySelectorAll('input')].find((element) => (element.placeholder || '').includes('Buscar nome')))`) , "Collection search input");
    await setSearch(cdp, "Buscar nome", cardName);
    await hoverCard(cdp);
    await openViewer(cdp);
    await capture(cdp, "10l-collection-art-viewer.png");
    await closeViewer(cdp);

    console.log("CARD ART VIEWER BROWSER CERT: PASS — Codex + Collection expose full Pyra art with accessible lightbox");
  } finally {
    try { cdp?.close(); } catch {}
    if (chrome.exitCode == null && chrome.signalCode == null) chrome.kill("SIGTERM");
    await sleep(300);
    if (chrome.exitCode == null && chrome.signalCode == null) chrome.kill("SIGKILL");
    await rm(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }).catch(() => {});
  }
}

void main().catch((error) => {
  console.error("CARD ART VIEWER BROWSER CERT: FAIL", error);
  process.exitCode = 1;
});
