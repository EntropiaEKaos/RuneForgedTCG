import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const layout = readFileSync("src/app/layout.tsx", "utf8");
const css = readFileSync("src/app/styles/visual-5-3-pvp-lobby.css", "utf8");
const pvpClientPath = "src/app/pvp/PvpClient.tsx";
const pvpClient = readFileSync(pvpClientPath, "utf8");
const suites = readFileSync("scripts/test-suites.mjs", "utf8");

const previousLayer = 'import "./styles/visual-5-2-player-journey.css";';
const pvpLayer = 'import "./styles/visual-5-3-pvp-lobby.css";';

assert.ok(layout.includes(pvpLayer), "Visual 5.3 PvP lobby layer must be mounted");
assert.ok(
  layout.indexOf(pvpLayer) > layout.indexOf(previousLayer),
  "Visual 5.3 must load after Visual 5.2 so PvP lobby polish remains additive",
);

for (const contract of [
  '[aria-label="Estado do lobby PvP"]',
  '[aria-label="Chat da sala"]',
  '[aria-label="Mensagem do chat PvP"]',
  '[aria-label="Código da sala PvP"]',
  '.rf-app-shell > section:has([aria-label="Chat da sala"])',
  '.rf-app-shell > section:has(select.input)',
]) {
  assert.ok(css.includes(contract), `Visual 5.3 is missing certified PvP presentation contract: ${contract}`);
}

for (const accessibilityContract of [
  '@supports not (backdrop-filter: blur(1px))',
  '@media (prefers-reduced-motion: reduce)',
  '@media (max-width: 720px)',
]) {
  assert.ok(css.includes(accessibilityContract), `Visual 5.3 is missing accessibility/fallback contract: ${accessibilityContract}`);
}

for (const forbidden of [
  '/api/pvp',
  '/api/matchmaking',
  'fetch(',
  'setInterval',
  'localStorage',
  'sessionStorage',
  'window.location',
  'actionId',
  'room.version',
  'dispatch(',
  '.tcg-arena',
  '.tcg-actions',
  '.player-hand-shell',
]) {
  assert.equal(css.includes(forbidden), false, `Visual 5.3 must stay presentation-only; forbidden token found: ${forbidden}`);
}

function gitBlobSha(path: string): string {
  const bytes = readFileSync(path);
  const header = Buffer.from(`blob ${bytes.byteLength}\0`, "utf8");
  return createHash("sha1").update(header).update(bytes).digest("hex");
}

assert.equal(
  gitBlobSha(pvpClientPath),
  "405125d2b35a74b7bd89fc0fe26603cfaa277947",
  "Visual 5.3 is certified as CSS-only: PvpClient.tsx must remain byte-for-byte unchanged",
);

for (const authorityContract of [
  'fetch("/api/pvp"',
  'window.setInterval(() => { void load(); }, 3000)',
  'window.location.replace(`/play?pvpRoom=',
  'body: JSON.stringify({ action: "join", guestDeck: selectedDeck })',
  'body: JSON.stringify({ action: "leave" })',
  'body: JSON.stringify({ action: "chat", message: chatInput })',
]) {
  assert.ok(pvpClient.includes(authorityContract), `Existing PvP authority contract disappeared: ${authorityContract}`);
}

assert.ok(
  suites.includes('"src/lib/visual-5-3-pvp-lobby-regression.test.ts"'),
  "Visual 5.3 regression contract must be registered as a source-contract test",
);

console.log("RUNE FORGE VISUAL 5.3 PVP LOBBY: CSS-only authority-preserving contracts PASS");
