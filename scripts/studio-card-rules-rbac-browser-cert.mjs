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
    this.notifications = [];
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(`${pending.method}: ${message.error.message}`));
        else pending.resolve(message.result || {});
      } else {
        this.notifications.push(message);
      }
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
    target.scrollIntoView({ block: 'center' });
    target.click();
    return true;
  })()`);
  assert.equal(clicked, true, `Could not click ${text}`);
}

async function selectLabeled(cdp, label, value) {
  const result = await evaluate(cdp, `(() => {
    const host = [...document.querySelectorAll('label')].find((candidate) => (candidate.querySelector('.label')?.textContent || '').trim() === ${JSON.stringify(label)});
    const select = host?.querySelector('select');
    if (!select) return null;
    if (![...select.options].some((option) => option.value === ${JSON.stringify(value)} || option.textContent === ${JSON.stringify(value)})) return { found:true, ok:false };
    select.value = ${JSON.stringify(value)};
    select.dispatchEvent(new Event('input', { bubbles:true }));
    select.dispatchEvent(new Event('change', { bubbles:true }));
    return { found:true, ok:select.value === ${JSON.stringify(value)} };
  })()`);
  assert.equal(result?.found, true, `Missing labeled select ${label}`);
  assert.equal(result?.ok, true, `${label} did not switch to ${value}`);
}

async function composerEvidence(cdp) {
  return evaluate(cdp, `(() => {
    const composers = [...document.querySelectorAll('[data-studio-effect-composer="semantic"]')];
    return {
      count: composers.length,
      primitives: composers.map((composer) => composer.querySelector('select')?.value || null),
      text: composers.map((composer) => (composer.textContent || '').replace(/\\s+/g, ' ').trim()),
      legacyKindLabelVisible: (document.body?.innerText || '').includes('Efeito (kind)'),
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      href: location.href,
    };
  })()`);
}

async function capture(cdp, filename, stage) {
  const metrics = await evaluate(cdp, `({ innerWidth:window.innerWidth, scrollWidth:document.documentElement.scrollWidth, bodyText:(document.body?.innerText || '').slice(0,300) })`);
  assert.ok(metrics.scrollWidth <= metrics.innerWidth + 2, `${stage} has horizontal overflow`);
  assert.ok(metrics.bodyText.trim().length > 20, `${stage} rendered suspiciously little text`);
  const screenshot = await cdp.call("Page.captureScreenshot", { format:"png", fromSurface:true, captureBeyondViewport:false });
  await writeFile(join(outputDir, filename), Buffer.from(screenshot.data, "base64"));
  console.log(`STUDIO RBAC BROWSER CERT: captured ${filename} — ${stage}`);
  return metrics;
}

async function login(cdp) {
  const password = process.env.ADMIN_PASSWORD?.trim();
  assert.ok(password, "ADMIN_PASSWORD is required");
  const username = process.env.ADMIN_USERNAME?.trim() || "admin";
  const payload = JSON.stringify({ username, password });
  const result = await evaluate(cdp, `(async () => {
    const response = await fetch('/api/admin/login', { method:'POST', credentials:'include', headers:{'content-type':'application/json'}, body:${JSON.stringify(payload)} });
    return { status:response.status, body:await response.json().catch(() => null) };
  })()`);
  assert.equal(result?.status, 200, `Admin login failed: ${JSON.stringify(result)}`);
  assert.equal(result?.body?.ok, true, "Admin login did not return ok=true");
  return result.body.user;
}

async function shutdown(chrome, profileDir) {
  if (chrome.exitCode == null && chrome.signalCode == null) chrome.kill("SIGTERM");
  await sleep(300);
  if (chrome.exitCode == null && chrome.signalCode == null) chrome.kill("SIGKILL");
  await rm(profileDir, { recursive:true, force:true, maxRetries:5, retryDelay:200 }).catch(() => {});
}

async function main() {
  await mkdir(outputDir, { recursive:true });
  const profileDir = await mkdtemp(join(tmpdir(), "runeforge-studio-rbac-chrome-"));
  const port = await freePort();
  const chrome = spawn(findChrome(), ["--headless=new","--disable-gpu","--no-sandbox","--disable-dev-shm-usage","--hide-scrollbars","--mute-audio",`--remote-debugging-port=${port}`,`--user-data-dir=${profileDir}`,`--window-size=${viewport.width},${viewport.height}`,"about:blank"], { stdio:["ignore","ignore","pipe"] });
  let stderr = "";
  chrome.stderr.on("data", (chunk) => { stderr += String(chunk); });
  let cdp;
  try {
    cdp = await CdpClient.connect(await waitForChrome(port));
    await cdp.call("Page.enable");
    await cdp.call("Runtime.enable");
    await cdp.call("Log.enable");
    await cdp.call("Emulation.setDeviceMetricsOverride", viewport);

    // The RBAC contract deliberately redirects unauthenticated authoring routes.
    // Authenticate from the public authoring entrypoint first, then enter Cards.
    await navigate(cdp, "/admin/studio");
    await waitForText(cdp, "Runeforge Studio Access");
    const user = await login(cdp);
    assert.equal(user?.role, "admin", `CI bootstrap must authenticate as admin, got ${user?.role}`);
    await navigate(cdp, "/admin/studio/cards");
    await waitForText(cdp, "Card Authoring Studio");
    await waitForText(cdp, "Identity");
    cdp.notifications.length = 0;

    await selectLabeled(cdp, "Type", "Spell");
    await clickText(cdp, "Rules");
    await waitForText(cdp, "Spell Contract");
    const spell = await waitUntil(async () => {
      const evidence = await composerEvidence(cdp);
      return evidence.count === 2 ? evidence : null;
    }, "two semantic Spell composers");
    assert.equal(spell.legacyKindLabelVisible, false);
    await capture(cdp, "24-studio-card-rules-spell.png", "Studio RBAC → Spell Rules");

    await clickText(cdp, "Identity");
    await selectLabeled(cdp, "Type", "Sentinela");
    await clickText(cdp, "Rules");
    await waitForText(cdp, "Sentinela (Planeswalker)");
    await clickText(cdp, "+ Adicionar habilidade");
    const sentinela = await waitUntil(async () => {
      const evidence = await composerEvidence(cdp);
      return evidence.count === 2 ? evidence : null;
    }, "two semantic Sentinela composers");
    assert.equal(sentinela.legacyKindLabelVisible, false);
    assert.ok(sentinela.text.some((text) => text.includes("Primitive") && text.includes("Target")));
    await capture(cdp, "25-studio-card-rules-sentinela.png", "Studio RBAC → Sentinela Rules");

    const severe = cdp.notifications.filter((message) => message.method === "Runtime.exceptionThrown" || (message.method === "Log.entryAdded" && ["error","assert"].includes(message.params?.entry?.level)));
    assert.equal(severe.length, 0, `Browser emitted runtime errors: ${JSON.stringify(severe.slice(0,3))}`);
    const evidence = { ok:true, gitSha:process.env.GITHUB_SHA || null, user, spell, sentinela, loginPath:"/admin/studio", authoringPath:"/admin/studio/cards" };
    await writeFile(join(outputDir, "24-25-studio-card-rules-browser-cert.json"), `${JSON.stringify(evidence, null, 2)}\n`);
    console.log("STUDIO RBAC BROWSER CERT: PASS — authenticated authoring flow + semantic Spell/Sentinela Card Rules certified");
  } catch (error) {
    if (cdp) {
      try { console.error("--- Studio RBAC browser snapshot ---", await evaluate(cdp, `({href:location.href,title:document.title,bodyText:(document.body?.innerText || '').replace(/\\s+/g,' ').trim().slice(0,1000)})`)); } catch {}
    }
    if (stderr.trim()) console.error(stderr.slice(-5000));
    throw error;
  } finally {
    if (cdp) cdp.close();
    await shutdown(chrome, profileDir);
  }
}

main().catch((error) => {
  console.error("STUDIO RBAC BROWSER CERT: FAIL", error);
  process.exitCode = 1;
});
