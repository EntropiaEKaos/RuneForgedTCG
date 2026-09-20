import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const journey = readFileSync("scripts/alpha-visual-journey.mjs", "utf8");

assert.match(
  journey,
  /const readDriveState = \(\) => evaluate\(cdp/,
  "Alpha visual driver must use a reusable authoritative DOM state read",
);

const freshChecks = [...journey.matchAll(/const fresh = await readDriveState\(\);/g)];
assert.ok(
  freshChecks.length >= 2,
  "Alpha visual driver must re-read state before both main/response and combat inputs",
);

assert.match(
  journey,
  /if \(fresh\.result \|\| fresh\.phase === "gameover"\) return/,
  "Alpha visual driver must stop before dispatching input once gameover/result is visible",
);

assert.match(
  journey,
  /if \(fresh\.phase !== snapshot\.phase\)/,
  "Alpha visual driver must refuse stale phase input when the phase changes between reads",
);

console.log("ALPHA VISUAL GAMEOVER RACE: PASS — stale post-gameover input is fail-closed");
