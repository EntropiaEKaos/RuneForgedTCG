import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import net from "node:net";

const baseUrl = (process.env.E2E_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const outputDir = resolve(process.env.ALPHA_VISUAL_DIR || "artifacts/alpha-visual");
const viewport = { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false };

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

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
  try {
    await rm(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch (error) {
    console.warn(`ALPHA VISUAL: temporary Chrome profile cleanup warning — ${error instanceof Error ? error.message : String(error)}`);
  }
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
    assert.equal(typeof WebSocket, "function", "Node 22 WebSocket global is required for dependency-free CDP capture");
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
    target.scrollIntoView({ block: 'center', inline: 'center' });
    target.click();
    return true;
  })()`);
  assert.equal(clicked, true, `Could not click control containing text: ${text}`);
}

async function navigate(cdp, path) {
  const target = `${baseUrl}${path}`;
  await cdp.call("Page.navigate", { url: target });
  await waitUntil(
    () => evaluate(cdp, `location.href === ${JSON.stringify(target)} && (document.readyState === 'interactive' || document.readyState === 'complete')`),
    `navigation to ${target}`,
  );
  await settle(cdp);
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

async function assertViewportIntegrity(cdp, stage) {
  const metrics = await evaluate(cdp, `({
    href: location.href,
    title: document.title,
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
    bodyText: (document.body?.innerText || '').slice(0, 200)
  })`);
  assert.ok(metrics.scrollWidth <= metrics.innerWidth + 2, `${stage} has horizontal overflow: ${metrics.scrollWidth}px > ${metrics.innerWidth}px`);
  assert.ok(metrics.bodyText.trim().length > 20, `${stage} rendered suspiciously little visible text`);
  return metrics;
}

async function capture(cdp, filename, stage, manifest) {
  await settle(cdp);
  await evaluate(cdp, "window.scrollTo(0, 0)");
  const metrics = await assertViewportIntegrity(cdp, stage);
  const screenshot = await cdp.call("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  const path = join(outputDir, filename);
  await writeFile(path, Buffer.from(screenshot.data, "base64"));
  manifest.push({ stage, file: filename, ...metrics });
  console.log(`ALPHA VISUAL: captured ${filename} — ${stage}`);
}

async function main() {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  const profileDir = await mkdtemp(join(tmpdir(), "runeforge-alpha-chrome-"));
  const port = await freePort();
  const chromePath = findChrome();
  const chrome = spawn(chromePath, [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--hide-scrollbars",
    "--mute-audio",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    `--window-size=${viewport.width},${viewport.height}`,
    "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });

  let browserStderr = "";
  chrome.stderr.on("data", (chunk) => { browserStderr += String(chunk); });

  let cdp;
  const manifest = [];
  try {
    const websocketUrl = await waitForChrome(port);
    cdp = await CdpClient.connect(websocketUrl);
    await cdp.call("Page.enable");
    await cdp.call("Runtime.enable");
    await cdp.call("Log.enable");
    await cdp.call("Emulation.setDeviceMetricsOverride", viewport);

    await navigate(cdp, "/play");
    await waitForText(cdp, "PRIMEIRO ACESSO · ALPHA JOGÁVEL");
    await capture(cdp, "01-first-run-onboarding.png", "first-run onboarding", manifest);

    await clickText(cdp, "COMEÇAR TREINAMENTO");
    await waitForText(cdp, "Escolha seu deck");
    await capture(cdp, "02-deck-selection.png", "deck selection", manifest);

    await clickText(cdp, "ENTRAR NO NEXUS");
    await waitForText(cdp, "Prepare sua mão inicial", 30_000);
    await capture(cdp, "03-mulligan.png", "mulligan", manifest);

    await clickText(cdp, "Manter mão inicial");
    await waitForSelector(cdp, ".tcg-arena", 30_000);
    await waitForText(cdp, "ARENA DO NEXUS", 30_000);
    await waitForSelector(cdp, ".match-guide-backdrop", 10_000);
    await capture(cdp, "04-first-match-guide.png", "first match guide", manifest);

    await clickText(cdp, "Pular guia");
    await waitUntil(() => evaluate(cdp, "!document.querySelector('.match-guide-backdrop')"), "first match guide to close");
    await capture(cdp, "05-battlefield.png", "live battlefield", manifest);

    const staticStages = [
      ["/collection", "06-collection.png", "collection"],
      ["/forge", "07-forge.png", "forge"],
      ["/modes", "08-modes.png", "PvE modes"],
      ["/profile", "09-profile.png", "profile and progression"],
      ["/codex", "10-codex.png", "codex and help"],
    ];
    for (const [path, file, stage] of staticStages) {
      await navigate(cdp, path);
      await capture(cdp, file, stage, manifest);
    }

    await navigate(cdp, "/play");
    await waitForText(cdp, "Escolha seu deck");
    const onboardingReturned = await evaluate(cdp, "document.body?.innerText?.includes('PRIMEIRO ACESSO · ALPHA JOGÁVEL') === true");
    assert.equal(onboardingReturned, false, "returning player must bypass first-run onboarding");
    await capture(cdp, "11-return-to-play.png", "return-to-play loop", manifest);

    const runtimeExceptions = cdp.notifications.filter((message) => message.method === "Runtime.exceptionThrown");
    assert.equal(runtimeExceptions.length, 0, `browser runtime exceptions detected: ${JSON.stringify(runtimeExceptions.slice(0, 3))}`);

    const report = {
      ok: true,
      baseUrl,
      chrome: chromePath,
      viewport,
      gitSha: process.env.GITHUB_SHA || null,
      capturedAt: new Date().toISOString(),
      screenshots: manifest,
    };
    await writeFile(join(outputDir, "manifest.json"), `${JSON.stringify(report, null, 2)}\n`);
    console.log(`ALPHA VISUAL JOURNEY: PASS — ${manifest.length} real browser screenshots captured in ${outputDir}`);
  } finally {
    try { cdp?.close(); } catch {}
    await shutdownChrome(chrome, profileDir);
  }

  if (browserStderr && process.env.ALPHA_VISUAL_DEBUG === "1") console.error(browserStderr);
}

void main().catch((error) => {
  console.error("ALPHA VISUAL JOURNEY: FAIL", error);
  process.exitCode = 1;
});
