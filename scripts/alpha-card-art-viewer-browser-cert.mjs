import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { CHROME_REMOTE_DEBUGGING_FLAG, waitForChromeDevToolsPort } from "./chrome-devtools-bootstrap.mjs";

const baseUrl = (process.env.E2E_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const outputDir = resolve(process.env.ALPHA_VISUAL_DIR || "artifacts/alpha-visual");
const viewport = { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false };
const flagshipSubject = {
  defId: "ember_champion",
  cardName: "Pyra, the Everflame",
  artPath: "/art/cards/flagship/emberhold/ember_champion.webp",
  labelPattern: /Pyra/i,
};
const p0Subject = {
  defId: "ember_bolt",
  cardName: "Scorching Bolt",
  artPath: "/art/cards/alpha-p0/emberhold/ember_bolt.webp",
  labelPattern: /Scorching Bolt/i,
};
const activeP0Paths = [
  "/art/cards/alpha-p0/emberhold/ember_bolt.webp",
  "/art/cards/alpha-p0/ironwood/wood_webweaver.webp",
  "/art/cards/alpha-p0/tidecall/tide_guard.webp",
  "/art/cards/alpha-p0/ironwood/wood_growth.webp",
  "/art/cards/alpha-p0/ironwood/wood_mend.webp",
];

function sleep(ms) { return new Promise((resolvePromise) => setTimeout(resolvePromise, ms)); }

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

async function dismissRecoveryHandoffIfPresent(cdp) {
  // Public catalog surfaces remain anonymous; only dismiss a handoff left by
  // a prior explicit player session if one is actually present.
  await sleep(350);

  const handoff = await evaluate(cdp, `(() => {
    const dialogs = [...document.querySelectorAll('[role="dialog"]')];
    const dialog = dialogs.find((element) => (element.textContent || '').includes('SALVE SUA CHAVE DE RECUPERAÇÃO'));
    if (!dialog) return { present: false, dismissed: false };
    const button = [...dialog.querySelectorAll('button')].find((element) => (element.textContent || '').trim() === 'JÁ GUARDEI');
    if (!button) return { present: true, dismissed: false };
    button.click();
    return { present: true, dismissed: true };
  })()`);

  if (!handoff?.present) return;
  assert.equal(handoff.dismissed, true, "Recovery-key handoff could not be dismissed before art viewer certification");
  await waitUntil(
    () => evaluate(cdp, `![...document.querySelectorAll('[role="dialog"]')].some((element) => (element.textContent || '').includes('SALVE SUA CHAVE DE RECUPERAÇÃO'))`),
    "recovery-key handoff dismissal",
    5_000,
  );
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

async function hoverCard(cdp, subject) {
  const selector = `[data-card-tip-def-id=${JSON.stringify(subject.defId)}]`;
  await waitUntil(() => evaluate(cdp, `Boolean(document.querySelector(${JSON.stringify(selector)}))`), `${subject.defId} card`);
  const point = await evaluate(cdp, `(() => {
    const target = document.querySelector(${JSON.stringify(selector)});
    if (!target) return null;
    target.scrollIntoView({ block: 'center', inline: 'center' });
    const rect = target.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`);
  assert.ok(point, `Could not locate ${subject.defId}`);
  await cdp.call("Input.dispatchMouseEvent", { type: "mouseMoved", x: 2, y: 2 });
  await sleep(120);
  await cdp.call("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y });
  await waitUntil(() => evaluate(cdp, `Boolean(document.querySelector('[data-tooltip-panel="true"]'))`), "card intelligence tooltip");
  await waitUntil(() => evaluate(cdp, `Boolean(document.querySelector('[data-card-art-viewer-trigger="${subject.defId}"]'))`), "VER ARTE trigger");
}

async function openViewer(cdp, subject) {
  const clicked = await evaluate(cdp, `(() => {
    const trigger = document.querySelector('[data-card-art-viewer-trigger="${subject.defId}"]');
    if (!trigger) return false;
    trigger.click();
    return true;
  })()`);
  assert.equal(clicked, true, "VER ARTE button could not be clicked");
  await waitUntil(() => evaluate(cdp, `Boolean(document.querySelector('[data-card-art-viewer="${subject.defId}"]'))`), "full-art dialog");
  const state = await evaluate(cdp, `(() => {
    const dialog = document.querySelector('[data-card-art-viewer="${subject.defId}"]');
    const image = document.querySelector('[data-card-art-viewer-image="${subject.defId}"]');
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
  assert.match(state.label, subject.labelPattern, "full-art viewer must identify the card");
  assert.ok(state.background.includes(subject.artPath), `full-art viewer must render ${subject.artPath}`);
  assert.equal(state.overflow, "hidden", "full-art viewer must lock background scrolling");
}

async function closeViewer(cdp, subject) {
  await evaluate(cdp, `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`);
  await waitUntil(() => evaluate(cdp, `!document.querySelector('[data-card-art-viewer="${subject.defId}"]')`), "full-art dialog to close");
}

async function capture(cdp, filename) {
  await settle(cdp);
  const metrics = await evaluate(cdp, `({ innerWidth: window.innerWidth, scrollWidth: document.documentElement.scrollWidth })`);
  assert.ok(metrics.scrollWidth <= metrics.innerWidth + 2, `${filename} has horizontal overflow`);
  const screenshot = await cdp.call("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  await writeFile(join(outputDir, filename), Buffer.from(screenshot.data, "base64"));
}

async function assertServedWebp(path) {
  const response = await fetch(`${baseUrl}${path}`);
  assert.equal(response.ok, true, `${path} must be served by the built app`);
  assert.match(response.headers.get("content-type") || "", /^image\/webp/i, `${path} must remain WebP`);
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  await assertServedWebp(flagshipSubject.artPath);
  for (const path of activeP0Paths) await assertServedWebp(path);

  const profileDir = await mkdtemp(join(tmpdir(), "runeforge-card-art-viewer-"));
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
    await dismissRecoveryHandoffIfPresent(cdp);
    await setSearch(cdp, "Nome, habilidade", flagshipSubject.cardName);
    await hoverCard(cdp, flagshipSubject);
    await openViewer(cdp, flagshipSubject);
    await capture(cdp, "10k-codex-art-viewer.png");
    await closeViewer(cdp, flagshipSubject);

    await setSearch(cdp, "Nome, habilidade", p0Subject.cardName);
    await hoverCard(cdp, p0Subject);
    await openViewer(cdp, p0Subject);
    await capture(cdp, "45-alpha-p0-ember-bolt-art-viewer.png");
    await closeViewer(cdp, p0Subject);

    await navigate(cdp, "/collection");
    await waitUntil(() => evaluate(cdp, `Boolean([...document.querySelectorAll('input')].find((element) => (element.placeholder || '').includes('Buscar nome')))`) , "Collection search input");
    await setSearch(cdp, "Buscar nome", flagshipSubject.cardName);
    await hoverCard(cdp, flagshipSubject);
    await openViewer(cdp, flagshipSubject);
    await capture(cdp, "10l-collection-art-viewer.png");
    await closeViewer(cdp, flagshipSubject);

    console.log("CARD ART VIEWER BROWSER CERT: PASS — Flagship viewer preserved + five active P0 WebPs served + Scorching Bolt runtime viewer certified");
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