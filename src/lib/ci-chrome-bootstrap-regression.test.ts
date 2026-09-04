import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const preflight = fs.readFileSync(path.join(root, "scripts/alpha-pvp-lobby-preflight.mjs"), "utf8");

assert.match(
  preflight,
  /"--remote-debugging-port=0"/,
  "PvP preflight must let Chrome allocate its own DevTools port",
);
assert.match(
  preflight,
  /DevToolsActivePort/,
  "PvP preflight must discover Chrome through the profile DevToolsActivePort contract",
);
assert.match(
  preflight,
  /chrome\.exitCode\s*!=\s*null\s*\|\|\s*chrome\.signalCode\s*!=\s*null/,
  "PvP preflight must fail early when Chrome exits during bootstrap",
);
assert.match(
  preflight,
  /chromeExitSummary/,
  "PvP preflight bootstrap failures must carry process diagnostics",
);
assert.match(
  preflight,
  /stderrTail/,
  "PvP preflight bootstrap failures must include bounded Chrome stderr",
);
assert.doesNotMatch(
  preflight,
  /function\s+freePort\s*\(/,
  "PvP preflight must not reintroduce the reserve-release-rebind free-port race",
);
assert.doesNotMatch(
  preflight,
  /remote-debugging-port=\$\{port\}/,
  "PvP preflight must not bind Chrome to a previously released port",
);
assert.doesNotMatch(
  preflight,
  /from\s+["']node:net["']/,
  "PvP preflight no longer needs TCP port preallocation",
);

console.log("CI CHROME BOOTSTRAP SOURCE CONTRACT: PASS — Chrome-owned port · DevToolsActivePort · fail-fast diagnostics");
