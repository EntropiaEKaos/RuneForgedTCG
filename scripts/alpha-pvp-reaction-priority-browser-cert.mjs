import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import net from "node:net";
import { Pool } from "pg";

const baseUrl = (process.env.E2E_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("DATABASE_URL is required for PvP reaction browser certification");

const pool = new Pool({ connectionString: databaseUrl, max: 2, application_name: "runeforge-pvp-reaction-browser-cert" });
const viewport = { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false };
const runId = Date.now().toString(36).slice(-7);
const hostName = `Priority Host ${runId}`;
const guestName = `Priority Guest ${runId}`;

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

async function launchBrowser(label, chromePath) {
  const profileDir = await mkdtemp(join(tmpdir(), `runeforge-priority-${label}-`));
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

async function shutdownBrowser(browser) {
  if (!browser) return;
  try { browser.cdp?.close(); } catch {}
  if (browser.chrome.exitCode == null && browser.chrome.signalCode == null) browser.chrome.kill("SIGTERM");
  const terminated = await waitForProcessExit(browser.chrome, 1500);
  if (!terminated && browser.chrome.exitCode == null && browser.chrome.signalCode == null) {
    browser.chrome.kill("SIGKILL");
    await waitForProcessExit(browser.chrome, 2000);
  }
  await rm(browser.profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
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

async function navigate(browser, path) {
  const target = path.startsWith("http") || path === "about:blank" ? path : `${baseUrl}${path}`;
  await browser.cdp.call("Page.navigate", { url: target });
  await waitUntil(() => evaluate(browser.cdp, "['interactive','complete'].includes(document.readyState)"), `${browser.label} navigation ${target}`);
  if (target !== "about:blank") await sleep(250);
}

async function registerPlayer(browser, displayName) {
  await navigate(browser, "/api/health");
  const result = await evaluate(browser.cdp, `(async () => {
    const response = await fetch('/api/player', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: ${JSON.stringify(displayName)} }),
    });
    const body = await response.json().catch(() => ({}));
    return { status: response.status, body };
  })()`);
  assert.equal(result.status, 201, `${browser.label} player registration failed: ${JSON.stringify(result.body)}`);
  assert.equal(result.body?.ok, true, `${browser.label} registration did not return ok`);
  return result.body.player;
}

async function browserJson(browser, path, init = {}) {
  return evaluate(browser.cdp, `(async () => {
    const response = await fetch(${JSON.stringify(path)}, {
      credentials: 'include',
      cache: 'no-store',
      ...${JSON.stringify(init)},
      headers: { 'Content-Type': 'application/json', ...(${JSON.stringify(init.headers || {})}) },
    });
    const body = await response.json().catch(() => ({}));
    return { status: response.status, body };
  })()`);
}

async function fetchRoom(browser, code) {
  return browserJson(browser, `/api/pvp/${code}`);
}

async function createRoom(host) {
  const result = await browserJson(host, "/api/pvp", {
    method: "POST",
    body: JSON.stringify({ hostDeck: "ember_aggro" }),
  });
  assert.equal(result.status, 200, `host room creation failed: ${JSON.stringify(result.body)}`);
  assert.equal(result.body?.ok, true, "host room creation did not return ok");
  assert.match(result.body.room.code, /^[A-Z2-9]{6}$/);
  return result.body.room;
}

async function joinRoom(guest, code) {
  const result = await browserJson(guest, `/api/pvp/${code}`, {
    method: "POST",
    body: JSON.stringify({ action: "join", guestDeck: "tide_control" }),
  });
  assert.equal(result.status, 200, `guest room join failed: ${JSON.stringify(result.body)}`);
  assert.equal(result.body?.ok, true, "guest room join did not return ok");
  assert.equal(result.body.room.state, "playing");
  return result.body.room;
}

async function installDeterministicFixture(code) {
  const result = await pool.query("select id, version, game_state from pvp_rooms where code=$1 limit 1", [code]);
  const room = result.rows[0];
  assert.ok(room?.game_state, "joined PvP room must have authoritative GameState before fixture injection");
  const state = structuredClone(room.game_state);
  state.phase = "main";
  state.activePlayer = "player";
  state.attackToken = "player";
  state.winner = null;
  state.combat = null;
  state.mulliganDone = { player: true, ai: true };
  state.players.player.mana = 10;
  state.players.player.maxMana = 10;
  state.players.player.spellMana = 0;
  state.players.player.hand = [
    { instanceId: "priority-unit-1", defId: "ember_whelp" },
    { instanceId: "priority-unit-2", defId: "ember_whelp" },
  ];
  state.players.player.bench = [];
  state.players.player.permanents = [];
  state.players.player.sentinelas = [];
  state.players.ai.mana = 10;
  state.players.ai.maxMana = 10;
  state.players.ai.spellMana = 0;
  state.players.ai.hand = [{ instanceId: "priority-counter", defId: "tide_deny" }];
  state.players.ai.bench = [];
  state.players.ai.permanents = [];
  state.players.ai.sentinelas = [];
  state.log = ["PvP reaction-priority browser certification fixture ready."];

  const nextVersion = Number(room.version) + 1;
  const update = await pool.query(`
    update pvp_rooms
    set game_state=$1::jsonb,
        reaction_state=null,
        action_log='[]'::jsonb,
        event_log='[]'::jsonb,
        winner=null,
        version=$2,
        expires_at=now() + interval '1 hour',
        updated_at=now()
    where id=$3 and version=$4
    returning id, version
  `, [JSON.stringify(state), nextVersion, room.id, room.version]);
  assert.equal(update.rowCount, 1, "deterministic PvP browser fixture must update through version CAS");
  return { roomId: Number(room.id), version: nextVersion };
}

async function waitForBattlefield(browser) {
  await waitUntil(() => evaluate(browser.cdp, "Boolean(document.querySelector('.tcg-arena'))"), `${browser.label} battlefield`, 30_000);
  await waitUntil(() => evaluate(browser.cdp, "document.body?.innerText?.includes('ARENA DO NEXUS') === true"), `${browser.label} battlefield heading`, 30_000);
  const guide = await evaluate(browser.cdp, "Boolean(document.querySelector('.match-guide-backdrop'))");
  if (guide) {
    const closed = await evaluate(browser.cdp, `(() => {
      const button = [...document.querySelectorAll('button')].find((node) => (node.textContent || '').includes('Pular guia'));
      if (!button) return false;
      button.click();
      return true;
    })()`);
    assert.equal(closed, true, `${browser.label} could not close first-match guide`);
    await waitUntil(() => evaluate(browser.cdp, "!document.querySelector('.match-guide-backdrop')"), `${browser.label} guide closed`);
  }
}

async function waitForUiVersion(browser, version, timeoutMs = 20_000) {
  const expected = JSON.stringify(`v${version}`);
  return waitUntil(() => evaluate(browser.cdp, `([...document.querySelectorAll('.pvp-status small')].some((node) => (node.textContent || '').trim() === ${expected}))`), `${browser.label} UI version v${version}`, timeoutMs);
}

async function waitForRoomVersion(browser, code, minimumVersion, timeoutMs = 20_000) {
  return waitUntil(async () => {
    const result = await fetchRoom(browser, code);
    if (result.status !== 200 || !result.body?.room) return false;
    return result.body.room.version >= minimumVersion ? result : false;
  }, `${browser.label} room version >= ${minimumVersion}`, timeoutMs);
}

async function clickHandCard(browser, defId) {
  const selector = `[aria-label="Sua mão"] [data-card-tip-def-id="${defId}"] > button:not([disabled])`;
  await waitUntil(() => evaluate(browser.cdp, `Boolean(document.querySelector(${JSON.stringify(selector)}))`), `${browser.label} playable ${defId}`, 15_000);
  const clicked = await evaluate(browser.cdp, `(() => {
    const button = document.querySelector(${JSON.stringify(selector)});
    if (!button) return false;
    button.scrollIntoView({ block: 'center', inline: 'center' });
    button.click();
    return true;
  })()`);
  assert.equal(clicked, true, `${browser.label} could not click ${defId}`);
}

async function clickPassPriority(browser) {
  await waitUntil(() => evaluate(browser.cdp, "Boolean(document.querySelector('.reaction-stack'))"), `${browser.label} reaction stack`, 15_000);
  const clicked = await evaluate(browser.cdp, `(() => {
    const button = [...document.querySelectorAll('.reaction-stack button')].find((node) => (node.textContent || '').includes('Passar prioridade e resolver'));
    if (!button || button.disabled) return false;
    button.click();
    return true;
  })()`);
  assert.equal(clicked, true, `${browser.label} could not pass reaction priority`);
}

async function assertOpenPriority(host, guest, code, version, label) {
  const [hostRoomResult, guestRoomResult] = await Promise.all([fetchRoom(host, code), fetchRoom(guest, code)]);
  assert.equal(hostRoomResult.status, 200, `${label}: host room fetch failed`);
  assert.equal(guestRoomResult.status, 200, `${label}: guest room fetch failed`);
  const hostRoom = hostRoomResult.body.room;
  const guestRoom = guestRoomResult.body.room;
  assert.equal(hostRoom.version, version, `${label}: host version mismatch`);
  assert.equal(guestRoom.version, version, `${label}: guest version mismatch`);
  assert.equal(hostRoom.reactionState?.actor, "player", `${label}: host must see itself as action owner`);
  assert.equal(hostRoom.reactionState?.responder, "ai", `${label}: host must see remote responder`);
  assert.equal(guestRoom.reactionState?.actor, "ai", `${label}: guest must see remote action owner`);
  assert.equal(guestRoom.reactionState?.responder, "player", `${label}: guest must own local priority`);
  assert.equal(hostRoom.reactionState?.pendingAction?.instanceId, guestRoom.reactionState?.pendingAction?.instanceId, `${label}: pending frame instance id must survive orientation`);
  assert.equal(hostRoom.gameState.players.player.hand.filter((card) => card.defId === "ember_whelp").length, 2 - (label.includes("second") ? 1 : 0), `${label}: pending host unit must remain in pre-action hand`);
  await Promise.all([waitForUiVersion(host, version), waitForUiVersion(guest, version)]);
  await waitUntil(() => evaluate(host.cdp, "document.querySelector('.tcg-arena')?.dataset?.pvpReactionPriority === 'ai'"), `${label}: host remote-priority UI`);
  await waitUntil(() => evaluate(guest.cdp, "document.querySelector('.tcg-arena')?.dataset?.pvpReactionPriority === 'player'"), `${label}: guest local-priority UI`);
  await waitUntil(() => evaluate(host.cdp, "document.body?.innerText?.includes('Aguardando a resposta do adversário') === true"), `${label}: host waiting banner`);
  await waitUntil(() => evaluate(guest.cdp, "Boolean(document.querySelector('.reaction-stack')) && document.body?.innerText?.includes('PRIORIDADE ABERTA') === true"), `${label}: guest reaction UI`);
  return { hostRoom, guestRoom };
}

async function assertResolvedBoard(host, guest, code, version, expectedUnits, label) {
  const [hostRoomResult, guestRoomResult] = await Promise.all([fetchRoom(host, code), fetchRoom(guest, code)]);
  assert.equal(hostRoomResult.status, 200, `${label}: host room fetch failed`);
  assert.equal(guestRoomResult.status, 200, `${label}: guest room fetch failed`);
  const hostRoom = hostRoomResult.body.room;
  const guestRoom = guestRoomResult.body.room;
  assert.equal(hostRoom.version, version, `${label}: host version mismatch`);
  assert.equal(guestRoom.version, version, `${label}: guest version mismatch`);
  assert.equal(hostRoom.reactionState, null, `${label}: host reaction state must close`);
  assert.equal(guestRoom.reactionState, null, `${label}: guest reaction state must close`);
  assert.equal(hostRoom.gameState.players.player.bench.filter((unit) => unit.defId === "ember_whelp").length, expectedUnits, `${label}: authoritative host bench mismatch`);
  assert.equal(guestRoom.gameState.players.ai.bench.filter((unit) => unit.defId === "ember_whelp").length, expectedUnits, `${label}: guest mirrored opponent bench mismatch`);
  assert.equal(hostRoom.gameState.players.player.hand.filter((card) => card.defId === "ember_whelp").length, 2 - expectedUnits, `${label}: host resolved hand mismatch`);
  await Promise.all([waitForUiVersion(host, version), waitForUiVersion(guest, version)]);
  await waitUntil(() => evaluate(host.cdp, "document.querySelector('.tcg-arena')?.dataset?.pvpReactionPriority === 'none'"), `${label}: host priority cleared`);
  await waitUntil(() => evaluate(guest.cdp, "document.querySelector('.tcg-arena')?.dataset?.pvpReactionPriority === 'none'"), `${label}: guest priority cleared`);
  return { hostRoom, guestRoom };
}

async function cleanupRoom(roomId, roomCode) {
  if (!roomId) return;
  await pool.query("delete from pvp_action_receipts where room_id=$1", [roomId]).catch(() => undefined);
  await pool.query("delete from pvp_spectator_snapshots where room_id=$1", [roomId]).catch(() => undefined);
  await pool.query("delete from chat_messages where room_code=$1", [roomCode]).catch(() => undefined);
  await pool.query("delete from pvp_rooms where id=$1", [roomId]).catch(() => undefined);
}

async function main() {
  const chromePath = findChrome();
  let host = null;
  let guest = null;
  let roomId = null;
  let roomCode = null;
  try {
    host = await launchBrowser("host", chromePath);
    guest = await launchBrowser("guest", chromePath);
    const [hostIdentity, guestIdentity] = await Promise.all([
      registerPlayer(host, hostName),
      registerPlayer(guest, guestName),
    ]);
    assert.notEqual(hostIdentity.id, guestIdentity.id, "priority certification requires two independent stable browser sessions");

    const room = await createRoom(host);
    roomCode = room.code;
    await joinRoom(guest, roomCode);
    const fixture = await installDeterministicFixture(roomCode);
    roomId = fixture.roomId;
    let version = fixture.version;

    await Promise.all([
      navigate(host, `/play?pvpRoom=${roomCode}`),
      navigate(guest, `/play?pvpRoom=${roomCode}`),
    ]);
    await Promise.all([waitForBattlefield(host), waitForBattlefield(guest)]);
    await Promise.all([waitForUiVersion(host, version), waitForUiVersion(guest, version)]);

    const initialHost = await fetchRoom(host, roomCode);
    const initialGuest = await fetchRoom(guest, roomCode);
    assert.equal(initialHost.body.room.gameState.activePlayer, "player", "host must own deterministic opening main phase");
    assert.equal(initialGuest.body.room.gameState.activePlayer, "ai", "guest view must mirror host opening main phase");
    assert.equal(initialGuest.body.room.gameState.players.player.hand.some((card) => card.defId === "tide_deny"), true, "guest browser must receive its Tide Deny response card");

    // 1) A real host browser action opens persisted priority without applying the unit yet.
    await clickHandCard(host, "ember_whelp");
    const firstOpenResult = await waitForRoomVersion(host, roomCode, version + 1);
    version = firstOpenResult.body.room.version;
    await assertOpenPriority(host, guest, roomCode, version, "first persisted priority");

    // 2) Reconnect the responder while the window is still open. The room, not
    // local React state, must restore the exact same priority ownership/frame.
    await navigate(guest, "about:blank");
    await navigate(guest, `/play?pvpRoom=${roomCode}`);
    await waitForBattlefield(guest);
    await assertOpenPriority(host, guest, roomCode, version, "first persisted priority after guest reconnect");

    // 3) Explicit historical `resolve` from the responder closes the window and
    // only then applies the pending unit.
    await clickPassPriority(guest);
    const firstResolvedResult = await waitForRoomVersion(host, roomCode, version + 1);
    version = firstResolvedResult.body.room.version;
    await assertResolvedBoard(host, guest, roomCode, version, 1, "explicit priority pass");

    // 4) Open a second real window, disconnect the responder, and prove that
    // host polling causes the server-side deadline resolver to advance the room.
    await clickHandCard(host, "ember_whelp");
    const secondOpenResult = await waitForRoomVersion(host, roomCode, version + 1);
    version = secondOpenResult.body.room.version;
    await assertOpenPriority(host, guest, roomCode, version, "second persisted priority");
    await navigate(guest, "about:blank");

    const timedOutResult = await waitForRoomVersion(host, roomCode, version + 1, 16_000);
    version = timedOutResult.body.room.version;
    assert.equal(timedOutResult.body.room.reactionState, null, "server timeout must clear persisted priority while responder is disconnected");
    assert.equal(timedOutResult.body.room.gameState.players.player.bench.filter((unit) => unit.defId === "ember_whelp").length, 2, "server timeout must resolve the second pending unit exactly once");

    await navigate(guest, `/play?pvpRoom=${roomCode}`);
    await waitForBattlefield(guest);
    await assertResolvedBoard(host, guest, roomCode, version, 2, "timeout plus reconnect resolution");
    assert.equal(await evaluate(guest.cdp, "Boolean(document.querySelector('.reaction-stack'))"), false, "reconnected guest must not resurrect an expired reaction window");

    for (const browser of [host, guest]) {
      const runtimeExceptions = browser.cdp.notifications.filter((message) => message.method === "Runtime.exceptionThrown");
      assert.equal(runtimeExceptions.length, 0, `${browser.label} browser runtime exceptions detected: ${JSON.stringify(runtimeExceptions.slice(0, 3))}`);
    }

    console.log(`ALPHA PVP REACTION PRIORITY BROWSER CERT: PASS — ${roomCode}, persisted open + guest orientation + reconnect + explicit pass + server timeout + mirrored resolution`);
  } finally {
    await cleanupRoom(roomId, roomCode);
    await Promise.all([shutdownBrowser(host), shutdownBrowser(guest)]);
    await pool.end().catch(() => undefined);
    if (process.env.ALPHA_VISUAL_DEBUG === "1") {
      if (host?.stderr) console.error(`[priority host Chrome]\n${host.stderr}`);
      if (guest?.stderr) console.error(`[priority guest Chrome]\n${guest.stderr}`);
    }
  }
}

void main().catch((error) => {
  console.error("ALPHA PVP REACTION PRIORITY BROWSER CERT: FAIL", error);
  process.exitCode = 1;
});
