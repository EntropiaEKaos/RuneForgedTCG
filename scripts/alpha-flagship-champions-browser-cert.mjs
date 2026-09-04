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
  ["ember_champion", "Pyra, the Everflame", "/art/cards/flagship/emberhold/ember_champion.webp", "10e-champion-pyra.png"],
  ["tide_champion", "Nerida, Tide Empress", "/art/cards/flagship/tidecall/tide_champion.webp", "10f-champion-nerida.png"],
  ["wood_champion", "Bramblehart, Grovekeeper", "/art/cards/flagship/ironwood/wood_champion.webp", "10g-champion-bramblehart.png"],
  ["void_champion", "Malakar, the Hollow King", "/art/cards/flagship/voidborn/void_champion.webp", "10h-champion-malakar.png"],
  ["forest_champion", "Kaara, Regente das Feras", "/art/cards/flagship/florestia/forest_champion.webp", "10i-champion-kaara.png"],
  ["storm_champion", "Zael, Senhor dos Raios", "/art/cards/flagship/tempestade/storm_champion.webp", "10j-champion-zael.png"],
].map(([defId, query, artPath, screenshot]) => ({ defId, query, artPath, screenshot }));

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
  await sleep(350);
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
  await waitUntil(() => evaluate(cdp, `Boolean(document.querySelector(${JSON.stringify(selector)}))`), `Codex Champion ${defId}`);
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

async function capture(cdp, filename) {
  await settle(cdp);
  const metrics = await evaluate(cdp, `({ innerWidth: window.innerWidth, scrollWidth: document.documentElement.scrollWidth })`);
  assert.ok(metrics.scrollWidth <= metrics.innerWidth + 2, `${filename} has horizontal overflow`);
  const screenshot = await cdp.call("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  await writeFile(join(outputDir, filename), Buffer.from(screenshot.data, "base64"));
}

async function main() {
  await mkdir(outputDir, { recursive: true });

  for (const probe of probes) {
    const response = await fetch(`${baseUrl}${probe.artPath}`);
    assert.equal(response.ok, true, `${probe.artPath} must be served by the built app`);
    assert.match(response.headers.get("content-type") || "", /^image\/webp/i, `${probe.artPath} must be WebP`);
    assert.ok(Number(response.headers.get("content-length") || 1) > 0, `${probe.artPath} must not be empty`);
  }

  const profileDir = await mkdtemp(join(tmpdir(), "runeforge-flagship-champions-"));
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
      const result = await evaluate(cdp, `(() => {
        const host = document.querySelector(${JSON.stringify(selector)});
        const shell = host?.querySelector('[data-card-art-source]');
        const art = shell?.querySelector('.card-art');
        return {
          text: document.body?.innerText || '',
          background: art ? getComputedStyle(art).backgroundImage : '',
          source: shell?.getAttribute('data-card-art-source') || '',
        };
      })()`);
      assert.match(result.text, new RegExp(probe.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "i"), `${probe.defId} name must be visible`);
      assert.ok(result.background.includes(probe.artPath), `${probe.defId} CardView must use ${probe.artPath}`);
      assert.notEqual(result.source, "regional-fallback", `${probe.defId} must not fall back to regional art`);
      await capture(cdp, probe.screenshot);
    }

    console.log("FLAGSHIP ART BATCH A BROWSER CERT: PASS — six Champion WebP masters served and rendered in Codex");
  } finally {
    try { cdp?.close(); } catch {}
    if (chrome.exitCode == null && chrome.signalCode == null) chrome.kill("SIGTERM");
    await sleep(300);
    if (chrome.exitCode == null && chrome.signalCode == null) chrome.kill("SIGKILL");
    await rm(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }).catch(() => {});
  }
}

void main().catch((error) => {
  console.error("FLAGSHIP ART BATCH A BROWSER CERT: FAIL", error);
  process.exitCode = 1;
});
