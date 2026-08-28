import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = process.cwd();
const rawDir = path.join(root, ".v8-coverage");
const reportDir = path.join(root, "coverage");
const tests = [
  "src/game/engine.test.ts",
  "src/game/events.test.ts",
  "src/game/fuzz.test.ts",
  "src/game/card-authoring-roundtrip.test.ts",
  "src/game/mechanics-studio-1.0.test.ts",
  "src/game/mechanics-studio-1.1.test.ts",
  "src/game/content-dependency-graph.test.ts",
  "src/game/card-laboratory.test.ts",
  "src/game/gameplay-profile.test.ts",
  "src/game/headless-simulation-2.35.test.ts",
  "src/game/client/match-model.test.ts",
];
rmSync(rawDir, { recursive: true, force: true });
rmSync(reportDir, { recursive: true, force: true });
mkdirSync(rawDir, { recursive: true });
mkdirSync(reportDir, { recursive: true });

const localTsx = path.join(root, "node_modules", "tsx", "package.json");
for (const test of tests) {
  const env = { ...process.env, NODE_V8_COVERAGE: rawDir };
  let command;
  let args;
  if (existsSync(localTsx)) {
    command = process.execPath;
    args = ["--import", "tsx", test];
  } else {
    command = "ts-node";
    args = ["-r", path.join(root, "scripts", "register-path-alias.cjs"), "--compiler-options", '{"module":"commonjs","moduleResolution":"node"}', test];
    env.TS_NODE_TRANSPILE_ONLY = "1";
  }
  const result = spawnSync(command, args, { cwd: root, env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const scripts = new Map();
for (const file of readdirSync(rawDir).filter((name) => name.endsWith(".json"))) {
  const payload = JSON.parse(readFileSync(path.join(rawDir, file), "utf8"));
  for (const script of payload.result || []) {
    if (!script.url || !script.functions) continue;
    let url = script.url.split("?", 1)[0];
    if (url.startsWith("file://")) {
      try { url = fileURLToPath(url); } catch { continue; }
    }
    const normalized = path.resolve(url);
    if (!normalized.startsWith(path.join(root, "src", "game") + path.sep)) continue;
    if (/\.test\.[cm]?[jt]sx?$/.test(normalized)) continue;
    const entry = scripts.get(normalized) || { total: new Set(), covered: new Set() };
    for (const fn of script.functions) {
      const range = fn.ranges?.[0];
      if (!range) continue;
      const key = `${fn.functionName || "<anonymous>"}:${range.startOffset}:${range.endOffset}`;
      entry.total.add(key);
      if (range.count > 0) entry.covered.add(key);
    }
    scripts.set(normalized, entry);
  }
}

let total = 0;
let covered = 0;
const files = [];
for (const [filename, entry] of [...scripts].sort(([a], [b]) => a.localeCompare(b))) {
  const fTotal = entry.total.size;
  const fCovered = entry.covered.size;
  total += fTotal;
  covered += fCovered;
  files.push({ file: path.relative(root, filename), functions: fTotal, covered: fCovered, percent: fTotal ? Number((fCovered / fTotal * 100).toFixed(1)) : 100 });
}
const percent = total ? Number((covered / total * 100).toFixed(1)) : 0;
const summary = { metric: "V8 function coverage", tests, functions: total, covered, percent, files };
writeFileSync(path.join(reportDir, "coverage-summary.json"), JSON.stringify(summary, null, 2) + "\n");
writeFileSync(path.join(reportDir, "README.md"), `# RuneForge behavioral coverage\n\nV8 function coverage: **${percent}%** (${covered}/${total}) across ${files.length} game-engine source files.\n\nThis metric is intentionally separated from source-inspection regression tests.\n`);
console.log(`BEHAVIORAL COVERAGE: ${percent}% (${covered}/${total} functions across ${files.length} files)`);
const threshold = Number(process.env.MIN_FUNCTION_COVERAGE || 0);
if (Number.isFinite(threshold) && threshold > 0 && percent < threshold) {
  console.error(`Coverage gate failed: ${percent}% < ${threshold}%`);
  process.exit(1);
}
