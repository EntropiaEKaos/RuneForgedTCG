import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const journeyPath = path.join(root, "scripts", "alpha-casual-pvp-journey.mjs");
const source = fs.readFileSync(journeyPath, "utf8");

const lobbyStart = source.indexOf('await navigate(host.cdp, "/pvp")');
const roomCodeWait = source.indexOf('"host authoritative room code rendered in lobby"', lobbyStart);
assert.ok(lobbyStart >= 0 && roomCodeWait > lobbyStart, "casual PvP host lobby flow must remain discoverable");

const hostLobbyFlow = source.slice(lobbyStart, roomCodeWait);

const identityWait = hostLobbyFlow.indexOf('await waitForText(host.cdp, hostName');
const readinessWait = hostLobbyFlow.indexOf('"enabled create-room control"');
const click = hostLobbyFlow.indexOf('await clickText(host.cdp, "Criar nova sala")');

assert.ok(identityWait >= 0, "host lobby must wait for stable player identity");
assert.ok(readinessWait > identityWait, "create-room readiness must be checked after stable player identity");
assert.ok(click > readinessWait, "create-room interaction must happen only after readiness is proven");

assert.match(
  hostLobbyFlow,
  /querySelectorAll\('button'\)[\s\S]*Criar nova sala[\s\S]*!button\.disabled/,
  "readiness contract must require a present and enabled create-room button",
);
assert.match(
  hostLobbyFlow,
  /"enabled create-room control",[\s\S]*20_000/,
  "readiness wait must remain bounded",
);

console.log(
  "CASUAL PVP CREATE-ROOM READINESS SOURCE CONTRACT: PASS — host waits for an enabled create-room control before physical interaction",
);
