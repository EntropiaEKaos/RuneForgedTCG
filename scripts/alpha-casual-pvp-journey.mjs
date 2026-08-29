import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import net from "node:net";

const baseUrl = (process.env.E2E_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const outputDir = resolve(process.env.ALPHA_VISUAL_DIR || "artifacts/alpha-visual");
const viewport = { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false };
const runId = Date.now().toString(36).slice(-7);
const hostName = `PVP Host ${runId}`;
const guestName = `PVP Guest ${runId}`;

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

async function shutdownBrowser(browser) {
  try { browser.cdp?.close(); } catch {}
  if (browser.chrome.exitCode == null && browser.chrome.signalCode == null) browser.chrome.kill("SIGTERM");
  const terminated = await waitForProcessExit(browser.chrome, 1500);
  if (!terminated && browser.chrome.exitCode == null && browser.chrome.signalCode == null) {
    browser.chrome.kill("SIGKILL");
    await waitForProcessExit(browser.chrome, 2000);
  }
  await rm(browser.profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
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
    assert.equal(typeof WebSocket, "function", "Node 22 WebSocket global is required for CDP certification");
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

async function clickText(cdp, text, exact = false) {
  const encoded = JSON.stringify(text);
  const clicked = await evaluate(cdp, `(() => {
    const normalize = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
    const target = [...document.querySelectorAll('button,a,[role="button"]')]
      .find((element) => !element.disabled && ${exact ? `normalize(element.textContent) === ${encoded}` : `normalize(element.textContent).includes(${encoded})`});
    if (!target) return false;
    target.scrollIntoView({ block: 'center', inline: 'center' });
    target.click();
    return true;
  })()`);
  assert.equal(clicked, true, `Could not click control ${exact ? "equal to" : "containing"} text: ${text}`);
}

async function clickTextPhysical(cdp, text, exact = false) {
  const encoded = JSON.stringify(text);
  await cdp.call("Page.bringToFront");
  const prepared = await evaluate(cdp, `(() => {
    const normalize = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
    const element = [...document.querySelectorAll('button,a,[role="button"]')]
      .find((candidate) => !candidate.disabled && ${exact ? `normalize(candidate.textContent) === ${encoded}` : `normalize(candidate.textContent).includes(${encoded})`});
    if (!element) return false;
    element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    return true;
  })()`);
  assert.equal(prepared, true, `Could not locate physical control ${exact ? "equal to" : "containing"} text: ${text}`);
  await sleep(80);

  const target = await evaluate(cdp, `(() => {
    const normalize = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
    const element = [...document.querySelectorAll('button,a,[role="button"]')]
      .find((candidate) => !candidate.disabled && ${exact ? `normalize(candidate.textContent) === ${encoded}` : `normalize(candidate.textContent).includes(${encoded})`});
    if (!element) return { ok: false, reason: 'missing-after-scroll' };
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    if (rect.width <= 0 || rect.height <= 0 || style.display === 'none' || style.visibility === 'hidden' || style.pointerEvents === 'none') {
      return { ok: false, reason: 'not-visible', rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height }, style: { display: style.display, visibility: style.visibility, pointerEvents: style.pointerEvents } };
    }
    const fractions = [[.5,.5],[.25,.5],[.75,.5],[.5,.25],[.5,.75],[.25,.25],[.75,.25],[.25,.75],[.75,.75]];
    const probes = fractions.map(([fx, fy]) => {
      const x = rect.left + rect.width * fx;
      const y = rect.top + rect.height * fy;
      const hit = document.elementFromPoint(x, y);
      const belongs = Boolean(hit && (hit === element || element.contains(hit)));
      return {
        x, y, belongs,
        hit: hit ? { tag: hit.tagName, className: typeof hit.className === 'string' ? hit.className : '', text: normalize(hit.textContent).slice(0, 100) } : null,
      };
    });
    const usable = probes.find((probe) => probe.belongs);
    return {
      ok: Boolean(usable),
      point: usable ? { x: usable.x, y: usable.y } : null,
      rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      ariaExpanded: element.getAttribute('aria-expanded'),
      probes,
    };
  })()`);
  assert.equal(target?.ok, true, `Physical control is visible but not hit-testable for ${text}: ${JSON.stringify(target)}`);
  console.log(`ALPHA CASUAL PVP: physical hit target ${text}`, JSON.stringify({ point: target.point, rect: target.rect, ariaExpanded: target.ariaExpanded }));
  await cdp.call("Input.dispatchMouseEvent", { type: "mouseMoved", x: target.point.x, y: target.point.y, pointerType: "mouse" });
  await cdp.call("Input.dispatchMouseEvent", { type: "mousePressed", x: target.point.x, y: target.point.y, button: "left", buttons: 1, clickCount: 1, pointerType: "mouse" });
  await cdp.call("Input.dispatchMouseEvent", { type: "mouseReleased", x: target.point.x, y: target.point.y, button: "left", buttons: 0, clickCount: 1, pointerType: "mouse" });
  await sleep(100);
}

async function setInputValue(cdp, selector, value) {
  const encodedSelector = JSON.stringify(selector);
  const encodedValue = JSON.stringify(value);
  const changed = await evaluate(cdp, `(() => {
    const input = document.querySelector(${encodedSelector});
    if (!input) return false;
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    descriptor?.set?.call(input, ${encodedValue});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  assert.equal(changed, true, `Could not set input value for ${selector}`);
}

async function pressKey(cdp, key, code = key) {
  const virtualKeyCode = code === "Space" ? 32 : code === "Enter" ? 13 : 0;
  const base = { key, code, windowsVirtualKeyCode: virtualKeyCode, nativeVirtualKeyCode: virtualKeyCode };
  await cdp.call("Input.dispatchKeyEvent", { type: "keyDown", ...base });
  await cdp.call("Input.dispatchKeyEvent", { type: "keyUp", ...base });
}

async function navigate(cdp, path) {
  const target = path.startsWith("http") || path === "about:blank" ? path : `${baseUrl}${path}`;
  await cdp.call("Page.navigate", { url: target });
  await waitUntil(() => evaluate(cdp, `['interactive','complete'].includes(document.readyState)`), `navigation readiness for ${target}`);
  if (target !== "about:blank") await settle(cdp);
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
  await sleep(220);
}

async function assertViewportIntegrity(cdp, stage) {
  const metrics = await evaluate(cdp, `({
    href: location.href,
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    bodyText: (document.body?.innerText || '').slice(0, 220)
  })`);
  assert.ok(metrics.scrollWidth <= metrics.innerWidth + 2, `${stage} has horizontal overflow: ${metrics.scrollWidth}px > ${metrics.innerWidth}px`);
  assert.ok(metrics.bodyText.trim().length > 20, `${stage} rendered suspiciously little visible text`);
  return metrics;
}

async function capture(browser, filename, stage, manifest) {
  await settle(browser.cdp);
  await evaluate(browser.cdp, "window.scrollTo(0, 0)");
  const metrics = await assertViewportIntegrity(browser.cdp, stage);
  const screenshot = await browser.cdp.call("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  await mkdir(outputDir, { recursive: true });
  await writeFile(join(outputDir, filename), Buffer.from(screenshot.data, "base64"));
  manifest.push({ browser: browser.label, stage, file: filename, ...metrics });
  console.log(`ALPHA CASUAL PVP: captured ${filename} — ${stage}`);
}

async function launchBrowser(label, chromePath) {
  const profileDir = await mkdtemp(join(tmpdir(), `runeforge-pvp-${label}-`));
  const port = await freePort();
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
  let stderr = "";
  chrome.stderr.on("data", (chunk) => { stderr += String(chunk); });
  const websocketUrl = await waitForChrome(port);
  const cdp = await CdpClient.connect(websocketUrl);
  await cdp.call("Page.enable");
  await cdp.call("Runtime.enable");
  await cdp.call("Log.enable");
  await cdp.call("Emulation.setDeviceMetricsOverride", viewport);
  return { label, profileDir, chrome, cdp, get stderr() { return stderr; } };
}

async function registerPlayer(browser, displayName) {
  await navigate(browser.cdp, "/api/health");
  const result = await evaluate(browser.cdp, `(async () => {
    const response = await fetch('/api/player', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: ${JSON.stringify(displayName)} }),
    });
    const body = await response.json().catch(() => ({}));
    return { status: response.status, ok: response.ok, body };
  })()`);
  assert.equal(result.status, 201, `${browser.label} registration failed: ${JSON.stringify(result.body)}`);
  assert.equal(result.body?.ok, true, `${browser.label} registration did not return ok`);
  assert.equal(result.body?.player?.name, displayName, `${browser.label} player name mismatch`);
  return { id: result.body.player.id, name: result.body.player.name };
}

async function fetchRoom(browser, code) {
  return evaluate(browser.cdp, `(async () => {
    const response = await fetch('/api/pvp/${code}', { credentials: 'include', cache: 'no-store' });
    const body = await response.json().catch(() => ({}));
    return { status: response.status, body };
  })()`);
}

function opposite(side) { return side === "player" ? "ai" : side === "ai" ? "player" : side; }

function assertMirrored(hostRoomResponse, guestRoomResponse, label) {
  assert.equal(hostRoomResponse.status, 200, `${label}: host room HTTP ${hostRoomResponse.status}`);
  assert.equal(guestRoomResponse.status, 200, `${label}: guest room HTTP ${guestRoomResponse.status}`);
  const hostRoom = hostRoomResponse.body?.room;
  const guestRoom = guestRoomResponse.body?.room;
  assert.ok(hostRoom?.gameState && guestRoom?.gameState, `${label}: both participants need gameState`);
  assert.equal(hostRoom.code, guestRoom.code, `${label}: room code mismatch`);
  assert.equal(hostRoom.version, guestRoom.version, `${label}: room version mismatch`);
  assert.equal(hostRoom.state, guestRoom.state, `${label}: room lifecycle mismatch`);
  assert.equal(hostRoom.viewerSide, "host", `${label}: host orientation mismatch`);
  assert.equal(guestRoom.viewerSide, "guest", `${label}: guest orientation mismatch`);

  const h = hostRoom.gameState;
  const g = guestRoom.gameState;
  assert.equal(h.seed, 0, `${label}: host public seed must be redacted`);
  assert.equal(g.seed, 0, `${label}: guest public seed must be redacted`);
  assert.equal(h.rngState, 0, `${label}: host public RNG must be redacted`);
  assert.equal(g.rngState, 0, `${label}: guest public RNG must be redacted`);
  assert.equal(h.idCounter, 0, `${label}: host public instance counter must be redacted`);
  assert.equal(g.idCounter, 0, `${label}: guest public instance counter must be redacted`);
  assert.equal(h.round, g.round, `${label}: round mismatch`);
  assert.equal(h.phase, g.phase, `${label}: phase mismatch`);
  assert.equal(g.activePlayer, opposite(h.activePlayer), `${label}: active-player orientation mismatch`);
  assert.equal(g.attackToken, opposite(h.attackToken), `${label}: attack-token orientation mismatch`);
  assert.equal(g.winner, h.winner ? opposite(h.winner) : null, `${label}: winner orientation mismatch`);
  assert.deepEqual(g.mulliganDone, { player: h.mulliganDone.ai, ai: h.mulliganDone.player }, `${label}: mulligan orientation mismatch`);

  const mirrorPlayer = (left, right, side) => {
    assert.equal(left.nexus, right.nexus, `${label}: ${side} nexus mismatch`);
    assert.equal(left.mana, right.mana, `${label}: ${side} mana mismatch`);
    assert.equal(left.maxMana, right.maxMana, `${label}: ${side} max mana mismatch`);
    assert.equal(left.spellMana, right.spellMana, `${label}: ${side} spell mana mismatch`);
    assert.equal(left.hand.length, right.hand.length, `${label}: ${side} hand size mismatch`);
    assert.equal(left.deck.length, right.deck.length, `${label}: ${side} deck size mismatch`);
    assert.equal(left.bench.length, right.bench.length, `${label}: ${side} bench size mismatch`);
    assert.equal(left.permanents.length, right.permanents.length, `${label}: ${side} permanents mismatch`);
    assert.equal(left.sentinelas.length, right.sentinelas.length, `${label}: ${side} Sentinelas mismatch`);
  };
  mirrorPlayer(h.players.player, g.players.ai, "host player");
  mirrorPlayer(h.players.ai, g.players.player, "guest player");
  return { version: hostRoom.version, state: hostRoom.state, hostState: h, guestState: g };
}

async function waitForPvpVersion(browser, version, timeoutMs = 12_000) {
  const expected = `v${version}`;
  return waitUntil(() => evaluate(browser.cdp, `([...document.querySelectorAll('.pvp-status small')].some((node) => (node.textContent || '').trim() === ${JSON.stringify(expected)}))`), `${browser.label} UI PvP version ${expected}`, timeoutMs);
}

async function waitForBattlefield(browser) {
  await waitForSelector(browser.cdp, ".tcg-arena", 30_000);
  await waitForText(browser.cdp, "ARENA DO NEXUS", 30_000);
  const guide = await evaluate(browser.cdp, "Boolean(document.querySelector('.match-guide-backdrop'))");
  if (guide) {
    await clickText(browser.cdp, "Pular guia");
    await waitUntil(() => evaluate(browser.cdp, "!document.querySelector('.match-guide-backdrop')"), `${browser.label} first-match guide to close`);
  }
}

async function waitForRoomVersion(browser, code, minimumVersion, timeoutMs = 12_000) {
  return waitUntil(async () => {
    const room = await fetchRoom(browser, code);
    if (room.status !== 200 || !room.body?.room) return false;
    return room.body.room.version >= minimumVersion ? room : false;
  }, `${browser.label} room version >= ${minimumVersion}`, timeoutMs);
}

async function ensureMulliganConfirmed(browser, code, previousVersion) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await clickText(browser.cdp, "Manter mão inicial");
    const committed = await waitForRoomVersion(browser, code, previousVersion + 1, 5000).catch(() => null);
    if (committed) {
      assert.equal(committed.body.room.gameState?.mulliganDone?.player, true, `${browser.label} authoritative local mulligan must be confirmed`);
      return committed;
    }
    const diagnostic = await evaluate(browser.cdp, `({
      href: location.href,
      pvpStatus: document.querySelector('.pvp-status')?.innerText || '',
      stillInMulligan: (document.body?.innerText || '').includes('Prepare sua mão inicial'),
      hasArena: Boolean(document.querySelector('.tcg-arena')),
      buttons: [...document.querySelectorAll('button')].map((button) => ({ text: (button.textContent || '').replace(/\\s+/g, ' ').trim(), disabled: button.disabled })).filter((button) => button.text).slice(-12)
    })`);
    const latestRoom = await fetchRoom(browser, code).catch(() => null);
    const runtimeExceptions = browser.cdp.notifications.filter((message) => message.method === "Runtime.exceptionThrown").slice(-3);
    console.error(`ALPHA CASUAL PVP: ${browser.label} mulligan attempt ${attempt + 1} did not commit`, JSON.stringify({ diagnostic, latestRoom, runtimeExceptions }));
    await sleep(1450);
  }
  throw new Error(`${browser.label} could not commit mulligan to authoritative room`);
}

async function getDomPhase(browser) {
  return evaluate(browser.cdp, `(() => {
    const arena = document.querySelector('.tcg-arena');
    const roundText = document.querySelector('.tcg-round-pill')?.textContent || '';
    const versionText = [...document.querySelectorAll('.pvp-status small')].map((node) => node.textContent || '').find((text) => /^v\\d+$/.test(text.trim())) || '';
    return {
      phase: arena?.dataset?.matchPhase || null,
      round: Number((roundText.match(/(\\d+)/) || [])[1] || 0),
      version: Number((versionText.match(/(\\d+)/) || [])[1] || 0),
      busy: arena?.dataset?.pvpBusy === 'true',
    };
  })()`);
}

async function passTurn(active, otherParticipant, code, currentVersion) {
  const beforeHostRoom = active.label === "host" ? await fetchRoom(active, code) : await fetchRoom(otherParticipant, code);
  const beforeGuestRoom = active.label === "guest" ? await fetchRoom(active, code) : await fetchRoom(otherParticipant, code);
  const before = assertMirrored(beforeHostRoom, beforeGuestRoom, `before ${active.label} pass v${currentVersion}`);
  const expectedActiveLabel = before.hostState.activePlayer === "player" ? "host" : "guest";
  assert.equal(active.label, expectedActiveLabel, `authoritative v${currentVersion} says ${expectedActiveLabel}, not ${active.label}, owns priority`);
  await waitUntil(async () => (await getDomPhase(active)).phase === "main", `${active.label} to own main phase`, 12_000);
  await pressKey(active.cdp, " ", "Space");
  const nextRoom = await waitForRoomVersion(active, code, currentVersion + 1);
  const nextVersion = nextRoom.body.room.version;
  await waitForPvpVersion(active, nextVersion);
  await waitForPvpVersion(otherParticipant, nextVersion);
  const hostRoom = active.label === "host" ? await fetchRoom(active, code) : await fetchRoom(otherParticipant, code);
  const guestRoom = active.label === "guest" ? await fetchRoom(active, code) : await fetchRoom(otherParticipant, code);
  const mirrored = assertMirrored(hostRoom, guestRoom, `after ${active.label} pass v${nextVersion}`);
  const nextActive = mirrored.hostState.activePlayer === "player"
    ? (active.label === "host" ? active : otherParticipant)
    : (active.label === "guest" ? active : otherParticipant);
  await waitUntil(async () => (await getDomPhase(nextActive)).phase === "main", `${nextActive.label} to own authoritative main phase after v${nextVersion}`, 12_000);
  return { version: mirrored.version, nextActive, mirrored };
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const chromePath = findChrome();
  const manifest = [];
  const host = await launchBrowser("host", chromePath);
  const guest = await launchBrowser("guest", chromePath);

  try {
    const hostIdentity = await registerPlayer(host, hostName);
    const guestIdentity = await registerPlayer(guest, guestName);
    assert.notEqual(hostIdentity.id, guestIdentity.id, "PvP certification requires two independent player identities");

    await navigate(host.cdp, "/pvp");
    await waitForText(host.cdp, "PvP casual", 20_000);
    await waitForText(host.cdp, hostName, 20_000);
    await clickText(host.cdp, "Criar nova sala");
    const roomCode = await waitUntil(() => evaluate(host.cdp, `([...document.querySelectorAll('h2')].map((node) => (node.textContent || '').trim()).find((text) => /^[A-Z2-9]{6}$/.test(text)) || '')`), "host authoritative room code rendered in lobby", 20_000);
    assert.match(roomCode, /^[A-Z2-9]{6}$/);
    await capture(host, "15-pvp-host-lobby.png", "Casual PvP host waiting room", manifest);

    await navigate(guest.cdp, "/pvp");
    await waitForText(guest.cdp, "PvP casual", 20_000);
    await waitForText(guest.cdp, guestName, 20_000);
    await waitForText(guest.cdp, roomCode, 20_000);
    await waitForText(guest.cdp, hostName, 20_000);
    await capture(guest, "16-pvp-guest-lobby.png", "Casual PvP guest sees host room", manifest);

    await setInputValue(guest.cdp, '[aria-label="Código da sala PvP"]', roomCode);
    await clickText(guest.cdp, "Entrar", true);
    const expectedPlayPath = `/play?pvpRoom=${roomCode}`;
    await Promise.all([
      waitUntil(() => evaluate(host.cdp, `location.pathname === '/play' && new URLSearchParams(location.search).get('pvpRoom') === ${JSON.stringify(roomCode)}`), "host redirect to authoritative battlefield", 30_000),
      waitUntil(() => evaluate(guest.cdp, `location.pathname === '/play' && new URLSearchParams(location.search).get('pvpRoom') === ${JSON.stringify(roomCode)}`), "guest redirect to authoritative battlefield", 30_000),
    ]);
    assert.equal(expectedPlayPath, `/play?pvpRoom=${roomCode}`);

    await Promise.all([
      waitForText(host.cdp, "Prepare sua mão inicial", 30_000),
      waitForText(guest.cdp, "Prepare sua mão inicial", 30_000),
    ]);
    await capture(host, "17-pvp-host-mulligan.png", "host PvP mulligan", manifest);
    await capture(guest, "18-pvp-guest-mulligan.png", "guest PvP mulligan", manifest);

    let hostRoom = await fetchRoom(host, roomCode);
    let guestRoom = await fetchRoom(guest, roomCode);
    let mirrored = assertMirrored(hostRoom, guestRoom, "initial room");
    const initialVersion = mirrored.version;
    assert.deepEqual(mirrored.hostState.mulliganDone, { player: false, ai: false }, "initial host view must require mulligan from both humans");
    assert.deepEqual(mirrored.guestState.mulliganDone, { player: false, ai: false }, "initial guest view must require mulligan from both humans");

    const afterHostMulligan = await ensureMulliganConfirmed(host, roomCode, mirrored.version);
    mirrored = assertMirrored(afterHostMulligan, await fetchRoom(guest, roomCode), "after host mulligan");
    assert.deepEqual(mirrored.hostState.mulliganDone, { player: true, ai: false }, "host authoritative mulligan must commit without auto-confirming guest");
    assert.deepEqual(mirrored.guestState.mulliganDone, { player: false, ai: true }, "guest view must mirror host mulligan without auto-confirming itself");
    await sleep(1450);
    const afterGuestMulligan = await ensureMulliganConfirmed(guest, roomCode, mirrored.version);
    mirrored = assertMirrored(await fetchRoom(host, roomCode), afterGuestMulligan, "after guest mulligan");
    assert.deepEqual(mirrored.hostState.mulliganDone, { player: true, ai: true }, "host view must see both human mulligans committed");
    assert.deepEqual(mirrored.guestState.mulliganDone, { player: true, ai: true }, "guest view must see both human mulligans committed");

    await Promise.all([waitForBattlefield(host), waitForBattlefield(guest)]);
    await Promise.all([waitForPvpVersion(host, mirrored.version), waitForPvpVersion(guest, mirrored.version)]);
    await capture(host, "19-pvp-host-battlefield.png", "host authoritative PvP battlefield", manifest);
    await capture(guest, "20-pvp-guest-battlefield.png", "guest authoritative PvP battlefield", manifest);

    // Direct lobbies intentionally start with the host holding first priority.
    // Drive genuine client passes by following the authoritative activePlayer
    // after every committed version. Attack-token round rotation can let the
    // player who ended a round immediately open the next one, so a rigid
    // host/guest alternation would encode a false gameplay rule.
    let version = mirrored.version;
    let active = mirrored.hostState.activePlayer === "player" ? host : guest;
    const submittedBy = new Set();
    let clientPasses = 0;
    while (clientPasses < 4) {
      submittedBy.add(active.label);
      const otherParticipant = active.label === "host" ? guest : host;
      const step = await passTurn(active, otherParticipant, roomCode, version);
      version = step.version;
      active = step.nextActive;
      mirrored = step.mirrored;
      clientPasses += 1;
    }
    assert.deepEqual([...submittedBy].sort(), ["guest", "host"], "both browsers must submit genuine authoritative actions");

    // Reconnection proof specifically advances through the host while the guest
    // is away. If attack-token rotation currently leaves guest priority, keep
    // following authoritative state until host legitimately owns main phase.
    while (active.label !== "host" && clientPasses < 6) {
      submittedBy.add(active.label);
      const step = await passTurn(active, host, roomCode, version);
      version = step.version;
      active = step.nextActive;
      mirrored = step.mirrored;
      clientPasses += 1;
    }
    assert.equal(active.label, "host", "host must legitimately own priority before guest disconnect proof");

    await navigate(guest.cdp, "about:blank");
    await waitUntil(async () => (await getDomPhase(host)).phase === "main", "host main phase before reconnect proof", 12_000);
    await pressKey(host.cdp, " ", "Space");
    const reconnectRoom = await waitForRoomVersion(host, roomCode, version + 1);
    version = reconnectRoom.body.room.version;
    clientPasses += 1;
    await waitForPvpVersion(host, version);

    await navigate(guest.cdp, `/play?pvpRoom=${roomCode}`);
    await waitForBattlefield(guest);
    await waitForPvpVersion(guest, version, 20_000);
    mirrored = assertMirrored(await fetchRoom(host, roomCode), await fetchRoom(guest, roomCode), "after guest reconnect");
    assert.equal(mirrored.version, version, "reconnected guest must recover the current authoritative version");
    await capture(guest, "21-pvp-reconnected-guest.png", "guest restored from authoritative room after reconnect", manifest);

    // Finish through the real in-battle concession UI using physical pointer
    // input through CDP. Hit-testing is required before dispatch so a visually
    // present but overlapped control fails certification instead of being
    // activated through synthetic DOM methods.
    await clickTextPhysical(guest.cdp, "Render-se", true);
    await waitForText(guest.cdp, "Confirmar rendição", 5_000);
    await clickTextPhysical(guest.cdp, "Confirmar rendição", true);

    await Promise.all([
      waitForSelector(host.cdp, ".match-result-backdrop", 20_000),
      waitForSelector(guest.cdp, ".match-result-backdrop", 20_000),
    ]);
    const finalHostRoom = await fetchRoom(host, roomCode);
    const finalGuestRoom = await fetchRoom(guest, roomCode);
    mirrored = assertMirrored(finalHostRoom, finalGuestRoom, "settled forfeit");
    assert.equal(mirrored.state, "finished", "forfeit must finish the authoritative room");
    assert.equal(mirrored.hostState.phase, "gameover", "host public state must reach gameover");
    assert.equal(mirrored.guestState.phase, "gameover", "guest public state must reach gameover");
    assert.equal(mirrored.hostState.winner, "player", "host must win when guest concedes");
    assert.equal(mirrored.guestState.winner, "ai", "guest view must record local defeat after conceding");

    const hostResultText = await evaluate(host.cdp, "document.querySelector('.match-result-card')?.innerText || ''");
    const guestResultText = await evaluate(guest.cdp, "document.querySelector('.match-result-card')?.innerText || ''");
    assert.match(hostResultText, /VITÓRIA/i, "host result UI must show victory after guest concession");
    assert.match(guestResultText, /DERROTA/i, "guest result UI must show defeat after conceding");
    await capture(host, "22-pvp-host-result.png", "host PvP result after authoritative forfeit settlement", manifest);
    await capture(guest, "23-pvp-guest-result.png", "guest PvP result after authoritative concession", manifest);

    for (const browser of [host, guest]) {
      const runtimeExceptions = browser.cdp.notifications.filter((message) => message.method === "Runtime.exceptionThrown");
      assert.equal(runtimeExceptions.length, 0, `${browser.label} browser runtime exceptions detected: ${JSON.stringify(runtimeExceptions.slice(0, 3))}`);
    }

    const report = {
      ok: true,
      baseUrl,
      gitSha: process.env.GITHUB_SHA || null,
      capturedAt: new Date().toISOString(),
      viewport,
      roomCode,
      participants: { host: hostName, guest: guestName },
      initialVersion,
      settledVersion: mirrored.version,
      reconnectRecoveredVersion: version,
      finalWinner: hostName,
      proof: {
        independentStableSessions: true,
        realLobbyUi: true,
        realMulliganUi: true,
        authoritativeClientActions: clientPasses,
        bothParticipantsSubmittedActions: submittedBy.has("host") && submittedBy.has("guest"),
        authoritativeTurnOwnerFollowed: true,
        guestReconnect: true,
        inBattleConcessionUi: true,
        serverSettlement: true,
        participantStateMirroring: true,
        serverOnlyRandomnessRedacted: true,
      },
      screenshots: manifest,
    };
    await writeFile(join(outputDir, "casual-pvp-manifest.json"), `${JSON.stringify(report, null, 2)}\n`);
    console.log(`ALPHA CASUAL PVP JOURNEY: PASS — ${roomCode}, v${initialVersion} → v${mirrored.version}, ${manifest.length} screenshots`);
  } finally {
    await Promise.all([shutdownBrowser(host), shutdownBrowser(guest)]);
    if (process.env.ALPHA_VISUAL_DEBUG === "1") {
      if (host.stderr) console.error(`[host Chrome]\n${host.stderr}`);
      if (guest.stderr) console.error(`[guest Chrome]\n${guest.stderr}`);
    }
  }
}

void main().catch((error) => {
  console.error("ALPHA CASUAL PVP JOURNEY: FAIL", error);
  process.exitCode = 1;
});
