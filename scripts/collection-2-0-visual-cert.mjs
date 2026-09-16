import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import pg from "pg";
import { CHROME_REMOTE_DEBUGGING_FLAG, waitForChromeDevToolsPort } from "./chrome-devtools-bootstrap.mjs";

const { Pool } = pg;
const baseUrl = (process.env.E2E_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const outputDir = resolve(process.env.COLLECTION_VISUAL_DIR || "artifacts/collection-2-0-visual");
const desktop = { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false };
const mobile = { width: 390, height: 844, deviceScaleFactor: 1, mobile: true, screenWidth: 390, screenHeight: 844 };
const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

function findChrome() {
  for (const candidate of [process.env.CHROME_BIN, "google-chrome", "google-chrome-stable", "chromium", "chromium-browser"].filter(Boolean)) {
    const result = spawnSync("which", [candidate], { encoding: "utf8" });
    if (result.status === 0 && result.stdout.trim()) return result.stdout.trim();
  }
  throw new Error("Chrome/Chromium not found");
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
    this.notifications = [];
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id) {
        this.notifications.push(message);
        return;
      }
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

async function waitUntil(check, label, timeoutMs = 30_000) {
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
  await waitUntil(() => evaluate(cdp, `location.href === ${JSON.stringify(target)} && ['interactive','complete'].includes(document.readyState)`), `navigation to ${target}`);
  await sleep(300);
}

async function waitForText(cdp, text, timeoutMs = 30_000) {
  return waitUntil(() => evaluate(cdp, `document.body?.innerText?.includes(${JSON.stringify(text)}) === true`), `text ${JSON.stringify(text)}`, timeoutMs);
}

async function clickText(cdp, text) {
  const clicked = await evaluate(cdp, `(() => {
    const target = [...document.querySelectorAll('button,a,[role="button"]')].find((node) => !node.disabled && (node.textContent || '').replace(/\\s+/g,' ').trim().includes(${JSON.stringify(text)}));
    if (!target) return false;
    target.scrollIntoView({ block:'center' });
    target.click();
    return true;
  })()`);
  assert.equal(clicked, true, `Could not click ${text}`);
}

async function fillNickname(cdp, value) {
  const filled = await evaluate(cdp, `(() => {
    const input = [...document.querySelectorAll('input')].find((node) => node.getAttribute('placeholder') === 'Seu nome na Forja');
    if (!input) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('input', { bubbles:true }));
    input.dispatchEvent(new Event('change', { bubbles:true }));
    return true;
  })()`);
  assert.equal(filled, true, "Could not fill player nickname");
}

async function createPlayerSession(cdp, playerName) {
  await navigate(cdp, "/play");
  if (await evaluate(cdp, "document.body?.innerText?.includes('CONTINUAR COMO CONVIDADO') === true")) {
    await clickText(cdp, "CONTINUAR COMO CONVIDADO");
  }
  await waitForText(cdp, "SALVE SUA CHAVE DE RECUPERAÇÃO");
  await clickText(cdp, "JÁ GUARDEI");
  await waitUntil(() => evaluate(cdp, "document.body?.innerText?.includes('SALVE SUA CHAVE DE RECUPERAÇÃO') !== true"), "recovery handoff to close");
  if (await evaluate(cdp, "document.body?.innerText?.includes('FORJE SUA IDENTIDADE') === true")) {
    await fillNickname(cdp, playerName);
    await clickText(cdp, "FORJAR IDENTIDADE");
  }
  await waitForText(cdp, "PRIMEIRO ACESSO · ALPHA JOGÁVEL");
}

async function seedOwnedVariant(pool, playerName, variantId) {
  const playerResult = await pool.query("select id from players where name = $1 limit 1", [playerName]);
  const playerId = Number(playerResult.rows[0]?.id || 0);
  assert.ok(playerId > 0, `Visual-cert player not found: ${playerName}`);
  const defId = "ember_blade";
  await pool.query(`
    insert into player_cards (player_id, def_id, count, shiny)
    values ($1, $2, 1, false)
    on conflict (player_id, def_id) do update set count = greatest(player_cards.count, excluded.count)
  `, [playerId, defId]);
  await pool.query(`
    insert into card_cosmetic_variants
      (def_id, variant_id, name, kind, frame_id, finish, art_url, edition, serial_limit, acquisition, pack_eligible, drop_weight, metadata, status, enabled, created_by, updated_by)
    values ($1, $2, 'Relic Serialized Cert', 'serialized', 'default', 'foil', '/art/cards/alpha-p1/emberhold/ember_blade.webp', 'Collection 2.0 Cert', 25, 'grant', false, 0, '{"visualCert":true}'::jsonb, 'published', true, 'collection-2.0-cert', 'collection-2.0-cert')
  `, [defId, variantId]);
  const assetResult = await pool.query(`
    insert into card_assets (owner_player_id, def_id, variant_id, frame_id, finish, serial_number, tradable, source)
    values ($1, $2, $3, 'default', 'foil', 7, true, 'collection-2.0-visual-cert')
    returning id
  `, [playerId, defId, variantId]);
  const assetId = Number(assetResult.rows[0]?.id || 0);
  assert.ok(assetId > 0, "Owned cosmetic fixture asset was not created");
  await pool.query(`
    insert into player_card_cosmetic_preferences (player_id, def_id, asset_id)
    values ($1, $2, $3)
    on conflict (player_id, def_id) do update set asset_id = excluded.asset_id, updated_at = now()
  `, [playerId, defId, assetId]);
  return { playerId, assetId, defId };
}

async function assertViewport(cdp, label) {
  const state = await evaluate(cdp, `({
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    bodyText: (document.body?.innerText || '').replace(/\\s+/g,' ').trim()
  })`);
  assert.ok(state.scrollWidth <= state.innerWidth + 2, `${label} horizontal overflow: ${state.scrollWidth} > ${state.innerWidth}`);
  assert.match(state.bodyText, /COLLECTION 2\.0 · IDENTIDADE VISUAL/i);
  assert.match(state.bodyText, /Relic Serialized Cert/i);
  assert.match(state.bodyText, /#7\/25/);
  assert.match(state.bodyText, /100% cosm/i);
  return state;
}

async function capture(cdp, filename) {
  await sleep(250);
  const screenshot = await cdp.call("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  await writeFile(join(outputDir, filename), Buffer.from(screenshot.data, "base64"));
}

async function main() {
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL is required");
  await mkdir(outputDir, { recursive: true });
  const suffix = `${Date.now().toString(36)}_${process.pid.toString(36)}`;
  const playerName = `Collection Visual ${suffix}`;
  const variantId = `collection_visual_${suffix}`;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const profileDir = await mkdtemp(join(tmpdir(), "runeforge-collection-2-0-"));
  const chrome = spawn(findChrome(), [
    "--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars", "--mute-audio",
    CHROME_REMOTE_DEBUGGING_FLAG, `--user-data-dir=${profileDir}`, `--window-size=${desktop.width},${desktop.height}`, "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  let stderr = "";
  chrome.stderr.on("data", (chunk) => { stderr += String(chunk); });
  let cdp;
  let fixture = null;
  try {
    const port = await waitForChromeDevToolsPort({ profileDir, chrome, getStderr: () => stderr });
    cdp = await CdpClient.connect(await waitForChrome(port));
    await cdp.call("Page.enable");
    await cdp.call("Runtime.enable");
    await cdp.call("Emulation.setDeviceMetricsOverride", desktop);
    await createPlayerSession(cdp, playerName);
    fixture = await seedOwnedVariant(pool, playerName, variantId);

    await navigate(cdp, "/collection");
    await waitForText(cdp, "Relic Serialized Cert");
    const desktopTop = await assertViewport(cdp, "Collection 2.0 desktop");
    await evaluate(cdp, "window.scrollTo(0, 0)");
    await capture(cdp, "collection-2-0-desktop-owned-variant.png");

    const selected = await evaluate(cdp, `(() => {
      const target = [...document.querySelectorAll('button[aria-label]')].find((node) => (node.getAttribute('aria-label') || '').includes('1 variantes'));
      if (!target) return false;
      target.click();
      const aside = document.querySelector('aside[aria-label="Detalhes e ações da carta"]');
      aside?.scrollIntoView({ block:'start' });
      return true;
    })()`);
    assert.equal(selected, true, "Could not select the card carrying the visual-cert variant");
    await waitForText(cdp, "GERENCIAR VARIANTES");
    const selectedText = await evaluate(cdp, "document.querySelector('aside[aria-label=\"Detalhes e ações da carta\"]')?.innerText || ''");
    assert.match(selectedText, /Relic Serialized Cert/);
    assert.match(selectedText, /1 Serialized/);
    assert.match(selectedText, /Em uso/i);
    await capture(cdp, "collection-2-0-desktop-selected-variant.png");

    await cdp.call("Emulation.setDeviceMetricsOverride", mobile);
    await navigate(cdp, "/collection");
    await waitForText(cdp, "Relic Serialized Cert");
    await assertViewport(cdp, "Collection 2.0 mobile");
    await evaluate(cdp, `document.querySelector('[aria-labelledby="collection-cosmetics-heading"]')?.scrollIntoView({ block:'start' })`);
    await sleep(200);
    await capture(cdp, "collection-2-0-mobile-owned-variant.png");

    const runtimeExceptions = cdp.notifications.filter((message) => message.method === "Runtime.exceptionThrown");
    assert.equal(runtimeExceptions.length, 0, `Collection 2.0 runtime exceptions: ${JSON.stringify(runtimeExceptions.slice(0, 3))}`);
    await writeFile(join(outputDir, "collection-2-0-visual-report.json"), `${JSON.stringify({
      ok: true,
      gitSha: process.env.GITHUB_SHA || null,
      capturedAt: new Date().toISOString(),
      fixture: { defId: fixture.defId, variantId, serialNumber: 7, serialLimit: 25, finish: "foil", preferenceAssetId: fixture.assetId },
      desktop: { innerWidth: desktopTop.innerWidth, scrollWidth: desktopTop.scrollWidth },
      viewports: { desktop, mobile },
      screenshots: [
        "collection-2-0-desktop-owned-variant.png",
        "collection-2-0-desktop-selected-variant.png",
        "collection-2-0-mobile-owned-variant.png",
      ],
    }, null, 2)}\n`, "utf8");
    console.log("COLLECTION 2.0 VISUAL CERT: PASS — owned Serialized variant, equipped state, selected-card context and mobile fit certified");
  } catch (error) {
    try { await capture(cdp, "collection-2-0-diagnostic.png"); } catch {}
    throw error;
  } finally {
    if (fixture) {
      await pool.query("delete from player_card_cosmetic_preferences where player_id = $1 and def_id = $2", [fixture.playerId, fixture.defId]).catch(() => null);
      await pool.query("delete from card_assets where id = $1", [fixture.assetId]).catch(() => null);
      await pool.query("delete from card_cosmetic_variants where def_id = $1 and variant_id = $2", [fixture.defId, variantId]).catch(() => null);
    }
    await pool.end().catch(() => null);
    cdp?.close();
    await shutdownChrome(chrome, profileDir);
    if (stderr && process.exitCode) console.error(stderr);
  }
}

main().catch((error) => {
  console.error("COLLECTION 2.0 VISUAL CERT: FAIL", error);
  process.exitCode = 1;
});