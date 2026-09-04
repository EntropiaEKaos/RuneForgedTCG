import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { CHROME_REMOTE_DEBUGGING_FLAG, waitForChromeDevToolsPort } from "./chrome-devtools-bootstrap.mjs";

const baseUrl = (process.env.E2E_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const outputDir = resolve(process.env.ALPHA_VISUAL_DIR || "artifacts/alpha-visual");
const screenshotName = "05c-runtime-card-intelligence-tooltip.png";
const evidenceName = "05c-runtime-card-intelligence-tooltip.json";
const fixtureDeckName = "Runtime Tooltip Certification Fixture";
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
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));


function findChrome() {
  for (const candidate of [process.env.CHROME_BIN, "google-chrome", "google-chrome-stable", "chromium", "chromium-browser"].filter(Boolean)) {
    const result = spawnSync("which", [candidate], { encoding: "utf8" });
    if (result.status === 0 && result.stdout.trim()) return result.stdout.trim();
  }
  throw new Error("Chrome/Chromium not found");
}

async function waitForChrome(port, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (response.ok) {
        const page = (await response.json()).find((entry) => entry.type === "page" && entry.webSocketDebuggerUrl);
        if (page) return page.webSocketDebuggerUrl;
      }
    } catch {}
    await sleep(100);
  }
  throw new Error("Chrome remote debugging endpoint did not become ready");
}

async function waitExit(child, timeout) {
  if (child.exitCode != null || child.signalCode != null) return true;
  return new Promise((resolveExit) => {
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      child.removeListener("exit", onExit);
      resolveExit(value);
    };
    const onExit = () => finish(true);
    const timer = setTimeout(() => finish(false), timeout);
    child.once("exit", onExit);
  });
}

async function shutdownChrome(child, profile) {
  if (child.exitCode == null && child.signalCode == null) child.kill("SIGTERM");
  if (!(await waitExit(child, 1500)) && child.exitCode == null && child.signalCode == null) {
    child.kill("SIGKILL");
    await waitExit(child, 2000);
  }
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 1;
    this.pending = new Map();
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(`${pending.method}: ${message.error.message}`));
      else pending.resolve(message.result || {});
    });
    ws.addEventListener("close", () => {
      for (const pending of this.pending.values()) pending.reject(new Error("Chrome DevTools connection closed"));
      this.pending.clear();
    });
  }

  static async connect(url) {
    assert.equal(typeof WebSocket, "function");
    const ws = new WebSocket(url);
    await new Promise((resolveOpen, rejectOpen) => {
      const timer = setTimeout(() => rejectOpen(new Error("Timed out opening Chrome DevTools WebSocket")), 10000);
      ws.addEventListener("open", () => {
        clearTimeout(timer);
        resolveOpen();
      }, { once: true });
      ws.addEventListener("error", () => {
        clearTimeout(timer);
        rejectOpen(new Error("Failed to open Chrome DevTools WebSocket"));
      }, { once: true });
    });
    return new Cdp(ws);
  }

  call(method, params = {}) {
    const id = this.id++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolveCall, rejectCall) => this.pending.set(id, { resolve: resolveCall, reject: rejectCall, method }));
  }

  close() {
    this.ws.close();
  }
}

async function evalJs(cdp, expression) {
  const result = await cdp.call("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || "Runtime evaluation failed");
  }
  return result.result?.value;
}

async function waitUntil(check, label, timeout = 20000) {
  const end = Date.now() + timeout;
  let last;
  while (Date.now() < end) {
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

const waitText = (cdp, text, timeout = 20000) => waitUntil(
  () => evalJs(cdp, `document.body?.innerText?.includes(${JSON.stringify(text)})===true`),
  `text ${text}`,
  timeout,
);
const waitSel = (cdp, selector, timeout = 20000) => waitUntil(
  () => evalJs(cdp, `Boolean(document.querySelector(${JSON.stringify(selector)}))`),
  `selector ${selector}`,
  timeout,
);

async function clickText(cdp, text, required = true) {
  const clicked = await evalJs(cdp, `(()=>{const n=v=>(v||'').replace(/\\s+/g,' ').trim();const e=[...document.querySelectorAll('button,a,[role="button"]')].find(x=>!x.disabled&&n(x.textContent).includes(${JSON.stringify(text)}));if(!e)return false;e.scrollIntoView({block:'center',inline:'center'});e.click();return true;})()`);
  if (required) assert.equal(clicked, true, `Could not click control containing text: ${text}`);
  return clicked;
}

async function clickSel(cdp, selector) {
  return evalJs(cdp, `(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e||e.disabled)return false;e.scrollIntoView({block:'nearest',inline:'center'});e.click();return true;})()`);
}

async function hover(cdp, selector) {
  const point = await evalJs(cdp, `(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return null;e.scrollIntoView({block:'nearest',inline:'center'});const r=e.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2};})()`);
  if (!point) return false;
  await cdp.call("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y });
  return true;
}

async function key(cdp, keyValue, code = keyValue) {
  const virtualKey = code === "Space" ? 32 : code === "Enter" ? 13 : 0;
  const base = { key: keyValue, code, windowsVirtualKeyCode: virtualKey, nativeVirtualKeyCode: virtualKey };
  await cdp.call("Input.dispatchKeyEvent", { type: "keyDown", ...base });
  await cdp.call("Input.dispatchKeyEvent", { type: "keyUp", ...base });
}

async function navigate(cdp, path) {
  const url = `${baseUrl}${path}`;
  await cdp.call("Page.navigate", { url });
  await waitUntil(
    () => evalJs(cdp, `location.href===${JSON.stringify(url)}&&['interactive','complete'].includes(document.readyState)`),
    `navigation to ${url}`,
  );
}

async function seedDeck(cdp) {
  const response = await evalJs(cdp, `(async()=>{const x=await fetch('/api/decks',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:${JSON.stringify(fixtureDeckName)},emoji:'🧪',formatId:'eternal',cards:${JSON.stringify(runtimeDeck)}})});return{status:x.status,...await x.json()};})()`);
  assert.equal(response?.ok, true, `failed to seed runtime certification support fixture: ${JSON.stringify(response)}`);
  assert.ok(response.deck?.id, "runtime certification fixture must return a persisted deck id");
  return response.deck;
}

async function phase(cdp) {
  return evalJs(cdp, `(()=>{const a=document.querySelector('.tcg-arena'),round=document.querySelector('.tcg-round-pill')?.textContent||'',bs=[...document.querySelectorAll('button')],has=t=>bs.some(b=>!b.disabled&&(b.textContent||'').includes(t));return{phase:a?.dataset?.matchPhase||null,gameover:Boolean(document.querySelector('.match-result-backdrop'))||a?.dataset?.matchPhase==='gameover',round,boardCount:document.querySelectorAll('[data-bench-side="player"] [data-unit-id]').length,pendingSpell:has('Cancelar feitiço'),pendingAbility:has('Cancelar habilidade'),canEndTurn:has('Encerrar turno'),canConfirmBlocks:has('Confirmar bloqueios')};})()`);
}

async function clearTargeting(cdp, snapshot) {
  if (snapshot.pendingSpell) {
    await clickText(cdp, "Cancelar feitiço");
    await sleep(160);
    return "cancel-pending-spell";
  }
  if (snapshot.pendingAbility) {
    await clickText(cdp, "Cancelar habilidade");
    await sleep(160);
    return "cancel-pending-ability";
  }
  return null;
}

async function playPriority(cdp) {
  const snapshot = await evalJs(cdp, `(()=>({hand:[...document.querySelectorAll('#player-hand-cards [data-card-tip-def-id]')].map(h=>({defId:h.dataset.cardTipDefId,playable:Boolean(h.querySelector('button[data-card-state="playable"]:not(:disabled)'))})),boardCount:document.querySelectorAll('[data-bench-side="player"] [data-unit-id]').length}))()`);
  const playableIds = snapshot.hand.filter((entry) => entry.playable).map((entry) => entry.defId);
  const priorities = snapshot.boardCount > 0 ? [...buffPriorities, ...cheapUnitPriorities] : cheapUnitPriorities;
  const chosen = priorities.find((defId) => playableIds.includes(defId));
  if (!chosen) return null;

  assert.equal(
    await clickSel(cdp, `#player-hand-cards [data-card-tip-def-id="${chosen}"] button[data-card-state="playable"]:not(:disabled)`),
    true,
  );
  await sleep(300);

  const targetSelector = 'button[data-card-state="targetable"]:not(:disabled)';
  if (await evalJs(cdp, `Boolean(document.querySelector(${JSON.stringify(targetSelector)}))`)) {
    assert.equal(await clickSel(cdp, targetSelector), true, `could not resolve target after playing ${chosen}`);
    await sleep(420);
  }

  const after = await phase(cdp);
  if (after.pendingSpell || after.pendingAbility) {
    const recovery = await clearTargeting(cdp, after);
    return { chosen, resolved: false, recovery };
  }
  return { chosen, resolved: true, recovery: null };
}

async function runtimeEvidence(cdp) {
  const units = await evalJs(cdp, `(()=>[...document.querySelectorAll('[data-bench-side="player"] [data-unit-id]')].map(h=>({defId:h.dataset.cardTipDefId,unitId:h.dataset.unitId})).filter(x=>x.unitId))()`);
  for (const item of units) {
    if (!(await hover(cdp, `[data-bench-side="player"] [data-unit-id="${item.unitId}"]`))) continue;
    await sleep(220);
    const panel = await evalJs(cdp, `(()=>{const n=document.querySelector('[data-card-intelligence-panel="true"]'),h=document.querySelector('[data-tooltip-panel="true"]');if(!n||!h)return null;const r=h.getBoundingClientRect();return{text:n.textContent||'',left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,viewportWidth:innerWidth,viewportHeight:innerHeight};})()`);
    if (!panel || !runtimeBuffPattern.test(panel.text)) {
      await cdp.call("Input.dispatchMouseEvent", { type: "mouseMoved", x: 2, y: 2 });
      await sleep(80);
      continue;
    }
    assert.ok(panel.width >= 300);
    assert.ok(panel.left >= 0 && panel.top >= 0);
    assert.ok(panel.right <= panel.viewportWidth + 1 && panel.bottom <= panel.viewportHeight + 1);
    return { ...item, panel };
  }
  return null;
}

async function capture(cdp, evidence, actions) {
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
    actions,
    gitSha: process.env.GITHUB_SHA || null,
    capturedAt: new Date().toISOString(),
  };
  await writeFile(join(outputDir, evidenceName), `${JSON.stringify(payload, null, 2)}\n`);
  try {
    const manifestPath = join(outputDir, "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    manifest.screenshots = Array.isArray(manifest.screenshots) ? manifest.screenshots : [];
    manifest.screenshots.push({
      stage: "runtime buff/debuff card intelligence tooltip",
      file: screenshotName,
      href: `${baseUrl}/play`,
      evidence: payload.matchedText,
    });
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  } catch (error) {
    console.warn(`RUNTIME TOOLTIP: manifest append skipped — ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function endMain(cdp, before) {
  assert.equal(await clickText(cdp, "Encerrar turno", false), true, `expected Encerrar turno in ${JSON.stringify(before)}`);
  await waitUntil(async () => {
    const after = await phase(cdp);
    return after.gameover || after.phase !== "main" || after.round !== before.round ? after : null;
  }, `main phase to advance from ${before.round}`, 8000);
}

async function drive(cdp, timeout = 150000) {
  const end = Date.now() + timeout;
  const actions = [];
  let maxRound = 0;
  while (Date.now() < end) {
    const evidence = await runtimeEvidence(cdp);
    if (evidence) return { evidence, actionLog: actions, maxRound };

    const snapshot = await phase(cdp);
    const roundMatch = String(snapshot.round || "").match(/(\d+)/);
    if (roundMatch) maxRound = Math.max(maxRound, Number(roundMatch[1]));
    if (snapshot.gameover) throw new Error(`match ended before runtime modifier evidence was captured (round=${maxRound})`);

    if (snapshot.phase === "main") {
      const recovery = await clearTargeting(cdp, snapshot);
      if (recovery) {
        actions.push({ round: maxRound, action: recovery });
        continue;
      }
      const played = await playPriority(cdp);
      if (played) {
        actions.push({ round: maxRound, action: `play:${played.chosen}`, resolved: played.resolved, recovery: played.recovery });
        await sleep(280);
        continue;
      }
      actions.push({ round: maxRound, action: "end-main-control" });
      await endMain(cdp, snapshot);
      await sleep(180);
      continue;
    }

    if (snapshot.phase === "response") {
      actions.push({ round: maxRound, action: "pass-response" });
      await key(cdp, " ", "Space");
      await sleep(260);
      continue;
    }

    if (snapshot.phase === "combat") {
      if (snapshot.canConfirmBlocks) {
        actions.push({ round: maxRound, action: "confirm-blocks-control" });
        await clickText(cdp, "Confirmar bloqueios");
      } else {
        actions.push({ round: maxRound, action: "confirm-combat-key" });
        await key(cdp, "Enter", "Enter");
      }
      await sleep(260);
      continue;
    }

    await sleep(300);
  }

  throw new Error(`timed out before runtime modifier evidence was captured (round=${maxRound}, snapshot=${JSON.stringify(await phase(cdp).catch(() => null))}, actions=${JSON.stringify(actions.slice(-16))})`);
}

async function main() {
  const profile = await mkdtemp(join(tmpdir(), "runeforge-runtime-tooltip-"));
  let port = 0;
  const chrome = spawn(findChrome(), [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--hide-scrollbars",
    "--mute-audio",
    CHROME_REMOTE_DEBUGGING_FLAG,
    `--user-data-dir=${profile}`,
    `--window-size=${viewport.width},${viewport.height}`,
    "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });

  let cdp;
  try {
    port = await waitForChromeDevToolsPort({ profileDir: profile, chrome });
    cdp = await Cdp.connect(await waitForChrome(port));
    await cdp.call("Page.enable");
    await cdp.call("Runtime.enable");
    await cdp.call("Emulation.setDeviceMetricsOverride", viewport);
    await navigate(cdp, "/play");
    await waitText(cdp, "PRIMEIRO ACESSO · ALPHA JOGÁVEL", 30000);

    const fixtureDeck = await seedDeck(cdp);
    await clickText(cdp, "COMEÇAR TREINAMENTO");
    await waitText(cdp, "Escolha seu deck", 30000);
    await waitText(cdp, fixtureDeckName, 30000);
    await clickText(cdp, fixtureDeckName);
    await waitUntil(
      () => evalJs(cdp, `(()=>[...document.querySelectorAll('button')].some(b=>b.getAttribute('aria-pressed')==='true'&&(b.textContent||'').includes(${JSON.stringify(fixtureDeckName)})))()`),
      "runtime certification fixture selection",
    );
    assert.equal(
      await evalJs(cdp, `(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.textContent||'').includes(${JSON.stringify(fixtureDeckName)})&&x.getAttribute('aria-pressed')==='true');return Boolean(b);})()`),
      true,
      `persisted runtime fixture ${fixtureDeck.id} must be the selected battle deck`,
    );

    await clickText(cdp, "Aprendiz");
    await waitUntil(
      () => evalJs(cdp, `(()=>[...document.querySelectorAll('button')].some(b=>b.getAttribute('aria-pressed')==='true'&&(b.textContent||'').includes('Aprendiz')))()`),
      "apprentice AI selection",
    );

    await clickText(cdp, "ENTRAR NO NEXUS");
    await waitText(cdp, "Prepare sua mão inicial", 30000);
    await clickText(cdp, "Manter mão inicial");
    await waitSel(cdp, ".tcg-arena", 30000);
    await waitSel(cdp, ".match-guide-backdrop", 15000);
    await clickText(cdp, "Pular guia");
    await waitUntil(() => evalJs(cdp, "!document.querySelector('.match-guide-backdrop')"), "first match guide to close");

    const { evidence, actionLog, maxRound } = await drive(cdp);
    await capture(cdp, evidence, actionLog);
    console.log(`RUNTIME TOOLTIP CERT: PASS — fixture ${fixtureDeck.id} · ${evidence.defId} exposed ${evidence.panel.text.match(runtimeBuffPattern)?.[0]} in round ${maxRound}; captured ${screenshotName}`);
  } finally {
    try { cdp?.close(); } catch {}
    await shutdownChrome(chrome, profile);
  }
}

void main().catch((error) => {
  console.error("RUNTIME TOOLTIP CERT: FAIL", error);
  process.exitCode = 1;
});
