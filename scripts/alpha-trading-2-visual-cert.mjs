import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { Pool } from "pg";
import { CHROME_REMOTE_DEBUGGING_FLAG, waitForChromeDevToolsPort } from "./chrome-devtools-bootstrap.mjs";

const baseUrl = (process.env.E2E_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("DATABASE_URL is required");
const outputDir = resolve(process.env.ALPHA_VISUAL_DIR || "artifacts/alpha-visual");
const viewport = { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false };
const pool = new Pool({ connectionString: databaseUrl, max: 2, connectionTimeoutMillis: 5_000 });
const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

function isExpectedBootstrapNetworkLog(message) {
  if (message.method !== "Log.entryAdded") return false;
  const entry = message.params?.entry;
  const url = String(entry?.url || "");
  const text = String(entry?.text || "");
  if (text.includes("401 (Unauthorized)") && url.endsWith("/api/player")) return true;
  return text.includes("404 (Not Found)") && url.endsWith("/favicon.ico");
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
    assert.equal(typeof WebSocket, "function", "Node 22 WebSocket global is required");
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
  await sleep(350);
}

async function clickText(cdp, text) {
  const clicked = await evaluate(cdp, `(() => {
    const normalize = (value) => (value || '').replace(/\\s+/g, ' ').trim();
    const target = [...document.querySelectorAll('button,a,[role="button"]')]
      .find((node) => !node.disabled && normalize(node.textContent).includes(${JSON.stringify(text)}));
    if (!target) return false;
    target.scrollIntoView({ block:'center', inline:'center' });
    target.click();
    return true;
  })()`);
  assert.equal(clicked, true, `Could not click control containing ${text}`);
  await sleep(180);
}

async function setSelect(cdp, selector, value) {
  const changed = await evaluate(cdp, `(() => {
    const input = document.querySelector(${JSON.stringify(selector)});
    if (!(input instanceof HTMLSelectElement)) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
    setter.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('change', { bubbles:true }));
    return input.value === ${JSON.stringify(value)};
  })()`);
  assert.equal(changed, true, `Could not select ${value} in ${selector}`);
  await sleep(120);
}

async function capture(cdp, filename) {
  await mkdir(outputDir, { recursive: true });
  await sleep(250);
  const shot = await cdp.call("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  await writeFile(join(outputDir, filename), Buffer.from(shot.data, "base64"));
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const suffix = `${Date.now().toString(36)}_${process.pid.toString(36)}`;
  const playerName = `Trading Visual ${suffix}`.slice(0, 40);
  const variantId = `trading2_serial_${suffix}`.slice(0, 80);
  const variantName = "Trading 2 Serialized Cert";
  const profileDir = await mkdtemp(join(tmpdir(), "runeforge-trading2-visual-"));
  const chrome = spawn(findChrome(), [
    "--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars", "--mute-audio",
    CHROME_REMOTE_DEBUGGING_FLAG, `--user-data-dir=${profileDir}`, `--window-size=${viewport.width},${viewport.height}`, "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  let stderr = "";
  chrome.stderr.on("data", (chunk) => { stderr += String(chunk); });
  let cdp;
  let playerId = null;
  let cosmeticId = null;

  try {
    const port = await waitForChromeDevToolsPort({ profileDir, chrome, getStderr: () => stderr });
    cdp = await CdpClient.connect(await waitForChrome(port));
    await cdp.call("Page.enable");
    await cdp.call("Runtime.enable");
    await cdp.call("Log.enable");
    await cdp.call("Emulation.setDeviceMetricsOverride", viewport);

    await navigate(cdp, "/play");
    const created = await evaluate(cdp, `(async () => {
      const response = await fetch('/api/player', {
        method:'POST',
        credentials:'include',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({ displayName:${JSON.stringify(playerName)} })
      });
      return { status:response.status, body:await response.json().catch(() => ({})) };
    })()`);
    assert.equal(created?.status, 201, `Trading visual player creation failed: ${JSON.stringify(created?.body)}`);
    playerId = Number(created.body?.player?.id);
    assert.ok(Number.isSafeInteger(playerId) && playerId > 0, "Trading visual player id missing");

    await pool.query("update players set gold=1000, level=2, created_at=now()-interval '48 hours' where id=$1", [playerId]);
    for (const defId of ["void_hexer", "void_imp"]) {
      await pool.query("insert into player_cards(player_id,def_id,count,shiny) values($1,$2,1,false)", [playerId, defId]);
      await pool.query("insert into card_assets(owner_player_id,def_id,source) values($1,$2,'trading-2-visual-cert')", [playerId, defId]);
    }
    const cosmetic = await pool.query(
      `insert into card_cosmetic_variants(def_id,variant_id,name,kind,frame_id,finish,serial_limit,acquisition,pack_eligible,drop_weight,status,enabled,created_by,updated_by)
       values('void_stalker',$1,$2,'serialized','obsidian','foil',100,'market',false,0,'published',true,'trading-2-cert','trading-2-cert')
       returning id`,
      [variantId, variantName],
    );
    cosmeticId = Number(cosmetic.rows[0].id);

    await navigate(cdp, "/market");
    await waitUntil(
      () => evaluate(cdp, `document.body?.innerText?.includes("Mercado & Trocas") === true`),
      "Marketplace surface",
    );
    await waitUntil(
      async () => {
        const opened = await evaluate(cdp, `(() => {
          const normalize = (value) => (value || '').replace(/\\s+/g, ' ').trim();
          const button = [...document.querySelectorAll('button')]
            .find((node) => !node.disabled && normalize(node.textContent) === "Trocas diretas");
          if (!button) return false;
          button.click();
          const text = (document.body?.innerText || "").toLocaleLowerCase("pt-BR");
          return text.includes("propor troca direta") && text.includes("sem gold · carta por carta");
        })()`);
        if (!opened) await sleep(250);
        return opened;
      },
      "Trading 2 composer",
      15_000,
    );
    await waitUntil(
      () => evaluate(cdp, `document.querySelectorAll('button[aria-pressed]').length >= 2`),
      "tradable physical copies",
    );

    const selectedAssets = await evaluate(cdp, `(() => {
      const buttons = [...document.querySelectorAll('button[aria-pressed]')].slice(0, 2);
      if (buttons.length !== 2) return false;
      buttons.forEach((button) => button.click());
      return true;
    })()`);
    assert.equal(selectedAssets, true, "Could not select two offered collectible copies");

    await setSelect(cdp, 'select[aria-label="Carta que você deseja receber"]', "void_stalker");
    await clickText(cdp, "Adicionar");
    await waitUntil(
      () => evaluate(cdp, `[...document.querySelectorAll('select')].some((node) => node.getAttribute('aria-label')?.startsWith('Versão desejada de'))`),
      "requested printing selector",
    );
    await waitUntil(
      () => evaluate(cdp, `[...document.querySelectorAll('select')].some((node) => [...node.options].some((option) => option.value === ${JSON.stringify(variantId)}))`),
      "published serialized printing in trade composer",
    );
    const printingSelected = await evaluate(cdp, `(() => {
      const input = [...document.querySelectorAll('select')].find((node) => node.getAttribute('aria-label')?.startsWith('Versão desejada de'));
      if (!input) return false;
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
      setter.call(input, ${JSON.stringify(variantId)});
      input.dispatchEvent(new Event('change', { bubbles:true }));
      return input.value === ${JSON.stringify(variantId)};
    })()`);
    assert.equal(printingSelected, true, "Could not select serialized printing");
    await waitUntil(
      () => evaluate(cdp, `Boolean([...document.querySelectorAll('input')].find((node) => node.getAttribute('aria-label')?.startsWith('Serial desejado de')))`),
      "serialized number input",
    );
    const serialSet = await evaluate(cdp, `(() => {
      const input = [...document.querySelectorAll('input')].find((node) => node.getAttribute('aria-label')?.startsWith('Serial desejado de'));
      if (!input) return false;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter.call(input, '7');
      input.dispatchEvent(new Event('input', { bubbles:true }));
      input.dispatchEvent(new Event('change', { bubbles:true }));
      return input.value === '7';
    })()`);
    assert.equal(serialSet, true, "Could not set exact requested serial");

    await setSelect(cdp, 'select[aria-label="Carta que você deseja receber"]', "void_drain");
    await clickText(cdp, "Adicionar");
    await waitUntil(
      () => evaluate(cdp, `(document.body?.innerText || '').includes("2/5")`),
      "two-card requested side",
    );

    const evidence = await evaluate(cdp, `(() => ({
      href: location.href,
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyText: (document.body?.innerText || '').replace(/\\s+/g, ' ').trim(),
      selectedOffers: document.querySelectorAll('button[aria-pressed="true"]').length,
      requestedPrintingSelectors: [...document.querySelectorAll('select')].filter((node) => node.getAttribute('aria-label')?.startsWith('Versão desejada de')).length,
      serialValue: [...document.querySelectorAll('input')].find((node) => node.getAttribute('aria-label')?.startsWith('Serial desejado de'))?.value || null,
    }))()`);
    assert.equal(evidence.href, `${baseUrl}/market`);
    assert.ok(evidence.scrollWidth <= evidence.innerWidth + 2, "Trading 2 composer has horizontal overflow");
    assert.equal(evidence.selectedOffers, 2, "Trading 2 composer must visibly retain two offered copies");
    assert.equal(evidence.requestedPrintingSelectors, 2, "Trading 2 composer must visibly retain two requested cards");
    assert.equal(evidence.serialValue, "7", "Trading 2 composer must visibly retain exact requested serial");
    assert.match(evidence.bodyText, /Sem Gold · carta por carta/i);
    assert.match(evidence.bodyText, /2\/5/);
    assert.match(evidence.bodyText, /Trading 2 Serialized Cert/);

    await evaluate(cdp, `document.querySelector('section.mt-6')?.scrollIntoView({ block:'start' })`);
    await sleep(180);
    await capture(cdp, "61-trading-2-multicard-composer.png");

    const severe = cdp.notifications.filter((message) =>
      message.method === "Runtime.exceptionThrown"
      || (
        message.method === "Log.entryAdded"
        && ["error", "assert"].includes(message.params?.entry?.level)
        && !isExpectedBootstrapNetworkLog(message)
      ),
    );
    assert.equal(severe.length, 0, `Trading 2 browser emitted runtime errors: ${JSON.stringify(severe.slice(0, 3))}`);

    const report = {
      ok: true,
      gitSha: process.env.GITHUB_SHA || null,
      capturedAt: new Date().toISOString(),
      viewport,
      authority: {
        offeredPhysicalCopies: 2,
        requestedCollectibles: 2,
        requestedVariantId: variantId,
        requestedSerialNumber: 7,
        goldInDirectTrade: false,
      },
      evidence: { ...evidence, bodyText: undefined },
      screenshots: ["61-trading-2-multicard-composer.png"],
    };
    await writeFile(join(outputDir, "trading-2-visual-manifest.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log("TRADING 2 VISUAL CERT: PASS — 2x2 composer + exact serialized request + no-Gold boundary captured");
  } catch (error) {
    if (cdp) {
      const diagnostic = await evaluate(cdp, `({
        href: location.href,
        bodyText: (document.body?.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 2400),
        buttons: [...document.querySelectorAll('button')].map((node) => (node.textContent || '').replace(/\\s+/g, ' ').trim()).filter(Boolean).slice(0, 80),
        innerWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
      })`).catch(() => null);
      console.error("TRADING 2 VISUAL DIAGNOSTIC", JSON.stringify(diagnostic));
      await capture(cdp, "61-trading-2-diagnostic.png").catch(() => undefined);
    }
    throw error;
  } finally {
    if (playerId) {
      await pool.query("delete from card_asset_locks where owner_player_id=$1", [playerId]).catch(() => undefined);
      await pool.query("delete from trade_offers where proposer_player_id=$1 or recipient_player_id=$1", [playerId]).catch(() => undefined);
      await pool.query("delete from market_listings where seller_player_id=$1 or buyer_player_id=$1", [playerId]).catch(() => undefined);
      await pool.query("delete from economy_transactions where player_id=$1", [playerId]).catch(() => undefined);
      await pool.query("delete from player_cards where player_id=$1", [playerId]).catch(() => undefined);
      await pool.query("delete from card_assets where owner_player_id=$1", [playerId]).catch(() => undefined);
    }
    if (cosmeticId) await pool.query("delete from card_cosmetic_variants where id=$1", [cosmeticId]).catch(() => undefined);
    if (playerId) await pool.query("delete from players where id=$1", [playerId]).catch(() => undefined);
    await pool.end().catch(() => undefined);
    try { cdp?.close(); } catch {}
    await shutdownChrome(chrome, profileDir);
    if (stderr && process.exitCode) console.error(stderr);
  }
}

main().catch((error) => {
  console.error("TRADING 2 VISUAL CERT: FAIL", error);
  process.exitCode = 1;
});
