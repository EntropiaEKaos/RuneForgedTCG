import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { CHROME_REMOTE_DEBUGGING_FLAG, waitForChromeDevToolsPort } from "./chrome-devtools-bootstrap.mjs";

const baseUrl = (process.env.E2E_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const outputDir = resolve(process.env.ALPHA_VISUAL_DIR || "artifacts/alpha-visual");
const deckName = "Activated Ability Browser Cert";
const evidenceName = "05d-05f-activated-ability-browser-cert.json";
const blockedScreenshot = "05d-activated-ability-blocked.png";
const readyScreenshot = "05e-activated-ability-ready.png";
const usedScreenshot = "05f-activated-ability-used.png";
const viewport = { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false };

const sourceDefId = "van_tide_u15";
const sourcePlayRound = 6;
const sourceRefreshRound = 7;
const maxDefensiveBench = 5;
const maxTokenAttempts = 64;

// Cost-6 Sábio das Nove Correntes pays 2 mana + exhaust for its native draw ability.
// Playing it on round 6 spends all regular mana, so the real battlefield must show
// "Mana insuficiente"; round 7 refresh then proves ready → used without requiring
// a fragile round-8 survival scenario.
const defensiveUnits = [
  "tide_tidebarrier",
  "tide_guard",
  "tide_mystic",
  "tide_frostguard",
  "tide_mystic_2",
  "forest_canopy_warden",
  "forest_moonfang",
  "forest_stalker",
  "tide_oracle",
  "forest_packrunner",
  "forest_cub",
  "tide_sprite",
  "ember_whelp",
];

const certificationDeck = [
  sourceDefId, sourceDefId, sourceDefId,
  "tide_tidebarrier", "tide_tidebarrier", "tide_tidebarrier",
  "tide_guard", "tide_guard", "tide_guard",
  "tide_mystic", "tide_mystic", "tide_mystic",
  "tide_frostguard", "tide_frostguard", "tide_frostguard",
  "tide_mystic_2", "tide_mystic_2", "tide_mystic_2",
  "forest_canopy_warden", "forest_canopy_warden", "forest_canopy_warden",
  "forest_moonfang", "forest_moonfang", "forest_moonfang",
  "forest_stalker", "forest_stalker", "forest_stalker",
  "tide_oracle", "tide_oracle", "tide_oracle",
  "forest_packrunner", "forest_packrunner", "forest_packrunner",
  "forest_cub", "forest_cub", "forest_cub",
  "tide_sprite", "tide_sprite", "tide_sprite",
  "ember_whelp",
];
assert.equal(certificationDeck.length, 40, "browser certification deck must contain exactly 40 cards");

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
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
    assert.equal(typeof WebSocket, "function", "Node 22 WebSocket global is required for CDP capture");
    const socket = new WebSocket(url);
    await new Promise((resolvePromise, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timed out opening Chrome DevTools WebSocket")), 10_000);
      socket.addEventListener("open", () => {
        clearTimeout(timeout);
        resolvePromise();
      }, { once: true });
      socket.addEventListener("error", () => {
        clearTimeout(timeout);
        reject(new Error("Failed to open Chrome DevTools WebSocket"));
      }, { once: true });
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
  assert.ok(point, `Could not locate hover target: ${selector}`);
  await cdp.call("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y });
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
  await waitUntil(
    () => evaluate(cdp, `location.href === ${JSON.stringify(target)} && ['interactive','complete'].includes(document.readyState)`),
    `navigation to ${target}`,
  );
}

function nextRng(state) {
  let x = (state >>> 0) || 1;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  x >>>= 0;
  return { state: x || 1, value: (x >>> 0) / 4294967296 };
}

function seededShuffle(cards, seed) {
  const out = [...cards];
  let rng = (Math.trunc(seed) >>> 0) || 1;
  for (let i = out.length - 1; i > 0; i--) {
    const next = nextRng(rng);
    rng = next.state;
    const j = Math.floor(next.value * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

async function seedDeck(cdp, attempt) {
  const candidateName = `${deckName} ${String(attempt).padStart(2, "0")}`;
  const result = await evaluate(cdp, `(async () => {
    const response = await fetch('/api/decks', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: ${JSON.stringify(candidateName)},
        emoji: '⚙️',
        formatId: 'eternal',
        cards: ${JSON.stringify(certificationDeck)}
      })
    });
    const body = await response.json();
    return { status: response.status, ...body };
  })()`);
  assert.equal(result?.ok, true, `failed to seed activated ability certification deck ${attempt}: ${JSON.stringify(result)}`);
  assert.ok(result.deck?.id, "seeded certification deck must expose an id");
  assert.equal(result.deck.cards?.length, 40, "server must preserve the 40-card certification deck");
  return result.deck;
}

async function issueAuthoritativeToken(cdp, deckId) {
  return evaluate(cdp, `(async () => {
    const response = await fetch('/api/matches/token', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deckId: ${JSON.stringify(deckId)}, difficulty: 'apprentice' })
    });
    const body = await response.json();
    return { status: response.status, ...body };
  })()`);
}

async function prepareAuthoritativeFixture(cdp) {
  const attempts = [];
  for (let attempt = 1; attempt <= maxTokenAttempts; attempt++) {
    // Match tokens are deterministic for a given custom deck id. Create a fresh
    // deck id per attempt so the server produces a new authoritative seed.
    const deck = await seedDeck(cdp, attempt);
    const deckId = `custom_${deck.id}`;
    const token = await issueAuthoritativeToken(cdp, deckId);
    assert.equal(token?.ok, true, `authoritative match token attempt ${attempt} failed: ${JSON.stringify(token)}`);
    const seed = Number(token.seed);
    const playerFirst = token.playerFirst === true;
    const startHand = Math.max(1, Number(token.engineRules?.startHand) || 4);
    const cards = Array.isArray(deck.cards) ? deck.cards : certificationDeck;
    const openingHand = seededShuffle(cards, (seed ^ 0x9e3779b9) >>> 0).slice(0, startHand);
    const sourceInOpeningHand = openingHand.includes(sourceDefId);
    attempts.push({ attempt, seed, playerFirst, openingHand, sourceInOpeningHand });

    // Even round + playerFirst means the AI acts first. The player can cast the
    // cost-6 source as the second actor in round 6, pass, and start round 7 with
    // refreshed mana before the AI can mutate/remove the source.
    if (sourceInOpeningHand && playerFirst) {
      return { deck, token, sourceDefId, openingHand, attempts };
    }
  }
  throw new Error(
    `could not prepare a player-first authoritative fixture with ${sourceDefId} in the opening hand: ${JSON.stringify(attempts)}`,
  );
}

async function interceptNextMatchToken(cdp, token) {
  const payload = JSON.stringify(token);
  const installed = await evaluate(cdp, `(() => {
    const authoritativePayload = ${payload};
    const originalFetch = window.fetch.bind(window);
    let consumed = false;
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : (input?.url || '');
      if (!consumed && url.includes('/api/matches/token') && String(init?.method || 'GET').toUpperCase() === 'POST') {
        consumed = true;
        return Promise.resolve(new Response(JSON.stringify(authoritativePayload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }));
      }
      return originalFetch(input, init);
    };
    return true;
  })()`);
  assert.equal(installed, true, "failed to install one-shot authoritative token replay in browser");
}

async function matchSnapshot(cdp) {
  return evaluate(cdp, `(() => {
    const playerBar = document.querySelector('.tcg-avatar-player')?.closest('.tcg-playerbar');
    const manaText = playerBar?.querySelector('.tcg-mana-label b')?.textContent || '';
    const manaMatch = manaText.match(/(\\d+)\\s*\\/\\s*(\\d+)/);
    return {
      phase: document.querySelector('.tcg-arena')?.dataset?.matchPhase || null,
      round: Number.parseInt((document.querySelector('.tcg-round-pill')?.textContent || '').replace('RODADA ', '').trim(), 10) || 0,
      gameover: Boolean(document.querySelector('.match-result-backdrop')) || document.querySelector('.tcg-arena')?.dataset?.matchPhase === 'gameover',
      playerTurn: Boolean(playerBar?.classList.contains('tcg-playerbar-active')),
      playerMana: manaMatch ? Number(manaMatch[1]) : null,
      playerMaxMana: manaMatch ? Number(manaMatch[2]) : null,
      hand: [...document.querySelectorAll('#player-hand-cards [data-card-tip-def-id]')].map((host) => host.dataset.cardTipDefId),
      board: [...document.querySelectorAll('[data-bench-side="player"] [data-unit-id]')].map((host) => ({
        defId: host.dataset.cardTipDefId,
        unitId: host.dataset.unitId
      })),
      boardCount: document.querySelectorAll('[data-bench-side="player"] [data-unit-id]').length,
      manaText: manaText || null,
    };
  })()`);
}

async function playDefensiveUnit(cdp, snapshot) {
  if (snapshot.boardCount >= maxDefensiveBench) return null;
  for (const defId of defensiveUnits) {
    const selector = `#player-hand-cards [data-card-tip-def-id="${defId}"] button[data-card-state="playable"]:not(:disabled)`;
    const playable = await evaluate(cdp, `Boolean(document.querySelector(${JSON.stringify(selector)}))`);
    if (!playable) continue;

    const beforeBoardIds = new Set(snapshot.board.map((unit) => unit.unitId).filter(Boolean));
    const beforeHandCopies = snapshot.hand.filter((id) => id === defId).length;
    const beforeMana = snapshot.playerMana;

    if (!await clickSelector(cdp, selector)) continue;

    // Defensive development is only a setup action for the activated source.
    // A successfully played unit can be removed before the next polling sample,
    // so requiring boardCount to stay increased creates a false-negative race.
    // Accept the play once any independent browser-visible commit signal appears:
    // a new copy on board, one fewer copy in hand, or same-round regular mana spent.
    await waitUntil(
      async () => {
        const current = await matchSnapshot(cdp);
        const newBoardUnit = current.board.some(
          (unit) => unit.defId === defId && unit.unitId && !beforeBoardIds.has(unit.unitId),
        );
        const handCopies = current.hand.filter((id) => id === defId).length;
        const handSpent = handCopies < beforeHandCopies;
        const manaSpent =
          current.round === snapshot.round &&
          Number.isFinite(beforeMana) &&
          Number.isFinite(current.playerMana) &&
          current.playerMana < beforeMana;

        if (!newBoardUnit && !handSpent && !manaSpent) return null;
        return { current, newBoardUnit, handSpent, manaSpent };
      },
      `defensive unit ${defId} play to commit`,
      10_000,
    );
    return defId;
  }
  return null;
}

async function assignDefensiveBlocks(cdp, protectedDefId = null) {
  const layout = await evaluate(cdp, `(() => ({
    blockers: [...document.querySelectorAll('[data-bench-side="player"] [data-unit-id]')]
      .filter((host) => ${protectedDefId ? `host.dataset.cardTipDefId !== ${JSON.stringify(protectedDefId)}` : "true"})
      .map((host) => host.dataset.unitId)
      .filter(Boolean),
    attackers: [...document.querySelectorAll('[data-bench-side="ai"] [data-unit-id]')]
      .filter((host) => host.querySelector('button[data-card-state="attacking"]:not(:disabled)'))
      .map((host) => host.dataset.unitId)
      .filter(Boolean),
  }))()`);
  const blockCount = Math.min(layout?.blockers?.length || 0, layout?.attackers?.length || 0);
  for (let index = 0; index < blockCount; index++) {
    const blockerId = layout.blockers[index];
    const attackerId = layout.attackers[index];
    const blockerSelector = `[data-bench-side="player"] [data-unit-id="${blockerId}"] button[data-card-state]:not(:disabled)`;
    const attackerSelector = `[data-bench-side="ai"] [data-unit-id="${attackerId}"] button[data-card-state="attacking"]:not(:disabled)`;
    assert.equal(await clickSelector(cdp, blockerSelector), true, `could not select defensive blocker ${blockerId}`);
    await sleep(80);
    assert.equal(await clickSelector(cdp, attackerSelector), true, `could not assign blocker ${blockerId} to attacker ${attackerId}`);
    await sleep(80);
  }
  return blockCount;
}

async function driveUntilSourcePlayed(cdp, defId, timeoutMs = 150_000) {
  const deadline = Date.now() + timeoutMs;
  const actions = [];
  while (Date.now() < deadline) {
    const snapshot = await matchSnapshot(cdp);
    if (snapshot.gameover) {
      throw new Error(`match ended before ${defId} could be played: ${JSON.stringify({ snapshot, actions: actions.slice(-20) })}`);
    }

    if (snapshot.phase === "main") {
      const sourceSelector = `#player-hand-cards [data-card-tip-def-id="${defId}"] button[data-card-state="playable"]:not(:disabled)`;
      const playableSource = await evaluate(cdp, `Boolean(document.querySelector(${JSON.stringify(sourceSelector)}))`);
      if (playableSource) {
        assert.equal(await clickSelector(cdp, sourceSelector), true, `could not play activated source ${defId}`);
        await waitForSelector(cdp, `[data-bench-side="player"] [data-card-tip-def-id="${defId}"][data-unit-id]`, 10_000);
        const played = await matchSnapshot(cdp);
        actions.push({ round: snapshot.round, action: `play:${defId}` });
        return { round: snapshot.round, actions, played };
      }

      const developed = await playDefensiveUnit(cdp, snapshot);
      if (developed) {
        actions.push({ round: snapshot.round, action: `develop:${developed}` });
        await sleep(160);
        continue;
      }

      actions.push({ round: snapshot.round, action: "hold-mana-and-end-main" });
      await pressKey(cdp, " ", "Space");
      await sleep(260);
      continue;
    }

    if (snapshot.phase === "response") {
      actions.push({ round: snapshot.round, action: "pass-response" });
      await pressKey(cdp, " ", "Space");
      await sleep(260);
      continue;
    }

    if (snapshot.phase === "combat") {
      const blocks = await assignDefensiveBlocks(cdp);
      actions.push({ round: snapshot.round, action: "confirm-combat", blocks });
      await pressKey(cdp, "Enter", "Enter");
      await sleep(260);
      continue;
    }

    await sleep(300);
  }
  throw new Error(`timed out before playing ${defId}: ${JSON.stringify(actions.slice(-20))}`);
}

async function abilityEvidence(cdp, defId) {
  return evaluate(cdp, `(() => {
    const source = document.querySelector('[data-bench-side="player"] [data-card-tip-def-id="${defId}"][data-unit-id]');
    const button = source?.querySelector('button[data-activated-ability-index="0"]');
    if (!source || !button) return null;
    return {
      unitId: source.dataset.unitId,
      status: button.dataset.activatedAbilityStatus,
      disabled: Boolean(button.disabled),
      ariaLabel: button.getAttribute('aria-label') || '',
      title: button.getAttribute('title') || '',
      text: button.textContent || '',
      round: Number.parseInt((document.querySelector('.tcg-round-pill')?.textContent || '').replace('RODADA ', '').trim(), 10) || 0,
    };
  })()`);
}

async function waitForAbilityState(cdp, defId, status, reasonPattern, timeoutMs = 20_000) {
  return waitUntil(async () => {
    const evidence = await abilityEvidence(cdp, defId);
    if (!evidence || evidence.status !== status) return null;
    if (reasonPattern && !reasonPattern.test(`${evidence.ariaLabel} ${evidence.title}`)) return null;
    return evidence;
  }, `${defId} activated ability state ${status}`, timeoutMs);
}

async function capture(cdp, filename) {
  await mkdir(outputDir, { recursive: true });
  const screenshot = await cdp.call("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  await writeFile(join(outputDir, filename), Buffer.from(screenshot.data, "base64"));
}

async function appendManifest(entries) {
  const manifestPath = join(outputDir, "manifest.json");
  try {
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    manifest.screenshots = Array.isArray(manifest.screenshots) ? manifest.screenshots : [];
    manifest.screenshots.push(...entries);
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  } catch (error) {
    console.warn(`ACTIVATED ABILITY BROWSER CERT: manifest append skipped — ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function waitForNextPlayerMain(cdp, afterRound, protectedDefId, timeoutMs = 60_000) {
  return waitUntil(async () => {
    const snapshot = await matchSnapshot(cdp);
    if (snapshot.gameover) throw new Error("match ended before activated ability could refresh next round");

    if (snapshot.phase === "response") {
      await pressKey(cdp, " ", "Space");
      return null;
    }

    if (snapshot.phase === "combat") {
      await assignDefensiveBlocks(cdp, protectedDefId);
      await pressKey(cdp, "Enter", "Enter");
      return null;
    }

    if (snapshot.phase === "main" && snapshot.playerTurn && snapshot.round > afterRound) return snapshot;
    return null;
  }, "next player main phase", timeoutMs);
}

async function main() {
  const profileDir = await mkdtemp(join(tmpdir(), "runeforge-activated-ability-cert-"));
  let port = 0;
  const chromePath = findChrome();
  const chrome = spawn(chromePath, [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--hide-scrollbars",
    "--mute-audio",
    CHROME_REMOTE_DEBUGGING_FLAG,
    `--user-data-dir=${profileDir}`,
    `--window-size=${viewport.width},${viewport.height}`,
    "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });

  let cdp;
  try {
    port = await waitForChromeDevToolsPort({ profileDir, chrome });
    const websocketUrl = await waitForChrome(port);
    cdp = await CdpClient.connect(websocketUrl);
    await cdp.call("Page.enable");
    await cdp.call("Runtime.enable");
    await cdp.call("Log.enable");
    await cdp.call("Emulation.setDeviceMetricsOverride", viewport);

    await navigate(cdp, "/play");
    await waitForText(cdp, "PRIMEIRO ACESSO · ALPHA JOGÁVEL", 30_000);
    const chosen = await prepareAuthoritativeFixture(cdp);
    assert.equal(chosen.token.playerFirst, true, "certification fixture must be server-authoritative player-first");

    await clickText(cdp, "COMEÇAR TREINAMENTO");
    await waitForText(cdp, "Escolha seu deck", 30_000);
    await waitForText(cdp, chosen.deck.name, 30_000);
    await clickText(cdp, chosen.deck.name);
    await waitUntil(
      () => evaluate(
        cdp,
        `(() => [...document.querySelectorAll('button')].some((button) => button.getAttribute('aria-pressed') === 'true' && (button.textContent || '').includes(${JSON.stringify(chosen.deck.name)})))()`,
      ),
      "activated ability certification deck selection",
    );

    await interceptNextMatchToken(cdp, chosen.token);
    await clickText(cdp, "ENTRAR NO NEXUS");
    await waitForText(cdp, "Prepare sua mão inicial", 30_000);
    await waitForSelector(cdp, `[data-card-tip-def-id="${chosen.sourceDefId}"]`, 10_000);
    const actualOpeningHand = await evaluate(
      cdp,
      `[...document.querySelectorAll('[data-card-tip-def-id]')].map((node) => node.dataset.cardTipDefId).filter(Boolean)`,
    );
    assert.ok(
      actualOpeningHand.includes(chosen.sourceDefId),
      `authoritative seed prediction diverged from browser opening hand: ${JSON.stringify({ chosen, actualOpeningHand })}`,
    );

    await clickText(cdp, "Manter mão inicial");
    await waitForSelector(cdp, ".tcg-arena", 30_000);
    const guideOpen = await evaluate(cdp, "Boolean(document.querySelector('.match-guide-backdrop'))");
    if (guideOpen) await clickText(cdp, "Pular guia");
    await waitUntil(
      () => evaluate(cdp, "!document.querySelector('.match-guide-backdrop')"),
      "match guide to close",
    );

    cdp.notifications.length = 0;
    const played = await driveUntilSourcePlayed(cdp, chosen.sourceDefId);
    assert.equal(
      played.round,
      sourcePlayRound,
      `cost-6 activated source must be played in round ${sourcePlayRound} for deterministic refresh proof: ${JSON.stringify(played)}`,
    );

    const initialAbilityState = await abilityEvidence(cdp, chosen.sourceDefId);
    const blocked = await waitForAbilityState(cdp, chosen.sourceDefId, "blocked", /Mana insuficiente/i);
    assert.equal(
      blocked.disabled,
      true,
      "played 6-mana source must immediately expose a disabled ability after spending all 6 mana",
    );
    assert.match(blocked.text, /BLOQUEADA/i, "blocked state must be visible on the battlefield control");
    await capture(cdp, blockedScreenshot);

    await pressKey(cdp, " ", "Space");
    const refreshed = await waitForNextPlayerMain(cdp, played.round, chosen.sourceDefId);
    assert.equal(
      refreshed.round,
      sourceRefreshRound,
      `player-first fixture must advance directly from round ${sourcePlayRound} to player main in round ${sourceRefreshRound}: ${JSON.stringify(refreshed)}`,
    );
    assert.equal(refreshed.playerTurn, true, `round-${sourceRefreshRound} refresh must visibly belong to the player: ${JSON.stringify(refreshed)}`);
    assert.ok(
      (refreshed.playerMana ?? 0) >= 2,
      `round-${sourceRefreshRound} refresh must provide enough regular mana for the ability: ${JSON.stringify(refreshed)}`,
    );

    const ready = await waitForAbilityState(cdp, chosen.sourceDefId, "ready", null);
    assert.equal(ready.disabled, false, "activated ability must become usable after mana refresh");
    assert.match(ready.text, /PRONTA/i, "ready state must be visible on the battlefield control");

    const sourceSelector = `[data-bench-side="player"] [data-card-tip-def-id="${chosen.sourceDefId}"][data-unit-id="${ready.unitId}"]`;
    await hoverSelector(cdp, sourceSelector);
    await waitForSelector(cdp, `[data-activated-ability-intelligence="${chosen.sourceDefId}"]`, 10_000);
    const tooltip = await evaluate(cdp, `(() => {
      const section = document.querySelector('[data-activated-ability-intelligence="${chosen.sourceDefId}"]');
      const detail = section?.querySelector('[data-activated-ability-detail-index="0"]');
      return section && detail
        ? { text: section.textContent || '', state: detail.dataset.activatedAbilityDetailState }
        : null;
    })()`);
    assert.ok(tooltip, "activated ability intelligence must be rendered inside the real card tooltip");
    assert.equal(tooltip.state, "ready", "tooltip must use the same authoritative ready state as the battlefield button");
    assert.match(tooltip.text, /Habilidades ativadas/i);
    assert.match(tooltip.text, /PRONTA PARA ATIVAR/i);
    await capture(cdp, readyScreenshot);
    await cdp.call("Input.dispatchMouseEvent", { type: "mouseMoved", x: 2, y: 2 });
    await sleep(120);

    const beforeActivation = await evaluate(cdp, `(() => {
      const playerBar = [...document.querySelectorAll('.tcg-playerbar, [class*="player-bar"], body *')].find((node) => {
        const text = (node.textContent || '').toUpperCase();
        return text.includes('MANA') && [...text].some((char) => char >= '0' && char <= '9');
      });
      const enemyBar = document.querySelectorAll('.tcg-playerbar, [class*="player-bar"]')[0];
      return {
        body: document.body.innerText,
        playerBar: playerBar?.textContent || '',
        enemyBar: enemyBar?.textContent || '',
        boardCount: document.querySelectorAll('[data-bench-side="player"] [data-unit-id]').length
      };
    })()`);

    const abilitySelector = `${sourceSelector} button[data-activated-ability-index="0"][data-activated-ability-status="ready"]`;
    assert.equal(
      await clickSelector(cdp, abilitySelector),
      true,
      "real battlefield activated ability button must be clickable when ready",
    );

    const used = await waitForAbilityState(cdp, chosen.sourceDefId, "blocked", /Já usada nesta rodada/i);
    assert.equal(used.disabled, true, "once-per-round ability must become disabled after activation");
    assert.match(used.text, /BLOQUEADA/i);
    const logText = await evaluate(cdp, `document.querySelector('.tcg-log')?.textContent || ''`);
    assert.match(logText, /ativa/i, "battle log must record the activated ability resolution");
    await capture(cdp, usedScreenshot);

    const runtimeExceptions = cdp.notifications.filter((message) => message.method === "Runtime.exceptionThrown");
    assert.equal(
      runtimeExceptions.length,
      0,
      `browser runtime exceptions detected: ${JSON.stringify(runtimeExceptions.slice(0, 3))}`,
    );

    const evidence = {
      ok: true,
      type: "activated-ability-browser-certification",
      sourceDefId: chosen.sourceDefId,
      certificationDeckId: chosen.deck.id,
      certificationDeckName: chosen.deck.name,
      authoritativeSeed: Number(chosen.token.seed),
      authoritativePlayerFirst: chosen.token.playerFirst === true,
      tokenAttempts: chosen.attempts.length,
      predictedOpeningHand: chosen.openingHand,
      actualOpeningHand,
      playedRound: played.round,
      refreshedRound: refreshed.round,
      refreshed,
      initialAbilityState,
      blocked,
      ready,
      tooltip,
      used,
      beforeActivation,
      actions: played.actions,
      screenshots: [blockedScreenshot, readyScreenshot, usedScreenshot],
      gitSha: process.env.GITHUB_SHA || null,
      capturedAt: new Date().toISOString(),
    };

    await mkdir(outputDir, { recursive: true });
    await writeFile(join(outputDir, evidenceName), `${JSON.stringify(evidence, null, 2)}\n`);
    await appendManifest([
      {
        stage: "activated ability blocked state",
        file: blockedScreenshot,
        href: `${baseUrl}/play`,
        evidence: `${chosen.sourceDefId}: Mana insuficiente`,
      },
      {
        stage: "activated ability ready + tooltip intelligence",
        file: readyScreenshot,
        href: `${baseUrl}/play`,
        evidence: `${chosen.sourceDefId}: PRONTA PARA ATIVAR`,
      },
      {
        stage: "activated ability used state",
        file: usedScreenshot,
        href: `${baseUrl}/play`,
        evidence: `${chosen.sourceDefId}: Já usada nesta rodada`,
      },
    ]);

    console.log(
      `ACTIVATED ABILITY BROWSER CERT: PASS — ${chosen.sourceDefId} blocked → ready → used in real browser; 3 screenshots captured`,
    );
  } finally {
    try {
      cdp?.close();
    } catch {}
    await shutdownChrome(chrome, profileDir);
  }
}

void main().catch((error) => {
  console.error("ACTIVATED ABILITY BROWSER CERT: FAIL", error);
  process.exitCode = 1;
});
