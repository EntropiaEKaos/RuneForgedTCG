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
  const displayName = `Forge Visual ${Date.now().toString(36)}`;
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
      created = await fetch('/api/player', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    }
    return read(created);
  })()`);
}

async function forgeEvidence(cdp) {
  return evaluate(cdp, `(() => {
    const q = (selector) => Boolean(document.querySelector(selector));
    const catalog = document.querySelector('[aria-label="Catálogo de cartas para o deck"]');
    const deck = document.querySelector('[aria-label="Deck em construção"]');
    const summary = document.querySelector('[aria-label="Resumo da Forja"]');
    const playableCards = catalog ? [...catalog.querySelectorAll('.card-shell[data-card-state="playable"]')] : [];
    const removeButtons = deck ? [...deck.querySelectorAll('button[aria-label^="Remover uma cópia de "]')] : [];
    return {
      href: location.href,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      bodyText: document.body?.innerText || '',
      summary: Boolean(summary),
      editor: q('[aria-labelledby="forge-editor-heading"]'),
      saved: q('[aria-labelledby="saved-decks-heading"]'),
      catalogHeader: q('[aria-labelledby="forge-catalog-heading"]'),
      catalog: Boolean(catalog),
      deck: Boolean(deck),
      insight: q('.forge-insight'),
      progress: q('[role="progressbar"][aria-label="Preenchimento do deck"]'),
      playableCardCount: playableCards.length,
      deckEntryCount: removeButtons.length,
      summaryText: summary?.textContent?.replace(/\\s+/g, ' ').trim() || '',
      deckText: deck?.textContent?.replace(/\\s+/g, ' ').trim() || '',
    };
  })()`);
}

async function addThreeDistinctCards(cdp) {
  return evaluate(cdp, `(() => {
    const catalog = document.querySelector('[aria-label="Catálogo de cartas para o deck"]');
    if (!catalog) return 0;
    const buttons = [...catalog.querySelectorAll('.card-shell[data-card-state="playable"]')].filter((button) => !button.disabled);
    const picked = [];
    const seen = new Set();
    for (const button of buttons) {
      const label = button.getAttribute('aria-label') || '';
      if (!label || seen.has(label)) continue;
      seen.add(label);
      button.click();
      picked.push(label);
      if (picked.length === 3) break;
    }
    return picked.length;
  })()`);
}

async function capture(cdp, filename) {
  await settle(cdp);
  const screenshot = await cdp.call("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  await writeFile(join(outputDir, filename), Buffer.from(screenshot.data, "base64"));
}

async function writeDiagnostic(cdp, error) {
  let evidence = null;
  try { evidence = await forgeEvidence(cdp); } catch {}
  try { await capture(cdp, "36-deck-builder-diagnostic.png"); } catch {}
  const report = {
    ok: false,
    gitSha: process.env.GITHUB_SHA || null,
    capturedAt: new Date().toISOString(),
    viewport,
    error: error instanceof Error ? error.message : String(error),
    evidence: evidence ? { ...evidence, bodyText: evidence.bodyText.slice(0, 1400) } : null,
    screenshots: ["36-deck-builder-diagnostic.png"],
  };
  await writeFile(join(outputDir, "deck-builder-visual-manifest.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.error("ALPHA DECK BUILDER VISUAL CERT DIAGNOSTIC", JSON.stringify(report));
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const profileDir = await mkdtemp(join(tmpdir(), "runeforge-deck-builder-visual-"));
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
      await navigate(cdp, "/api/health");
      const session = await bootstrapPlayerSession(cdp);
      assert.ok([200, 201].includes(session.status), `Deck Builder visual session bootstrap failed: ${JSON.stringify(session)}`);
      assert.equal(session.body?.ok, true, `Deck Builder session bootstrap returned invalid payload: ${JSON.stringify(session)}`);

      await navigate(cdp, "/forge");
      await waitUntil(() => evaluate(cdp, `Boolean(document.querySelector('[aria-label="Deck em construção"]') && document.querySelector('[aria-label="Catálogo de cartas para o deck"] .card-shell[data-card-state="playable"]'))`), "Forge workbench");
      await evaluate(cdp, "window.scrollTo(0, 0)");
      const initial = await forgeEvidence(cdp);
      assert.ok(initial.href.endsWith("/forge"), `expected /forge, got ${initial.href}`);
      assert.ok(initial.scrollWidth <= initial.innerWidth + 2, `Forge has horizontal overflow: ${initial.scrollWidth}px > ${initial.innerWidth}px`);
      assert.match(initial.bodyText, /Forja de Decks/);
      assert.ok(initial.summary && initial.editor && initial.saved && initial.catalogHeader && initial.catalog && initial.deck && initial.insight && initial.progress, `Forge semantic surface incomplete: ${JSON.stringify(initial)}`);
      assert.ok(initial.playableCardCount >= 3, "Deck Builder certificate requires at least three playable catalog cards");
      assert.equal(initial.deckEntryCount, 0, "Fresh Deck Builder certificate must begin with an empty local composition");
      await capture(cdp, "36-deck-builder-workbench.png");

      const added = await addThreeDistinctCards(cdp);
      assert.equal(added, 3, "Deck Builder certificate must click three distinct real catalog cards");
      await waitUntil(() => evaluate(cdp, `document.querySelectorAll('[aria-label="Deck em construção"] button[aria-label^="Remover uma cópia de "]').length === 3`), "three-card local Forge composition");
      await evaluate(cdp, `document.querySelector('[aria-label="Deck em construção"]')?.scrollIntoView({ block:'start' })`);
      await sleep(250);
      const composed = await forgeEvidence(cdp);
      assert.ok(composed.scrollWidth <= composed.innerWidth + 2, "Deck Builder composition view must not overflow horizontally");
      assert.equal(composed.deckEntryCount, 3, "Deck Builder side panel must show three distinct composition entries");
      assert.match(composed.summaryText, /3\//, "Forge summary must reflect three locally selected cards");
      assert.ok(composed.insight && composed.deck, "Deck Builder diagnosis and side panel must remain mounted after composition changes");
      await capture(cdp, "37-deck-builder-composition.png");

      const report = {
        ok: true,
        gitSha: process.env.GITHUB_SHA || null,
        capturedAt: new Date().toISOString(),
        viewport,
        authority: {
          serverDeckMutation: false,
          localCardsAdded: 3,
          saveInvoked: false,
          shareInvoked: false,
        },
        evidence: {
          initial: { scrollWidth: initial.scrollWidth, playableCardCount: initial.playableCardCount, deckEntryCount: initial.deckEntryCount },
          composed: { scrollWidth: composed.scrollWidth, deckEntryCount: composed.deckEntryCount, summaryText: composed.summaryText, deckText: composed.deckText.slice(0, 500) },
        },
        screenshots: ["36-deck-builder-workbench.png", "37-deck-builder-composition.png"],
      };
      await writeFile(join(outputDir, "deck-builder-visual-manifest.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
      console.log("ALPHA DECK BUILDER VISUAL CERT: PASS — premium Forge workbench renders and three real catalog cards compose locally without server deck mutation");
    } catch (error) {
      await writeDiagnostic(cdp, error);
      throw error;
    }
  } finally {
    cdp?.close();
    await shutdownChrome(chrome, profileDir);
  }
}

main().catch((error) => {
  console.error("ALPHA DECK BUILDER VISUAL CERT: FAIL", error);
  process.exitCode = 1;
});
