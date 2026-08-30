import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import net from "node:net";

const baseUrl = (process.env.E2E_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const outputDir = resolve(process.env.ALPHA_VISUAL_DIR || "artifacts/alpha-visual");
const screenshotName = "05c-runtime-card-intelligence-tooltip.png";
const evidenceName = "05c-runtime-card-intelligence-tooltip.json";
// Use the official Emberhold preset for the visual/runtime proof. It already
// contains the equipment, anthem and summon-buff primitives this certificate
// needs, so the test does not depend on a just-created custom deck appearing
// in React state before the selection screen renders.
const deckName = "Emberhold Blitz";
const viewport = { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false };
const runtimeDeck = [
  "ember_whelp", "ember_whelp", "ember_whelp",
  "ember_lastbreath", "ember_lastbreath", "ember_lastbreath",
  "ember_phantom", "ember_phantom", "ember_phantom",
  "ember_raider", "ember_raider", "ember_raider",
  "ember_herald", "ember_herald", "ember_herald",
  "ember_sprinter", "ember_sprinter", "ember_sprinter",
  "ember_ashguard",
  "ember_blade", "ember_blade", "ember_blade",
  "ember_soulblade", "ember_soulblade", "ember_soulblade",
  "ember_anvil", "ember_anvil", "ember_anvil",
  "ember_hearth", "ember_hearth", "ember_hearth",
  "ember_drake", "ember_drake", "ember_drake",
  "ember_sire", "ember_sire", "ember_sire",
  "ember_tide_wyrm", "ember_tide_wyrm", "ember_tide_wyrm",
];
assert.equal(runtimeDeck.length, 40, "runtime certification deck must contain exactly 40 cards");

const buffPriorities = [
  "ember_blade",
  "ember_soulblade",
  "ember_anvil",
  "ember_drake",
  "ember_sire",
  "ember_tide_wyrm",
  "ember_hearth",
];
const cheapUnitPriorities = [
  "ember_whelp",
  "ember_lastbreath",
  "ember_phantom",
  "ember_raider",
  "ember_herald",
  "ember_sprinter",
  "ember_drake",
  "ember_ashguard",
  "ember_sire",
  "ember_tide_wyrm",
];
const runtimeBuffPattern = /(Poder\s+[+-][1-9]\d*|Vida máxima\s+[+-][1-9]\d*|Equipamentos\s+[+-][1-9]\d*\/[+-]\d+|Habilidade ganha:|Habilidade perdida:|❄\s*Congelado|✦\s*Atordoado)/i;

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
  await rm(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
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
    assert.equal(typeof WebSocket, "function", "Node 22 WebSocket global is required for CDP capture");
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

async function waitForText(cdp, text, timeoutMs = 20_000) {
  const encoded = JSON.stringify(text);
  return waitUntil(() => evaluate(cdp, `document.body?.innerText?.includes(${encoded}) === true`), `text ${encoded}`, timeoutMs);
}

async function waitForSelector(cdp, selector, timeoutMs = 20_000) {
  const encoded = JSON.stringify(selector);
  return waitUntil(() => evaluate(cdp, `Boolean(document.querySelector(${encoded}))`), `selector ${encoded}`, timeoutMs);
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

async function clickSelector(cdp, selector) {
  const encoded = JSON.stringify(selector);
  return evaluate(cdp, `(() => {
    const target = document.querySelector(${encoded});
    if (!target || target.disabled) return false;
    target.scrollIntoView({ block: 'nearest', inline: 'center' });
    target.click();
    return true;
  })()`);
}

async function hoverSelector(cdp, selector) {
  const encoded = JSON.stringify(selector);
  const point = await evaluate(cdp, `(() => {
    const target = document.querySelector(${encoded});
    if (!target) return null;
    target.scrollIntoView({ block: 'nearest', inline: 'center' });
    const rect = target.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`);
  if (!point) return false;
  await cdp.call("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y });
  return true;
}

async function pressKey(cdp, key, code = key) {
  const virtualKeyCode = code === "Space" ? 32 : code === "Enter" ? 13 : 0;
  const base = { key, code, windowsVirtualKeyCode: virtualKeyCode, nativeVirtualKeyCode: virtualKeyCode };
  await cdp.call("Input.dispatchKeyEvent", { type: "keyDown", ...base });
  await cdp.call("Input.dispatchKeyEvent", { type: "keyUp", ...base });
}

async function navigate(cdp, path) {
  const target = `${baseUrl}${path}`;
  await cdp.call("Page.navigate", { url: target });
  await waitUntil(() => evaluate(cdp, `location.href === ${JSON.stringify(target)} && ['interactive','complete'].includes(document.readyState)`), `navigation to ${target}`);
}

async function seedDeck(cdp) {
  const result = await evaluate(cdp, `(async () => {
    const response = await fetch('/api/decks', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Runtime Tooltip Certification Fixture', emoji: '🧪', formatId: 'eternal', cards: ${JSON.stringify(runtimeDeck)} })
    });
    const body = await response.json();
    return { status: response.status, ...body };
  })()`);
  assert.equal(result?.ok, true, `failed to seed runtime certification support fixture: ${JSON.stringify(result)}`);
  return result.deck;
}

async function currentPhase(cdp) {
  return evaluate(cdp, `(() => {
    const arena = document.querySelector('.tcg-arena');
    const round = document.querySelector('.tcg-round-pill')?.textContent || '';
    return {
      phase: arena?.dataset?.matchPhase || null,
      gameover: Boolean(document.querySelector('.match-result-backdrop')) || arena?.dataset?.matchPhase === 'gameover',
      round,
      boardCount: document.querySelectorAll('[data-bench-side="player"] [data-unit-id]').length,
    };
  })()`);
}

async function playPriorityCard(cdp) {
  const snapshot = await evaluate(cdp, `(() => ({
    hand: [...document.querySelectorAll('#player-hand-cards [data-card-tip-def-id]')].map((host) => ({
      defId: host.dataset.cardTipDefId,
      playable: Boolean(host.querySelector('button:not(:disabled)')),
    })),
    boardCount: document.querySelectorAll('[data-bench-side="player"] [data-unit-id]').length,
  }))()`);

  const playableIds = snapshot.hand.filter((card) => card.playable).map((card) => card.defId);
  const priorities = snapshot.boardCount > 0 ? [...buffPriorities, ...cheapUnitPriorities] : cheapUnitPriorities;
  const chosen = priorities.find((defId) => playableIds.includes(defId)) ?? playableIds[0];
  if (!chosen) return null;

  const selector = `#player-hand-cards [data-card-tip-def-id="${chosen}"] button:not(:disabled)`;
  const clicked = await clickSelector(cdp, selector);
  if (!clicked) return null;
  await sleep(350);

  const targeting = await evaluate(cdp, `Boolean(document.querySelector('[data-bench-side="player"] button[data-card-state="targetable"]'))`);
  if (targeting) {
    const targeted = await clickSelector(cdp, '[data-bench-side="player"] button[data-card-state="targetable"]');
    assert.equal(targeted, true, `runtime certification could not target ally after playing ${chosen}`);
    await sleep(450);
  }
  return chosen;
}

async function findRuntimeEvidence(cdp) {
  const selectors = await evaluate(cdp, `(() => [...document.querySelectorAll('[data-bench-side="player"] [data-unit-id]')]
    .map((host) => ({ defId: host.dataset.cardTipDefId, unitId: host.dataset.unitId }))
    .filter((item) => item.unitId))()`);

  for (const item of selectors) {
    const selector = `[data-bench-side="player"] [data-unit-id="${item.unitId}"]`;
    const hovered = await hoverSelector(cdp, selector);
    if (!hovered) continue;
    await sleep(220);
    const panel = await evaluate(cdp, `(() => {
      const node = document.querySelector('[data-card-intelligence-panel="true"]');
      const host = document.querySelector('[data-tooltip-panel="true"]');
      if (!node || !host) return null;
      const rect = host.getBoundingClientRect();
      return {
        text: node.textContent || '',
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      };
    })()`);
    if (!panel || !runtimeBuffPattern.test(panel.text)) {
      await cdp.call("Input.dispatchMouseEvent", { type: "mouseMoved", x: 2, y: 2 });
      await sleep(80);
      continue;
    }
    assert.ok(panel.width >= 300, `runtime tooltip is unexpectedly narrow: ${panel.width}`);
    assert.ok(panel.left >= 0 && panel.top >= 0, "runtime tooltip escaped top/left viewport bounds");
    assert.ok(panel.right <= panel.viewportWidth + 1, "runtime tooltip escaped right viewport bound");
    assert.ok(panel.bottom <= panel.viewportHeight + 1, "runtime tooltip escaped bottom viewport bound");
    return { ...item, panel };
  }
  return null;
}

async function captureEvidence(cdp, evidence, actionLog) {
  await mkdir(outputDir, { recursive: true });
  const screenshot = await cdp.call("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  await writeFile(join(outputDir, screenshotName), Buffer.from(screenshot.data, "base64"));
  const payload = {
    ok: true,
    type: "runtime-card-intelligence",
    screenshot: screenshotName,
    defId: evidence.defId,
    unitId: evidence.unitId,
    matchedText: evidence.panel.text.match(runtimeBuffPattern)?.[0] ?? null,
    tooltipText: evidence.panel.text,
    actions: actionLog,
    gitSha: process.env.GITHUB_SHA || null,
    capturedAt: new Date().toISOString(),
  };
  await writeFile(join(outputDir, evidenceName), `${JSON.stringify(payload, null, 2)}\n`);

  const manifestPath = join(outputDir, "manifest.json");
  try {
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    manifest.screenshots = Array.isArray(manifest.screenshots) ? manifest.screenshots : [];
    manifest.screenshots.push({
      stage: "runtime buff/debuff card intelligence tooltip",
      file: screenshotName,
      href: `${baseUrl}/play`,
      evidence: evidence.panel.text.match(runtimeBuffPattern)?.[0] ?? null,
    });
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  } catch (error) {
    console.warn(`RUNTIME TOOLTIP: manifest append skipped — ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function driveToRuntimeBuff(cdp, timeoutMs = 150_000) {
  const deadline = Date.now() + timeoutMs;
  const actionLog = [];
  let maxRound = 0;
  while (Date.now() < deadline) {
    const evidence = await findRuntimeEvidence(cdp);
    if (evidence) return { evidence, actionLog, maxRound };

    const snapshot = await currentPhase(cdp);
    const roundMatch = String(snapshot.round || "").match(/(\d+)/);
    if (roundMatch) maxRound = Math.max(maxRound, Number(roundMatch[1]));
    if (snapshot.gameover) throw new Error(`match ended before runtime modifier evidence was captured (round=${maxRound})`);

    if (snapshot.phase === "main") {
      const played = await playPriorityCard(cdp);
      if (played) {
        actionLog.push({ round: maxRound, action: `play:${played}` });
        await sleep(300);
        continue;
      }
      actionLog.push({ round: maxRound, action: "pass-main" });
      await pressKey(cdp, " ", "Space");
      await sleep(260);
      continue;
    }
    if (snapshot.phase === "response") {
      actionLog.push({ round: maxRound, action: "pass-response" });
      await pressKey(cdp, " ", "Space");
      await sleep(260);
      continue;
    }
    if (snapshot.phase === "combat") {
      actionLog.push({ round: maxRound, action: "confirm-combat" });
      await pressKey(cdp, "Enter", "Enter");
      await sleep(260);
      continue;
    }
    await sleep(300);
  }
  throw new Error(`timed out before runtime modifier evidence was captured (round=${maxRound}, actions=${JSON.stringify(actionLog.slice(-12))})`);
}

async function main() {
  const profileDir = await mkdtemp(join(tmpdir(), "runeforge-runtime-tooltip-"));
  const port = await freePort();
  const chromePath = findChrome();
  const chrome = spawn(chromePath, [
    "--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars", "--mute-audio",
    `--remote-debugging-port=${port}`, `--user-data-dir=${profileDir}`, `--window-size=${viewport.width},${viewport.height}`, "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });

  let cdp;
  try {
    const websocketUrl = await waitForChrome(port);
    cdp = await CdpClient.connect(websocketUrl);
    await cdp.call("Page.enable");
    await cdp.call("Runtime.enable");
    await cdp.call("Emulation.setDeviceMetricsOverride", viewport);

    await navigate(cdp, "/play");
    await waitForText(cdp, "PRIMEIRO ACESSO · ALPHA JOGÁVEL", 30_000);
    const deck = await seedDeck(cdp);
    assert.ok(deck?.id, "seeded certification support fixture must expose an id");

    await clickText(cdp, "COMEÇAR TREINAMENTO");
    await waitForText(cdp, "Escolha seu deck", 30_000);
    await waitForText(cdp, deckName, 30_000);
    await clickText(cdp, deckName);
    await waitUntil(() => evaluate(cdp, `(() => [...document.querySelectorAll('button')].some((button) => button.getAttribute('aria-pressed') === 'true' && (button.textContent || '').includes(${JSON.stringify(deckName)})))()`), "runtime certification preset selection");
    await clickText(cdp, "ENTRAR NO NEXUS");
    await waitForText(cdp, "Prepare sua mão inicial", 30_000);
    await clickText(cdp, "Manter mão inicial");
    await waitForSelector(cdp, ".tcg-arena", 30_000);
    await waitForSelector(cdp, ".match-guide-backdrop", 15_000);
    await clickText(cdp, "Pular guia");
    await waitUntil(() => evaluate(cdp, "!document.querySelector('.match-guide-backdrop')"), "first match guide to close");

    const { evidence, actionLog, maxRound } = await driveToRuntimeBuff(cdp);
    await captureEvidence(cdp, evidence, actionLog);
    console.log(`RUNTIME TOOLTIP CERT: PASS — ${evidence.defId} exposed ${evidence.panel.text.match(runtimeBuffPattern)?.[0]} in round ${maxRound}; captured ${screenshotName}`);
  } finally {
    try { cdp?.close(); } catch {}
    await shutdownChrome(chrome, profileDir);
  }
}

void main().catch((error) => {
  console.error("RUNTIME TOOLTIP CERT: FAIL", error);
  process.exitCode = 1;
});
