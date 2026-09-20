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
  freshChecks.length >= 1,
  "Alpha visual driver must re-read state before main/response keyboard input",
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

assert.match(
  journey,
  /document\.querySelectorAll\('\.tcg-actions button'\)/,
  "Combat automation must read the live action rail instead of inferring a substep from the broad combat phase",
);
assert.match(
  journey,
  /Confirmar bloqueios/,
  "Combat automation must support the live blocking confirmation action",
);
assert.match(
  journey,
  /Atacar com/,
  "Combat automation must support the live attack confirmation action",
);
assert.doesNotMatch(
  journey,
  /snapshot\.phase === "combat"[\s\S]{0,900}pressKey\(cdp, "Enter"/,
  "Combat automation must never dispatch a blind Enter across attack/block/resolve substeps",
);

console.log("ALPHA VISUAL GAMEOVER RACE: PASS — post-gameover and stale combat-substep input are fail-closed");
