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

async function navigate(cdp, path) {
  const target = `${baseUrl}${path}`;
  await cdp.call("Page.navigate", { url: target });
  await waitUntil(() => evaluate(cdp, `location.href === ${JSON.stringify(target)} && ['interactive','complete'].includes(document.readyState)`), `navigation to ${target}`);
  await sleep(300);
}

async function waitForText(cdp, text) {
  return waitUntil(() => evaluate(cdp, `document.body?.innerText?.includes(${JSON.stringify(text)}) === true`), `text ${JSON.stringify(text)}`);
}

async function clickText(cdp, text) {
  const clicked = await evaluate(cdp, `(() => {
    const normalize = (value) => (value || '').replace(/\\s+/g, ' ').trim();
    const target = [...document.querySelectorAll('button,a,[role="button"]')].find((node) => !node.disabled && normalize(node.textContent).includes(${JSON.stringify(text)}));
    if (!target) return false;
    target.scrollIntoView({ block:'center' }); target.click(); return true;
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
    input.dispatchEvent(new Event('input', { bubbles:true })); input.dispatchEvent(new Event('change', { bubbles:true }));
    return input.value === ${JSON.stringify(value)};
  })()`);
  assert.equal(result, true, `Could not set ${label}`);
}

async function selectLabeled(cdp, label, value) {
  const result = await evaluate(cdp, `(() => {
    const host = [...document.querySelectorAll('label')].find((candidate) => ((candidate.querySelector('.label')?.textContent || candidate.querySelector('span')?.textContent || '').trim()) === ${JSON.stringify(label)});
    const select = host?.querySelector('select');
    if (!select) return { found:false, ok:false };
    const option = [...select.options].find((item) => item.value === ${JSON.stringify(value)});
    if (!option) return { found:true, ok:false, options:[...select.options].map((item)=>item.value) };
    select.value = option.value;
    select.dispatchEvent(new Event('input', { bubbles:true })); select.dispatchEvent(new Event('change', { bubbles:true }));
    return { found:true, ok:select.value === option.value };
  })()`);
  assert.equal(result?.found, true, `Missing labeled select ${label}`);
  assert.equal(result?.ok, true, `${label} did not switch to ${value}: ${JSON.stringify(result)}`);
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

async function createFrameDraft(cdp, key, name) {
  const payload = {
    key, name, description:"Studio Visual Authoring browser certification frame",
    config:{ primaryColor:"#e77722", secondaryColor:"#40140c", accentColor:"#ffe5a8", borderWidth:3, radius:14, glow:24, innerLineOpacity:.42, artInset:3, nameplateOpacity:.9, foilIntensity:.3, gradientAngle:132, material:"forged", cornerStyle:"cut", ornament:"runes" },
  };
  const result = await evaluate(cdp, `(async () => {
    const response = await fetch('/api/admin/studio/frames', { method:'POST', credentials:'include', headers:{'content-type':'application/json'}, body:${JSON.stringify(JSON.stringify(payload))} });
    return { status:response.status, body:await response.json().catch(() => null) };
  })()`);
  assert.equal(result?.status, 200, `Frame draft creation failed: ${JSON.stringify(result)}`);
  assert.equal(result?.body?.ok, true, "Frame draft creation did not return ok=true");
  return result.body.row;
}

async function capture(cdp, filename, stage) {
  await sleep(300);
  const metrics = await evaluate(cdp, `({ innerWidth:window.innerWidth, scrollWidth:document.documentElement.scrollWidth, bodyText:(document.body?.innerText || '').replace(/\\s+/g,' ').trim(), href:location.href })`);
  assert.ok(metrics.scrollWidth <= metrics.innerWidth + 2, `${stage} has horizontal overflow: ${metrics.scrollWidth}px > ${metrics.innerWidth}px`);
  assert.ok(metrics.bodyText.length > 80, `${stage} rendered suspiciously little text`);
  const screenshot = await cdp.call("Page.captureScreenshot", { format:"png", fromSurface:true, captureBeyondViewport:false });
  await writeFile(join(outputDir, filename), Buffer.from(screenshot.data, "base64"));
  return { ...metrics, bodyText: undefined };
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
  const frameKey = `visual-authoring-${suffix}`.replace(/[^a-z0-9-]/g, "-");
  const frameName = `Convergence Forge ${suffix}`;
  const cardName = `Visual Authoring Cert ${suffix}`;
  const defId = `visual_authoring_cert_${suffix.replace(/-/g,"_")}`;
  const profileDir = await mkdtemp(join(tmpdir(), "forged-visual-authoring-"));
  const chrome = spawn(findChrome(), ["--headless=new","--disable-gpu","--no-sandbox","--disable-dev-shm-usage","--hide-scrollbars","--mute-audio",CHROME_REMOTE_DEBUGGING_FLAG,`--user-data-dir=${profileDir}`,`--window-size=${viewport.width},${viewport.height}`,"about:blank"], { stdio:["ignore","ignore","pipe"] });
  let stderr = ""; chrome.stderr.on("data", (chunk) => { stderr += String(chunk); });
  let cdp;
  try {
    const port = await waitForChromeDevToolsPort({ profileDir, chrome, getStderr: () => stderr });
    cdp = await CdpClient.connect(await waitForChrome(port));
    await cdp.call("Page.enable"); await cdp.call("Runtime.enable"); await cdp.call("Emulation.setDeviceMetricsOverride", viewport);

    await navigate(cdp, "/admin/studio");
    await login(cdp);
    const frameRow = await createFrameDraft(cdp, frameKey, frameName);

    await navigate(cdp, "/admin/studio/frames");
    await waitForText(cdp, "Frame Builder");
    await waitForText(cdp, frameName);
    await clickText(cdp, "Editar");
    await waitUntil(() => evaluate(cdp, `document.querySelector('[data-frame-preview]')?.getAttribute('data-frame-preview') === ${JSON.stringify(frameKey)}`), "Frame Builder selected preset");
    await waitForText(cdp, "Live preview");
    const frameMetrics = await capture(cdp, "41-studio-frame-builder.png", "Frame Builder");
    const frameEvidence = await evaluate(cdp, `(() => ({ builder:Boolean(document.querySelector('[data-studio-frame-builder="true"]')), preview:Boolean(document.querySelector('[data-frame-preview]')), primary:[...document.querySelectorAll('input[type="color"]')].map((x)=>x.value), ranges:document.querySelectorAll('input[type="range"]').length }))()`);
    assert.equal(frameEvidence.builder, true, "Frame Builder marker must be mounted");
    assert.equal(frameEvidence.preview, true, "Frame Builder preview must be mounted");
    assert.ok(frameEvidence.ranges >= 8, "Frame Builder must expose the visual tuning controls");

    await navigate(cdp, "/admin/studio/cards");
    await waitForText(cdp, "Card Authoring Studio");
    await clickText(cdp, "＋ New Card");
    await setLabeledValue(cdp, "Name", cardName);
    await setLabeledValue(cdp, "defId", defId);
    await setLabeledValue(cdp, "Description", "Studio Visual Authoring certification card.");
    await clickText(cdp, "Save Card + Metadata");
    await waitForText(cdp, "Saved atomically");
    await clickText(cdp, "Cosmetics");
    await waitUntil(() => evaluate(cdp, `Boolean(document.querySelector('[data-studio-visual-authoring="1.0"]'))`), "Visual Authoring cosmetics tab");
    await clickText(cdp, "＋ Nova variante");
    await setLabeledValue(cdp, "Variant ID", `${defId}_visual`);
    await setLabeledValue(cdp, "Display name", "Convergence Visual Printing");
    await selectLabeled(cdp, "Frame preset", frameKey);
    const cosmeticsMetrics = await capture(cdp, "42-studio-card-visual-authoring.png", "Card Visual Authoring");
    const cosmeticsEvidence = await evaluate(cdp, `(() => ({ mounted:Boolean(document.querySelector('[data-studio-visual-authoring="1.0"]')), art:Boolean(document.querySelector('[data-studio-card-art-authoring="true"]')), frame:document.querySelector('[data-studio-cosmetic-preview="true"]')?.getAttribute('data-preview-frame') || null, ranges:document.querySelectorAll('[data-studio-card-art-authoring="true"] input[type="range"]').length }))()`);
    assert.equal(cosmeticsEvidence.mounted, true);
    assert.equal(cosmeticsEvidence.art, true);
    assert.equal(cosmeticsEvidence.frame, frameKey);
    assert.equal(cosmeticsEvidence.ranges, 3, "Card variant art authoring must expose focus X/Y + zoom");

    await navigate(cdp, "/admin/studio/art");
    await waitForText(cdp, "Art Pipeline");
    await waitForText(cdp, "Cobertura");
    const artMetrics = await capture(cdp, "43-studio-art-pipeline.png", "Art Pipeline");
    const artEvidence = await evaluate(cdp, `(() => ({ mounted:document.querySelector('[data-studio-art-pipeline="visual-authoring-1.0"]') !== null, hasUpload:[...document.querySelectorAll('label')].some((x)=>(x.textContent||'').includes('Upload imagem')), hasFrameBuilder:(document.body?.innerText||'').includes('Frame Builder') }))()`);
    assert.equal(artEvidence.mounted, true);
    assert.equal(artEvidence.hasUpload, true);
    assert.equal(artEvidence.hasFrameBuilder, true);

    const report = {
      ok:true,
      gitSha:process.env.GITHUB_SHA || null,
      capturedAt:new Date().toISOString(),
      viewport,
      frame:{ id:frameRow.id, key:frameKey, name:frameName, ...frameEvidence, metrics:frameMetrics },
      cosmetics:{ defId, ...cosmeticsEvidence, metrics:cosmeticsMetrics },
      art:{ ...artEvidence, metrics:artMetrics },
      screenshots:["41-studio-frame-builder.png","42-studio-card-visual-authoring.png","43-studio-art-pipeline.png"],
    };
    await writeFile(join(outputDir, "studio-visual-authoring-manifest.json"), `${JSON.stringify(report,null,2)}\n`, "utf8");
    console.log("STUDIO VISUAL AUTHORING BROWSER CERT: PASS — Frame Builder + card art/crop + Art Pipeline certified in real browser");
  } finally {
    cdp?.close(); await shutdown(chrome, profileDir);
    if (stderr && process.exitCode) console.error(stderr);
  }
}

main().catch((error) => { console.error("STUDIO VISUAL AUTHORING BROWSER CERT: FAIL", error); process.exitCode = 1; });
