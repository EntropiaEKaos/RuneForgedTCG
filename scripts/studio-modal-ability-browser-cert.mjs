import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import net from "node:net";

const baseUrl = (process.env.E2E_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const outputDir = resolve(process.env.ALPHA_VISUAL_DIR || "artifacts/alpha-visual");
const viewport = { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false };
const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

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
    assert.equal(typeof WebSocket, "function", "Node 22 WebSocket global is required");
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
    } catch (error) { last = error; }
    await sleep(125);
  }
  throw new Error(`Timed out waiting for ${label}${last instanceof Error ? `: ${last.message}` : ""}`);
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

async function clickText(cdp, text) {
  const clicked = await evaluate(cdp, `(() => {
    const normalize = (value) => (value || '').replace(/\\s+/g, ' ').trim();
    const target = [...document.querySelectorAll('button,a,[role="button"]')].find((node) => !node.disabled && normalize(node.textContent).includes(${JSON.stringify(text)}));
    if (!target) return false;
    target.scrollIntoView({ block:'center' });
    target.click();
    return true;
  })()`);
  assert.equal(clicked, true, `Could not click ${text}`);
}

async function setLabeledValue(cdp, label, value) {
  const result = await evaluate(cdp, `(() => {
    const host = [...document.querySelectorAll('label')].find((candidate) => (candidate.querySelector('.label')?.textContent || '').trim() === ${JSON.stringify(label)});
    const input = host?.querySelector('input,textarea');
    if (!input) return false;
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set;
    if (setter) setter.call(input, ${JSON.stringify(value)}); else input.value = ${JSON.stringify(value)};
    input.dispatchEvent(new Event('input', { bubbles:true }));
    input.dispatchEvent(new Event('change', { bubbles:true }));
    return input.value === ${JSON.stringify(value)};
  })()`);
  assert.equal(result, true, `Could not set ${label}`);
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

async function modalEvidence(cdp) {
  return evaluate(cdp, `(() => ({
    modalSections:[...document.querySelectorAll('[data-studio-ability-composer="activated"][data-activated-modal="true"]')].length,
    modes:[...document.querySelectorAll('[data-studio-modal-mode]')].map((node) => node.getAttribute('data-studio-modal-mode')),
    modeDescriptions:[...document.querySelectorAll('[data-studio-modal-mode]')].map((node) => node.querySelector('input')?.value || ''),
    effectComposers:[...document.querySelectorAll('[data-studio-modal-choices="true"] [data-studio-effect-composer="semantic"]')].length,
    body:(document.body?.innerText || '').replace(/\\s+/g, ' ').trim(),
    scrollWidth:document.documentElement.scrollWidth,
    innerWidth:window.innerWidth,
  }))()`);
}

async function capture(cdp, filename) {
  const evidence = await modalEvidence(cdp);
  assert.ok(evidence.scrollWidth <= evidence.innerWidth + 2, "Modal authoring surface has horizontal overflow");
  const screenshot = await cdp.call("Page.captureScreenshot", { format:"png", fromSurface:true, captureBeyondViewport:false });
  await writeFile(join(outputDir, filename), Buffer.from(screenshot.data, "base64"));
}

async function shutdown(chrome, profileDir) {
  if (chrome.exitCode == null && chrome.signalCode == null) chrome.kill("SIGTERM");
  await sleep(300);
  if (chrome.exitCode == null && chrome.signalCode == null) chrome.kill("SIGKILL");
  await rm(profileDir, { recursive:true, force:true, maxRetries:5, retryDelay:200 }).catch(() => {});
}

async function main() {
  await mkdir(outputDir, { recursive:true });
  const suffix = `${Date.now().toString(36)}-${process.pid.toString(36)}`;
  const cardName = `Modal Browser Cert ${suffix}`;
  const defId = `modal_browser_cert_${suffix.replace(/-/g, '_')}`;
  const profileDir = await mkdtemp(join(tmpdir(), "runeforge-modal-studio-chrome-"));
  const port = await freePort();
  const chrome = spawn(findChrome(), ["--headless=new","--disable-gpu","--no-sandbox","--disable-dev-shm-usage","--hide-scrollbars","--mute-audio",`--remote-debugging-port=${port}`,`--user-data-dir=${profileDir}`,`--window-size=${viewport.width},${viewport.height}`,"about:blank"], { stdio:["ignore","ignore","pipe"] });
  let stderr = "";
  chrome.stderr.on("data", (chunk) => { stderr += String(chunk); });
  let cdp;
  try {
    cdp = await CdpClient.connect(await waitForChrome(port));
    await cdp.call("Page.enable");
    await cdp.call("Runtime.enable");
    await cdp.call("Emulation.setDeviceMetricsOverride", viewport);

    await navigate(cdp, "/admin/studio");
    await waitForText(cdp, "Runeforge Studio Access");
    await login(cdp);
    await navigate(cdp, "/admin/studio/cards");
    await waitForText(cdp, "Card Authoring Studio");
    await clickText(cdp, "＋ New Card");

    await setLabeledValue(cdp, "Name", cardName);
    await setLabeledValue(cdp, "defId", defId);
    await setLabeledValue(cdp, "Description", "Browser-authored modal ability persistence certification.");
    await clickText(cdp, "Rules");
    await waitForText(cdp, "Habilidades ativadas");
    await clickText(cdp, "+ Adicionar habilidade ativada");
    await waitUntil(() => evaluate(cdp, `document.querySelectorAll('[data-studio-ability-composer="activated"]').length === 1`), "new activated ability composer");

    const toggled = await evaluate(cdp, `(() => {
      const label = [...document.querySelectorAll('label')].find((node) => (node.textContent || '').includes('Escolha um (modal)'));
      const checkbox = label?.querySelector('input[type="checkbox"]');
      if (!checkbox) return false;
      checkbox.click();
      return true;
    })()`);
    assert.equal(toggled, true, "Modal checkbox must be operable in the real Card Studio");
    await waitUntil(async () => (await modalEvidence(cdp)).modalSections === 1, "modal composer activation");
    await clickText(cdp, "+ Adicionar opção");
    await waitUntil(async () => (await modalEvidence(cdp)).modes.length === 2, "second modal choice");

    await setLabeledValue(cdp, "Opção 1 · descrição", "Spark browser mode");
    await setLabeledValue(cdp, "Opção 2 · descrição", "Study browser mode");
    const beforeSave = await modalEvidence(cdp);
    assert.deepEqual(beforeSave.modes, ["mode-1", "mode-2"], "real Studio assigns deterministic stable mode ids");
    assert.deepEqual(beforeSave.modeDescriptions, ["Spark browser mode", "Study browser mode"], "designer-authored mode descriptions are held in the model");
    assert.equal(beforeSave.effectComposers, 2, "each modal choice owns its semantic effect composer");
    assert.match(beforeSave.body, /Custo compartilhado/);
    assert.match(beforeSave.body, /Usos \/ rodada \(compartilhados\)/);
    await capture(cdp, "studio-modal-authoring-before-save.png");

    await clickText(cdp, "Save Card + Metadata");
    await waitForText(cdp, "Saved atomically");

    await navigate(cdp, "/admin/studio/cards");
    await waitForText(cdp, "Card Authoring Studio");
    await waitForText(cdp, cardName);
    await clickText(cdp, cardName);
    await clickText(cdp, "Rules");
    await waitUntil(async () => (await modalEvidence(cdp)).modes.length === 2, "modal choices after browser reload");

    const afterReload = await modalEvidence(cdp);
    assert.deepEqual(afterReload.modes, ["mode-1", "mode-2"], "stable mode ids survive save + full page reload");
    assert.deepEqual(afterReload.modeDescriptions, ["Spark browser mode", "Study browser mode"], "mode descriptions survive save + full page reload");
    assert.equal(afterReload.effectComposers, 2, "semantic mode effect editors survive reload");
    await capture(cdp, "studio-modal-authoring-after-reload.png");

    console.log("STUDIO MODAL ABILITY BROWSER CERT: PASS — create → modal compose → save → reload with stable mode ids");
  } finally {
    cdp?.close();
    await shutdown(chrome, profileDir);
    if (stderr && process.exitCode) console.error(stderr);
  }
}

main().catch((error) => {
  console.error("STUDIO MODAL ABILITY BROWSER CERT: FAIL", error);
  process.exitCode = 1;
});
