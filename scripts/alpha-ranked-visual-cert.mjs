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
  await rm(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => null);
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
    socket.addEventListener("close", () => {
      for (const pending of this.pending.values()) pending.reject(new Error("Chrome DevTools connection closed"));
      this.pending.clear();
    });
  }

  static async connect(url) {
    assert.equal(typeof WebSocket, "function", "Node 22 WebSocket global is required for dependency-free CDP capture");
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
    } catch (error) {
      last = error;
    }
    await sleep(125);
  }
  throw new Error(`Timed out waiting for ${label}${last instanceof Error ? `: ${last.message}` : ""}`);
}

async function settle(cdp) {
  await evaluate(cdp, `Promise.all([document.fonts?.ready || Promise.resolve(), Promise.all([...document.images].map((image) => image.complete ? Promise.resolve() : new Promise((resolveImage) => { image.addEventListener('load', resolveImage, { once:true }); image.addEventListener('error', resolveImage, { once:true }); setTimeout(resolveImage, 3000); })))])`);
  await sleep(300);
}

async function navigate(cdp, path) {
  const target = `${baseUrl}${path}`;
  await cdp.call("Page.navigate", { url: target });
  await waitUntil(() => evaluate(cdp, `location.href === ${JSON.stringify(target)} && ['interactive','complete'].includes(document.readyState)`), `navigation to ${target}`);
  await settle(cdp);
}

async function bootstrapPlayerSession(cdp) {
  const displayName = `Ranked Visual ${Date.now().toString(36)}`;
  return evaluate(cdp, `(async () => {
    const read = async (response) => ({ status: response.status, body: await response.json().catch(() => ({})) });
    const current = await fetch('/api/player', { cache: 'no-store' });
    if (current.ok) return read(current);
    let created = await fetch('/api/player', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ displayName: ${JSON.stringify(displayName)} }),
    });
    if (created.status === 409) {
      created = await fetch('/api/player', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
    }
    return read(created);
  })()`);
}

async function rankedSnapshot(cdp) {
  return evaluate(cdp, `(async () => {
    const response = await fetch('/api/ranked', { cache: 'no-store' });
    return { status: response.status, body: await response.json().catch(() => ({})) };
  })()`);
}

async function rankedEvidence(cdp) {
  return evaluate(cdp, `(() => {
    const q = (selector) => Boolean(document.querySelector(selector));
    const button = [...document.querySelectorAll('button')].find((element) => (element.textContent || '').includes('BUSCAR PARTIDA RANQUEADA'));
    const operation = [...document.querySelectorAll('[aria-label="Estado do competitivo"] > div')][0];
    return {
      href: location.href,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      title: document.title,
      bodyText: document.body?.innerText || '',
      status: q('[aria-label="Estado do competitivo"]'),
      hero: q('[aria-labelledby="rank-card-heading"]'),
      deck: q('[aria-label="Deck ranqueado certificado"]'),
      history: q('[aria-labelledby="ranked-history-heading"]'),
      leaderboard: q('[aria-labelledby="ranked-leaderboard-heading"]'),
      tiers: q('[aria-labelledby="rank-tiers-heading"]'),
      operationText: operation?.textContent?.replace(/\\s+/g, ' ').trim() || '',
      queuePresent: Boolean(button),
      queueDisabled: Boolean(button?.disabled),
    };
  })()`);
}

async function capture(cdp, filename) {
  await settle(cdp);
  const screenshot = await cdp.call("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  await writeFile(join(outputDir, filename), Buffer.from(screenshot.data, "base64"));
}

async function writeDiagnostic(cdp, error) {
  let evidence = null;
  let snapshot = null;
  try { evidence = await rankedEvidence(cdp); } catch {}
  try { snapshot = await rankedSnapshot(cdp); } catch {}
  try { await capture(cdp, "29-ranked-diagnostic.png"); } catch {}
  const report = {
    ok: false,
    gitSha: process.env.GITHUB_SHA || null,
    capturedAt: new Date().toISOString(),
    viewport,
    error: error instanceof Error ? error.message : String(error),
    evidence: evidence ? { ...evidence, bodyText: evidence.bodyText.slice(0, 1200) } : null,
    snapshot: snapshot ? {
      status: snapshot.status,
      ok: snapshot.body?.ok,
      error: snapshot.body?.error,
      rankedEnabled: snapshot.body?.rankedEnabled,
      rankedConfigured: snapshot.body?.rankedConfigured,
      rankedReleaseCertified: snapshot.body?.rankedReleaseCertified,
      season: snapshot.body?.season?.name || null,
    } : null,
    screenshots: ["29-ranked-diagnostic.png"],
  };
  await writeFile(join(outputDir, "ranked-visual-manifest.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.error("ALPHA RANKED VISUAL CERT DIAGNOSTIC", JSON.stringify(report));
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const profileDir = await mkdtemp(join(tmpdir(), "runeforge-ranked-visual-"));
  const chromePath = findChrome();
  const chrome = spawn(chromePath, [
    "--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars", "--mute-audio",
    CHROME_REMOTE_DEBUGGING_FLAG, `--user-data-dir=${profileDir}`, `--window-size=${viewport.width},${viewport.height}`, "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  let browserStderr = "";
  chrome.stderr.on("data", (chunk) => { browserStderr += String(chunk); });

  let cdp;
  try {
    const port = await waitForChromeDevToolsPort({ profileDir, chrome, getStderr: () => browserStderr });
    const websocketUrl = await waitForChrome(port);
    cdp = await CdpClient.connect(websocketUrl);
    await cdp.call("Page.enable");
    await cdp.call("Runtime.enable");
    await cdp.call("Emulation.setDeviceMetricsOverride", viewport);

    try {
      // Establish the public HttpOnly session before mounting Ranked. Recovery UX
      // is already certified by the Alpha journey; this cert isolates Ranked UI.
      await navigate(cdp, "/api/health");
      const session = await bootstrapPlayerSession(cdp);
      assert.ok([200, 201].includes(session.status), `Ranked visual session bootstrap failed: ${JSON.stringify(session)}`);
      assert.equal(session.body?.ok, true, `Ranked visual session bootstrap returned invalid payload: ${JSON.stringify(session)}`);

      await navigate(cdp, "/ranked");
      await waitUntil(
        () => evaluate(cdp, `Boolean(document.querySelector('[aria-label="Estado do competitivo"]')) || document.body?.innerText?.includes('Lobby Ranked indisponível') === true`),
        "Ranked lobby to resolve loading state",
      );

      const snapshot = await rankedSnapshot(cdp);
      assert.equal(snapshot.status, 200, `GET /api/ranked must remain readable for the certified browser session: ${JSON.stringify(snapshot.body)}`);
      assert.equal(snapshot.body?.ok, true, `GET /api/ranked returned invalid snapshot: ${JSON.stringify(snapshot.body)}`);
      assert.equal(snapshot.body?.rankedReleaseCertified, false, "CI must observe Ranked release certification fail-closed");
      assert.equal(snapshot.body?.rankedEnabled, false, "CI must observe Ranked matchmaking disabled while the release gate is closed");

      await waitUntil(() => evaluate(cdp, `Boolean(document.querySelector('[aria-labelledby="rank-card-heading"]'))`), "Ranked current-rank hero");
      await evaluate(cdp, "window.scrollTo(0, 0)");
      const top = await rankedEvidence(cdp);
      assert.ok(top.href.endsWith("/ranked"), `expected /ranked, got ${top.href}`);
      assert.ok(top.scrollWidth <= top.innerWidth + 2, `Ranked has horizontal overflow: ${top.scrollWidth}px > ${top.innerWidth}px`);
      assert.match(top.bodyText, /Ranked do Nexus/);
      assert.match(top.bodyText, /Gate competitivo fechado/);
      assert.match(top.operationText, /Operação\s*Bloqueado\s*fail-closed/);
      assert.ok(top.status && top.hero && top.deck && top.history && top.leaderboard && top.tiers, `Ranked semantic surface incomplete: ${JSON.stringify(top)}`);
      assert.equal(top.queuePresent, true, "Ranked matchmaking CTA must be rendered in the decision zone");
      assert.equal(top.queueDisabled, true, "Ranked matchmaking CTA must stay disabled while the release gate is fail-closed");
      await capture(cdp, "29-ranked-fail-closed.png");

      await evaluate(cdp, `document.querySelector('[aria-labelledby="ranked-history-heading"]')?.scrollIntoView({ block:'start' })`);
      await sleep(250);
      const progression = await rankedEvidence(cdp);
      assert.ok(progression.scrollWidth <= progression.innerWidth + 2, "Ranked progression view must not overflow horizontally");
      assert.ok(progression.history && progression.leaderboard && progression.tiers, "Ranked progression surfaces must remain mounted");
      await capture(cdp, "30-ranked-progression.png");

      const report = {
        ok: true,
        gitSha: process.env.GITHUB_SHA || null,
        capturedAt: new Date().toISOString(),
        viewport,
        authority: {
          status: snapshot.status,
          rankedEnabled: snapshot.body.rankedEnabled,
          rankedConfigured: snapshot.body.rankedConfigured,
          rankedReleaseCertified: snapshot.body.rankedReleaseCertified,
          season: snapshot.body.season?.name || null,
        },
        screenshots: ["29-ranked-fail-closed.png", "30-ranked-progression.png"],
        top: { ...top, bodyText: top.bodyText.slice(0, 600) },
        progression: { ...progression, bodyText: progression.bodyText.slice(0, 600) },
      };
      await writeFile(join(outputDir, "ranked-visual-manifest.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
      console.log("ALPHA RANKED VISUAL CERT: PASS — authoritative fail-closed snapshot + hero + progression screenshots captured");
    } catch (error) {
      await writeDiagnostic(cdp, error);
      throw error;
    }
  } finally {
    try { cdp?.close(); } catch {}
    await shutdownChrome(chrome, profileDir);
  }
}

void main().catch((error) => {
  console.error("ALPHA RANKED VISUAL CERT: FAIL", error);
  process.exitCode = 1;
});