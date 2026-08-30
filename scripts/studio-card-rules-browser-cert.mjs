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
    console.warn(`STUDIO CARD RULES BROWSER CERT: temporary Chrome profile cleanup warning — ${error instanceof Error ? error.message : String(error)}`);
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

async function clickText(cdp, text) {
  const encoded = JSON.stringify(text);
  const clicked = await evaluate(cdp, `(() => {
    const normalize = (value) => (value || '').replace(/\\s+/g, ' ').trim();
    const target = [...document.querySelectorAll('button,a,[role="button"]')]
      .find((element) => !element.disabled && normalize(element.textContent).includes(${encoded}));
    if (!target) return false;
    target.scrollIntoView({ block: 'center', inline: 'center' });
    target.click();
    return true;
  })()`);
  assert.equal(clicked, true, `Could not click control containing text: ${text}`);
}

async function selectLabeledValue(cdp, label, value) {
  const selected = await evaluate(cdp, `(() => {
    const wantedLabel = ${JSON.stringify(label)};
    const wantedValue = ${JSON.stringify(value)};
    const host = [...document.querySelectorAll('label')].find((candidate) => {
      const labelNode = candidate.querySelector('.label');
      return (labelNode?.textContent || '').trim() === wantedLabel;
    });
    const select = host?.querySelector('select');
    if (!select) return null;
    const optionExists = [...select.options].some((option) => option.value === wantedValue || option.textContent === wantedValue);
    if (!optionExists) return { found: true, optionExists: false, current: select.value };
    select.value = wantedValue;
    select.dispatchEvent(new Event('input', { bubbles: true }));
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return { found: true, optionExists: true, current: select.value };
  })()`);
  assert.ok(selected?.found, `Could not locate labeled select: ${label}`);
  assert.equal(selected.optionExists, true, `${label} does not expose option ${value}`);
  assert.equal(selected.current, value, `${label} did not switch to ${value}`);
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
    () => evaluate(cdp, `location.href === ${JSON.stringify(target)} && (document.readyState === 'interactive' || document.readyState === 'complete')`),
    `navigation to ${target}`,
    30_000,
  );
  await settle(cdp);
}

function adminCredentials() {
  const password = process.env.ADMIN_PASSWORD?.trim();
  assert.ok(password, "ADMIN_PASSWORD is required for Studio browser certification");
  return { username: process.env.ADMIN_USERNAME?.trim() || "admin", password };
}

async function loginAdminInBrowser(cdp, credentials) {
  const payload = JSON.stringify({ username: credentials.username, password: credentials.password });
  const result = await evaluate(cdp, `(async () => {
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: ${JSON.stringify(payload)}
    });
    const body = await response.json().catch(() => null);
    return { status: response.status, body };
  })()`);
  assert.equal(result?.status, 200, `Browser admin login failed: ${JSON.stringify(result)}`);
  assert.equal(result?.body?.ok, true, `Browser admin login did not return ok=true: ${JSON.stringify(result?.body)}`);
  return {
    username: result.body.user?.username || credentials.username,
    role: result.body.user?.role || null,
  };
}

async function waitForStudioWorkspace(cdp, timeoutMs = 30_000) {
  return waitUntil(async () => {
    const snapshot = await evaluate(cdp, `(() => ({
      ready: Boolean(document.querySelector('.studio-shell')),
      identityTab: [...document.querySelectorAll('button')].some((button) =>
        (button.textContent || '').replace(/\\s+/g, ' ').trim().toUpperCase().includes('IDENTITY')
      ),
      href: location.href,
      title: document.title,
      bodyText: (document.body?.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 1000)
    }))()`);
    if (snapshot?.ready && snapshot.identityTab) return snapshot;
    throw new Error(`href=${snapshot?.href || 'unknown'} title=${snapshot?.title || 'unknown'} identityTab=${snapshot?.identityTab === true} body=${snapshot?.bodyText || '<empty>'}`);
  }, "authenticated Card Studio workspace with Identity tab", timeoutMs);
}

async function composerEvidence(cdp) {
  return evaluate(cdp, `(() => {
    const composers = [...document.querySelectorAll('[data-studio-effect-composer="semantic"]')];
    return {
      count: composers.length,
      primitives: composers.map((composer) => composer.querySelector('select')?.value || null),
      text: composers.map((composer) => (composer.textContent || '').replace(/\\s+/g, ' ').trim()),
      legacyKindLabelVisible: (document.body?.innerText || '').includes('Efeito (kind)'),
      href: location.href,
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    };
  })()`);
}

async function focusText(cdp, text) {
  const focused = await evaluate(cdp, `(() => {
    const wanted = ${JSON.stringify(text)};
    const target = [...document.querySelectorAll('h1,h2,h3,h4,div,span,p')]
      .find((element) => (element.textContent || '').replace(/\\s+/g, ' ').trim() === wanted);
    if (!target) return false;
    target.scrollIntoView({ block: 'start', inline: 'nearest' });
    window.scrollBy(0, -120);
    return true;
  })()`);
  assert.equal(focused, true, `Could not focus text: ${text}`);
  await sleep(150);
}

async function capture(cdp, filename, stage) {
  await settle(cdp);
  const metrics = await evaluate(cdp, `({
    href: location.href,
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    bodyText: (document.body?.innerText || '').slice(0, 300)
  })`);
  assert.ok(metrics.scrollWidth <= metrics.innerWidth + 2, `${stage} has horizontal overflow: ${metrics.scrollWidth}px > ${metrics.innerWidth}px`);
  assert.ok(metrics.bodyText.trim().length > 20, `${stage} rendered suspiciously little visible text`);
  const screenshot = await cdp.call("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  await writeFile(join(outputDir, filename), Buffer.from(screenshot.data, "base64"));
  console.log(`STUDIO CARD RULES BROWSER CERT: captured ${filename} — ${stage}`);
  return metrics;
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const credentials = adminCredentials();
  const profileDir = await mkdtemp(join(tmpdir(), "runeforge-studio-card-rules-chrome-"));
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
  try {
    const websocketUrl = await waitForChrome(port);
    cdp = await CdpClient.connect(websocketUrl);
    await cdp.call("Page.enable");
    await cdp.call("Runtime.enable");
    await cdp.call("Log.enable");
    await cdp.call("Network.enable");
    await cdp.call("Emulation.setDeviceMetricsOverride", viewport);

    // Establish the browser on the application origin first, then authenticate from
    // the browser itself so the HttpOnly session cookie follows the real production path.
    await navigate(cdp, "/admin/studio/cards");
    const login = await loginAdminInBrowser(cdp, credentials);
    await navigate(cdp, "/admin/studio/cards");
    const workspace = await waitForStudioWorkspace(cdp);
    // Ignore expected unauthenticated bootstrap requests and favicon noise from the
    // pre-login navigation. From this point onward, any browser error is actionable.
    await sleep(250);
    cdp.notifications.length = 0;

    await selectLabeledValue(cdp, "Type", "Spell");
    await clickText(cdp, "Rules");
    await waitForText(cdp, "Spell Contract", 20_000);
    const spellEvidence = await waitUntil(async () => {
      const evidence = await composerEvidence(cdp);
      return evidence.count === 2 ? evidence : null;
    }, "exactly two semantic composers for Spell Rules", 20_000);
    assert.equal(spellEvidence.legacyKindLabelVisible, false, "Legacy Sentinela primitive selector leaked into Spell Rules");
    assert.ok(spellEvidence.scrollWidth <= spellEvidence.innerWidth + 2, "Spell Rules has horizontal overflow");
    await focusText(cdp, "Spell Contract");
    const spellMetrics = await capture(cdp, "24-studio-card-rules-spell.png", "Studio Card Rules — Spell semantic composer");

    await clickText(cdp, "Identity");
    await waitForText(cdp, "CARD DEFINITION", 20_000);
    await selectLabeledValue(cdp, "Type", "Sentinela");
    await clickText(cdp, "Rules");
    await waitForText(cdp, "Sentinela (Planeswalker)", 20_000);
    await clickText(cdp, "+ Adicionar habilidade");
    const sentinelaEvidence = await waitUntil(async () => {
      const evidence = await composerEvidence(cdp);
      return evidence.count === 2 ? evidence : null;
    }, "exactly two semantic composers for Sentinela Rules", 20_000);
    assert.equal(sentinelaEvidence.legacyKindLabelVisible, false, "Legacy Efeito (kind) selector is still visible for Sentinela");
    assert.ok(sentinelaEvidence.text.some((text) => text.includes("Primitive") && text.includes("Target")), "Sentinela semantic composer does not expose Primitive/Target contract");
    assert.ok(sentinelaEvidence.scrollWidth <= sentinelaEvidence.innerWidth + 2, "Sentinela Rules has horizontal overflow");
    await focusText(cdp, "Sentinela (Planeswalker)");
    const sentinelaMetrics = await capture(cdp, "25-studio-card-rules-sentinela.png", "Studio Card Rules — Sentinela semantic composer");

    const severeRuntimeErrors = cdp.notifications.filter((message) =>
      message.method === "Runtime.exceptionThrown" ||
      (message.method === "Log.entryAdded" && ["error", "assert"].includes(message.params?.entry?.level)),
    );
    assert.equal(severeRuntimeErrors.length, 0, `Browser emitted runtime errors: ${JSON.stringify(severeRuntimeErrors.slice(0, 3))}`);

    const evidence = {
      ok: true,
      gitSha: process.env.GITHUB_SHA || null,
      admin: login,
      workspace,
      spell: { ...spellEvidence, screenshot: "24-studio-card-rules-spell.png", metrics: spellMetrics },
      sentinela: { ...sentinelaEvidence, screenshot: "25-studio-card-rules-sentinela.png", metrics: sentinelaMetrics },
    };
    await writeFile(join(outputDir, "24-25-studio-card-rules-browser-cert.json"), `${JSON.stringify(evidence, null, 2)}\n`);
    console.log("STUDIO CARD RULES BROWSER CERT: PASS — Spell and Sentinela render the canonical semantic effect composer in a real browser");
  } catch (error) {
    if (cdp) {
      try {
        const snapshot = await evaluate(cdp, `({ href: location.href, title: document.title, bodyText: (document.body?.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 1000) })`);
        console.error(`--- Studio browser snapshot ---\n${JSON.stringify(snapshot)}`);
      } catch {}
    }
    if (browserStderr.trim()) console.error(`--- Chrome stderr ---\n${browserStderr.slice(-6000)}`);
    throw error;
  } finally {
    if (cdp) cdp.close();
    await shutdownChrome(chrome, profileDir);
  }
}

main().catch((error) => {
  console.error("STUDIO CARD RULES BROWSER CERT: FAIL", error);
  process.exitCode = 1;
});
