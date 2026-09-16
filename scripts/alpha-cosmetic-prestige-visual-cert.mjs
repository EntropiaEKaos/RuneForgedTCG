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
  await sleep(250);
}

async function waitForText(cdp, text) {
  return waitUntil(() => evaluate(cdp, `document.body?.innerText?.includes(${JSON.stringify(text)}) === true`), `text ${JSON.stringify(text)}`);
}

async function clickText(cdp, text) {
  const clicked = await evaluate(cdp, `(() => {
    const normalize = (value) => (value || '').replace(/\\s+/g, ' ').trim();
    const target = [...document.querySelectorAll('button,a,[role="button"]')].find((node) => !node.disabled && normalize(node.textContent).includes(${JSON.stringify(text)}));
    if (!target) return false;
    target.scrollIntoView({ block:'center' });
    target.click();
    return true;
  })()`);
  assert.equal(clicked, true, `Could not click ${text}`);
}

async function setLabeledValue(cdp, label, value) {
  const result = await evaluate(cdp, `(() => {
    const host = [...document.querySelectorAll('label')].find((candidate) => (candidate.querySelector('.label')?.textContent || '').trim() === ${JSON.stringify(label)});
    const input = host?.querySelector('input,textarea,select');
    if (!input) return false;
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set;
    if (setter) setter.call(input, ${JSON.stringify(value)}); else input.value = ${JSON.stringify(value)};
    input.dispatchEvent(new Event('input', { bubbles:true }));
    input.dispatchEvent(new Event('change', { bubbles:true }));
    return input.value === ${JSON.stringify(value)};
  })()`);
  assert.equal(result, true, `Could not set ${label}`);
}

async function setPackEligible(cdp) {
  const result = await evaluate(cdp, `(() => {
    const label = [...document.querySelectorAll('label')].find((node) => (node.textContent || '').includes('Elegível para drop em pack'));
    const input = label?.querySelector('input[type="checkbox"]');
    if (!input) return false;
    if (!input.checked) input.click();
    return input.checked && !input.disabled;
  })()`);
  assert.equal(result, true, "Could not enable pack cosmetic eligibility");
}

async function setDropWeight(cdp, value) {
  const result = await evaluate(cdp, `(() => {
    const input = document.querySelector('[data-studio-cosmetics="true"] input[type="number"][max="1000000"]');
    if (!input || input.disabled) return false;
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set;
    if (setter) setter.call(input, ${JSON.stringify(value)}); else input.value = ${JSON.stringify(value)};
    input.dispatchEvent(new Event('input', { bubbles:true }));
    input.dispatchEvent(new Event('change', { bubbles:true }));
    return input.value === ${JSON.stringify(value)};
  })()`);
  assert.equal(result, true, "Could not set cosmetic drop weight");
}

async function login(cdp) {
  const password = process.env.ADMIN_PASSWORD?.trim();
  assert.ok(password, "ADMIN_PASSWORD is required");
  const payload = JSON.stringify({ username: process.env.ADMIN_USERNAME?.trim() || "admin", password });
  const result = await evaluate(cdp, `(async () => {
    const response = await fetch('/api/admin/login', { method:'POST', credentials:'include', headers:{'content-type':'application/json'}, body:${JSON.stringify(payload)} });
    return { status:response.status, body:await response.json().catch(() => null) };
  })()`);
  assert.equal(result?.status, 200, `Admin login failed: ${JSON.stringify(result)}`);
  assert.equal(result?.body?.ok, true, "Admin login did not return ok=true");
}

async function cosmeticRows(cdp, defId) {
  return evaluate(cdp, `(async () => {
    const response = await fetch('/api/admin/studio/cosmetics?defId=' + encodeURIComponent(${JSON.stringify(defId)}), { cache:'no-store' });
    return { status:response.status, body:await response.json().catch(() => ({})) };
  })()`);
}

async function evidence(cdp) {
  return evaluate(cdp, `(() => {
    const preview = document.querySelector('[data-studio-cosmetic-preview="true"]');
    const relicReadout = document.querySelector('[data-studio-cosmetic-prestige="relic"]');
    const persistedRelics = [...document.querySelectorAll('article[data-cosmetic-prestige="relic"]')];
    return {
      href: location.href,
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyText: (document.body?.innerText || '').replace(/\\s+/g, ' ').trim(),
      studio: Boolean(document.querySelector('[data-studio-cosmetics="true"]')),
      previewPrestige: preview?.getAttribute('data-cosmetic-prestige') || null,
      relicReadout: Boolean(relicReadout),
      persistedRelicCount: persistedRelics.length,
      previewText: preview?.textContent?.replace(/\\s+/g, ' ').trim() || '',
    };
  })()`);
}

async function capture(cdp, filename) {
  await sleep(250);
  const shot = await cdp.call("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  await writeFile(join(outputDir, filename), Buffer.from(shot.data, "base64"));
}

async function writeDiagnostic(cdp, error) {
  let state = null;
  try { state = await evidence(cdp); } catch {}
  try { await capture(cdp, "33-cosmetic-prestige-diagnostic.png"); } catch {}
  const report = {
    ok: false,
    gitSha: process.env.GITHUB_SHA || null,
    capturedAt: new Date().toISOString(),
    viewport,
    error: error instanceof Error ? error.message : String(error),
    evidence: state ? { ...state, bodyText: state.bodyText.slice(0, 1600) } : null,
    screenshots: ["33-cosmetic-prestige-diagnostic.png"],
  };
  await writeFile(join(outputDir, "cosmetic-prestige-visual-manifest.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const suffix = `${Date.now().toString(36)}-${process.pid.toString(36)}`;
  const cardName = `Cosmetic Prestige Cert ${suffix}`;
  const defId = `cosmetic_prestige_cert_${suffix.replace(/-/g, '_')}`;
  const variantId = `${defId}_relic`;
  const cosmeticName = "Relic Forge Frame";
  const profileDir = await mkdtemp(join(tmpdir(), "runeforge-cosmetic-prestige-"));
  const chrome = spawn(findChrome(), [
    "--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars", "--mute-audio",
    CHROME_REMOTE_DEBUGGING_FLAG, `--user-data-dir=${profileDir}`, `--window-size=${viewport.width},${viewport.height}`, "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  let stderr = "";
  chrome.stderr.on("data", (chunk) => { stderr += String(chunk); });
  let cdp;

  try {
    const port = await waitForChromeDevToolsPort({ profileDir, chrome, getStderr: () => stderr });
    cdp = await CdpClient.connect(await waitForChrome(port));
    await cdp.call("Page.enable");
    await cdp.call("Runtime.enable");
    await cdp.call("Emulation.setDeviceMetricsOverride", viewport);

    try {
      await navigate(cdp, "/admin/studio");
      await waitForText(cdp, "Runeforge Studio Access");
      await login(cdp);
      await navigate(cdp, "/admin/studio/cards");
      await waitForText(cdp, "Card Authoring Studio");
      await clickText(cdp, "＋ New Card");
      await setLabeledValue(cdp, "Name", cardName);
      await setLabeledValue(cdp, "defId", defId);
      await setLabeledValue(cdp, "Description", "Visual 5.6 cosmetic prestige browser certification card.");
      await clickText(cdp, "Save Card + Metadata");
      await waitForText(cdp, "Saved atomically");

      await clickText(cdp, "Cosmetics");
      await waitUntil(() => evaluate(cdp, `Boolean(document.querySelector('[data-studio-cosmetics="true"]'))`), "Cosmetics authoring tab");
      await clickText(cdp, "＋ Nova variante");
      await setLabeledValue(cdp, "Variant ID", variantId);
      await setLabeledValue(cdp, "Display name", cosmeticName);
      await setLabeledValue(cdp, "Frame preset", "default");
      await setLabeledValue(cdp, "Finish", "foil");
      await setPackEligible(cdp);
      await setDropWeight(cdp, "2500");
      await waitUntil(() => evaluate(cdp, `document.querySelector('[data-studio-cosmetic-prestige="relic"]')?.textContent?.includes('RELÍQUIA') === true`), "Relic prestige readout");

      const authored = await evidence(cdp);
      assert.ok(authored.studio, "Cosmetic Studio surface must be mounted");
      assert.equal(authored.previewPrestige, "relic", "2,500 PPM preview must resolve to Relic prestige");
      assert.ok(authored.relicReadout, "Relic PPM readout must be present");
      assert.match(authored.bodyText, /0\.250%/);
      assert.match(authored.bodyText, /RELÍQUIA/);
      assert.ok(authored.scrollWidth <= authored.innerWidth + 2, "Cosmetic prestige authoring must not overflow horizontally");
      await capture(cdp, "33-cosmetic-relic-authoring.png");

      await clickText(cdp, "Criar Draft");
      await waitForText(cdp, "Variante salva em Draft.");
      const persisted = await cosmeticRows(cdp, defId);
      assert.equal(persisted.status, 200, `Cosmetic Studio GET failed: ${JSON.stringify(persisted.body)}`);
      assert.equal(persisted.body?.ok, true, "Cosmetic Studio GET must return ok=true");
      const row = persisted.body.rows?.find((entry) => entry.variantId === variantId);
      assert.ok(row, "Authored cosmetic variant must persist through the real Studio API");
      assert.equal(row.dropWeight, 2500, "Persisted Relic printing must keep 2,500 PPM");
      assert.equal(row.packEligible, true, "Persisted Relic printing must remain pack-eligible");
      assert.equal(row.frameId, "default", "Persisted Relic printing must keep the selected frame preset");
      assert.equal(row.finish, "foil", "Persisted Relic printing must keep finish identity");
      assert.equal(Object.prototype.hasOwnProperty.call(row, 'rarity'), false, "Cosmetic persistence must not create gameplay rarity");

      await navigate(cdp, "/admin/studio/cards");
      await waitForText(cdp, cardName);
      await clickText(cdp, cardName);
      await clickText(cdp, "Cosmetics");
      await waitForText(cdp, cosmeticName);
      await waitUntil(async () => (await evidence(cdp)).persistedRelicCount >= 1, "persisted Relic cosmetic card");
      await clickText(cdp, "Editar");
      await waitUntil(async () => (await evidence(cdp)).previewPrestige === "relic", "persisted Relic preview");
      const reloaded = await evidence(cdp);
      assert.match(reloaded.bodyText, /0\.250% pack/);
      assert.match(reloaded.bodyText, /RELÍQUIA/);
      assert.ok(reloaded.scrollWidth <= reloaded.innerWidth + 2, "Persisted cosmetic prestige view must not overflow horizontally");
      await capture(cdp, "34-cosmetic-relic-persisted.png");

      const report = {
        ok: true,
        gitSha: process.env.GITHUB_SHA || null,
        capturedAt: new Date().toISOString(),
        viewport,
        authority: {
          defId,
          variantId,
          frameId: row.frameId,
          finish: row.finish,
          dropWeight: row.dropWeight,
          packEligible: row.packEligible,
          status: row.status,
          gameplayRarityFieldPresent: Object.prototype.hasOwnProperty.call(row, 'rarity'),
        },
        authored: { ...authored, bodyText: undefined },
        reloaded: { ...reloaded, bodyText: undefined },
        screenshots: ["33-cosmetic-relic-authoring.png", "34-cosmetic-relic-persisted.png"],
      };
      await writeFile(join(outputDir, "cosmetic-prestige-visual-manifest.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
      console.log("ALPHA COSMETIC PRESTIGE VISUAL CERT: PASS — real Studio authoring persists 2,500 PPM Relic printing with the selected frame preset and no gameplay rarity mutation");
    } catch (error) {
      await writeDiagnostic(cdp, error);
      throw error;
    }
  } finally {
    cdp?.close();
    await shutdownChrome(chrome, profileDir);
    if (stderr && process.exitCode) console.error(stderr);
  }
}

main().then(() => {
  const collectionCert = spawnSync(process.execPath, ["scripts/collection-2-0-visual-cert.mjs"], {
    stdio: "inherit",
    env: { ...process.env, COLLECTION_VISUAL_DIR: outputDir },
  });
  if (collectionCert.status !== 0) {
    throw new Error(`Collection 2.0 visual certification failed with status ${collectionCert.status ?? "unknown"}`);
  }
}).catch((error) => {
  console.error("ALPHA COSMETIC PRESTIGE VISUAL CERT: FAIL", error);
  process.exitCode = 1;
});