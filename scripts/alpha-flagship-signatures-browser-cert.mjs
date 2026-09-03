import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import net from "node:net";

const baseUrl = (process.env.E2E_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const outputDir = resolve(process.env.ALPHA_VISUAL_DIR || "artifacts/alpha-visual");
const viewport = { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false };

const probes = [
  ["ember_ashguard", "Guarda das Cinzas", "/art/cards/flagship/emberhold/ember_ashguard.webp", "14a-signature-emberhold-art-viewer.png"],
  ["tide_cloudpiercer", "Quebra-Nuvens Abissal", "/art/cards/flagship/tidecall/tide_cloudpiercer.webp", "14b-signature-tidecall-art-viewer.png"],
  ["wood_canopy_bastion", "Bastião da Copa", "/art/cards/flagship/ironwood/wood_canopy_bastion.webp", "14c-signature-ironwood-art-viewer.png"],
  ["void_gloom_warden", "Vigia da Penumbra", "/art/cards/flagship/voidborn/void_gloom_warden.webp", "14d-signature-voidborn-art-viewer.png"],
  ["forest_dawn_alpha", "Alfa da Alvorada", "/art/cards/flagship/florestia/forest_dawn_alpha.webp", "14e-signature-florestia-art-viewer.png"],
  ["storm_static_adept", "Adepto da Estática", "/art/cards/flagship/tempestade/storm_static_adept.webp", "14f-signature-tempestade-art-viewer.png"],
].map(([defId, name, artPath, screenshot]) => ({ defId, name, artPath, screenshot }));

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
async function waitForChrome(port, timeoutMs = 20_000) {
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
async function setSearch(cdp, value) {
  const changed = await evaluate(cdp, `(() => {
    const input = [...document.querySelectorAll('input')].find((element) => (element.placeholder || '').includes('Nome, habilidade'));
    if (!input) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  assert.equal(changed, true, "Codex search input not found");
  await sleep(200);
}
async function hoverCard(cdp, probe) {
  const selector = `[data-card-tip-def-id=${JSON.stringify(probe.defId)}]`;
  await waitUntil(() => evaluate(cdp, `Boolean(document.querySelector(${JSON.stringify(selector)}))`), `${probe.name} card`);
  const point = await evaluate(cdp, `(() => {
    const host = document.querySelector(${JSON.stringify(selector)});
    if (!host) return null;
    host.scrollIntoView({ block: 'center', inline: 'center' });
    const shell = host.querySelector('[data-card-art-source]');
    const art = shell?.querySelector('.card-art');
    const rect = host.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, background: art ? getComputedStyle(art).backgroundImage : '', source: shell?.getAttribute('data-card-art-source') || '', text: document.body?.innerText || '' };
  })()`);
  assert.ok(point, `Could not locate ${probe.name}`);
  assert.match(point.text, new RegExp(probe.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "i"), `${probe.name} must be visible in Codex`);
  assert.ok(point.background.includes(probe.artPath), `${probe.name} CardView must render ${probe.artPath}`);
  assert.notEqual(point.source, "regional-fallback", `${probe.name} must not use regional fallback art`);
  await cdp.call("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y });
  await waitUntil(() => evaluate(cdp, `Boolean(document.querySelector('[data-tooltip-panel="true"]'))`), `${probe.name} intelligence tooltip`);
  await waitUntil(() => evaluate(cdp, `Boolean(document.querySelector('[data-card-art-viewer-trigger="${probe.defId}"]'))`), `${probe.name} VER ARTE trigger`);
}
async function openViewer(cdp, probe) {
  const clicked = await evaluate(cdp, `(() => { const trigger = document.querySelector('[data-card-art-viewer-trigger="${probe.defId}"]'); if (!trigger) return false; trigger.click(); return true; })()`);
  assert.equal(clicked, true, `${probe.name} VER ARTE button could not be clicked`);
  await waitUntil(() => evaluate(cdp, `Boolean(document.querySelector('[data-card-art-viewer="${probe.defId}"]'))`), `${probe.name} full-art dialog`);
  const state = await evaluate(cdp, `(() => {
    const dialog = document.querySelector('[data-card-art-viewer="${probe.defId}"]');
    const image = document.querySelector('[data-card-art-viewer-image="${probe.defId}"]');
    const rect = image?.getBoundingClientRect();
    return { role: dialog?.getAttribute('role') || '', modal: dialog?.getAttribute('aria-modal') || '', label: dialog?.getAttribute('aria-label') || '', background: image ? getComputedStyle(image).backgroundImage : '', backgroundSize: image ? getComputedStyle(image).backgroundSize : '', overflow: document.body.style.overflow, rect: rect ? { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom } : null, width: innerWidth, height: innerHeight };
  })()`);
  assert.equal(state.role, "dialog", `${probe.name} viewer must expose dialog semantics`);
  assert.equal(state.modal, "true", `${probe.name} viewer must be modal`);
  assert.ok(state.label.includes(probe.name), `${probe.name} viewer must identify the card`);
  assert.ok(state.background.includes(probe.artPath), `${probe.name} viewer must render ${probe.artPath}`);
  assert.equal(state.backgroundSize, "contain", `${probe.name} viewer must show the full art without crop`);
  assert.equal(state.overflow, "hidden", `${probe.name} viewer must lock background scrolling`);
  assert.ok(state.rect && state.rect.left >= 0 && state.rect.top >= 0 && state.rect.right <= state.width + 1 && state.rect.bottom <= state.height + 1, `${probe.name} viewer must remain inside viewport`);
}
async function closeViewer(cdp, probe) {
  const clicked = await evaluate(cdp, `(() => { const close = document.querySelector('[data-card-art-viewer-close="${probe.defId}"]'); if (!close) return false; close.click(); return true; })()`);
  assert.equal(clicked, true, `${probe.name} viewer close control missing`);
  await waitUntil(() => evaluate(cdp, `!document.querySelector('[data-card-art-viewer="${probe.defId}"]')`), `${probe.name} viewer to close`);
  await cdp.call("Input.dispatchMouseEvent", { type: "mouseMoved", x: 4, y: 4 });
  await sleep(150);
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
    assert.match(response.headers.get("content-type") || "", /^image\/webp/i, `${probe.artPath} must remain WebP`);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.ok(bytes.byteLength > 10_000, `${probe.artPath} must contain a non-trivial master image`);
  }

  const profileDir = await mkdtemp(join(tmpdir(), "runeforge-flagship-signatures-"));
  const port = await freePort();
  const chrome = spawn(findChrome(), ["--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars", "--mute-audio", `--remote-debugging-port=${port}`, `--user-data-dir=${profileDir}`, `--window-size=${viewport.width},${viewport.height}`, "about:blank"], { stdio: "ignore" });

  let cdp;
  try {
    cdp = await CdpClient.connect(await waitForChrome(port));
    await cdp.call("Page.enable");
    await cdp.call("Runtime.enable");
    await cdp.call("Emulation.setDeviceMetricsOverride", viewport);
    await navigate(cdp, "/codex");
    for (const probe of probes) {
      await setSearch(cdp, probe.name);
      await hoverCard(cdp, probe);
      await openViewer(cdp, probe);
      await capture(cdp, probe.screenshot);
      await closeViewer(cdp, probe);
    }
    console.log("FLAGSHIP ART BATCH E BROWSER CERT: PASS — six starter signature WebP masters served, rendered and opened in VER ARTE");
  } finally {
    try { cdp?.close(); } catch {}
    if (chrome.exitCode == null && chrome.signalCode == null) chrome.kill("SIGTERM");
    await sleep(300);
    if (chrome.exitCode == null && chrome.signalCode == null) chrome.kill("SIGKILL");
    await rm(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }).catch(() => {});
  }
}

void main().catch((error) => {
  console.error("FLAGSHIP ART BATCH E BROWSER CERT: FAIL", error);
  process.exitCode = 1;
});
