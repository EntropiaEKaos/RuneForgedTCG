import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const certPath = path.join(root, "scripts", "alpha-activated-ability-browser-cert.mjs");
const source = fs.readFileSync(certPath, "utf8");

const start = source.indexOf("async function playDefensiveUnit");
const end = source.indexOf("async function assignDefensiveBlocks", start);
assert.ok(start >= 0 && end > start, "activated ability browser cert must expose playDefensiveUnit before assignDefensiveBlocks");

const playDefensiveUnit = source.slice(start, end);

assert.match(playDefensiveUnit, /beforeBoardIds/);
assert.match(playDefensiveUnit, /beforeHandCopies/);
assert.match(playDefensiveUnit, /newBoardUnit/);
assert.match(playDefensiveUnit, /handSpent/);
assert.match(playDefensiveUnit, /manaSpent/);
assert.match(playDefensiveUnit, /current\.round\s*===\s*snapshot\.round/);
assert.match(playDefensiveUnit, /defensive unit \$\{defId\} play to commit/);

assert.doesNotMatch(
  playDefensiveUnit,
  /boardCount\s*>\s*beforeCount/,
  "fixture must not require boardCount to remain increased after a defensive unit play",
);
assert.doesNotMatch(
  playDefensiveUnit,
  /defensive unit \$\{defId\} to enter battlefield/,
  "fixture must not wait only for persistent battlefield residency",
);

console.log(
  "ACTIVATED ABILITY BROWSER FIXTURE SOURCE CONTRACT: PASS — defensive plays accept board, hand-spend or same-round mana-spend commit signals",
);
