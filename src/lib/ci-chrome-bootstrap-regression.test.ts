import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const scriptsRoot = path.join(root, "scripts");
const helperPath = path.join(scriptsRoot, "chrome-devtools-bootstrap.mjs");

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

const helper = fs.readFileSync(helperPath, "utf8");
assert.match(helper, /CHROME_REMOTE_DEBUGGING_FLAG\s*=\s*"--remote-debugging-port=0"/);
assert.match(helper, /DevToolsActivePort/);
assert.match(helper, /chrome\.exitCode\s*!=\s*null\s*\|\|\s*chrome\.signalCode\s*!=\s*null/);
assert.match(helper, /stderrTail/);

const browserScripts = walk(scriptsRoot)
  .filter((file) => file.endsWith(".mjs"))
  .map((file) => ({ file, source: fs.readFileSync(file, "utf8") }))
  .filter(({ source }) => source.includes("function findChrome()") && source.includes('"--headless=new"'));

assert.equal(
  browserScripts.length,
  16,
  `expected the 16 certified headless Chrome scripts to share the bootstrap contract, found ${browserScripts.length}`,
);

for (const { file, source } of browserScripts) {
  const relative = path.relative(root, file);

  assert.match(
    source,
    /from\s+["']\.\/chrome-devtools-bootstrap\.mjs["']/,
    `${relative} must import the shared Chrome bootstrap`,
  );
  assert.match(
    source,
    /CHROME_REMOTE_DEBUGGING_FLAG/,
    `${relative} must let Chrome allocate its own DevTools port`,
  );
  assert.match(
    source,
    /waitForChromeDevToolsPort/,
    `${relative} must discover the Chrome-owned port through DevToolsActivePort`,
  );
  assert.doesNotMatch(
    source,
    /function\s+freePort\s*\(/,
    `${relative} must not reintroduce reserve-release-rebind port allocation`,
  );
  assert.doesNotMatch(
    source,
    /remote-debugging-port=\$\{port\}/,
    `${relative} must not request a previously released TCP port`,
  );
  assert.doesNotMatch(
    source,
    /from\s+["']node:net["']/,
    `${relative} must not preallocate the Chrome DevTools port with node:net`,
  );
}

console.log(
  `CI CHROME BOOTSTRAP SOURCE CONTRACT: PASS — shared DevToolsActivePort bootstrap across ${browserScripts.length} headless browser certs`,
);
