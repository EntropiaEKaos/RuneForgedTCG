import fs from "node:fs";
import path from "node:path";
import { behavioralTests, sourceContractTests } from "./test-suites.mjs";

const root = process.cwd();
const failures = [];
const all = [...behavioralTests, ...sourceContractTests];
const seen = new Set();
for (const file of all) {
  if (seen.has(file)) failures.push(`duplicate suite membership: ${file}`);
  seen.add(file);
  if (!fs.existsSync(path.join(root, file))) failures.push(`missing test file: ${file}`);
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.test\.tsx?$/.test(entry.name)) out.push(path.relative(root, full).replaceAll(path.sep, "/"));
  }
  return out;
}

const discovered = walk(path.join(root, "src")).sort();
for (const file of discovered) if (!seen.has(file)) failures.push(`unclassified test: ${file}`);
for (const file of all) if (!discovered.includes(file)) failures.push(`suite entry is not a discovered test: ${file}`);

const sourceInspectionPattern = /(?:\breadFileSync\b|\breadFile\s*\()/;
for (const file of behavioralTests) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  if (sourceInspectionPattern.test(source)) failures.push(`behavioral test inspects repository source: ${file}`);
}

if (failures.length) {
  console.error("TEST TAXONOMY: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`TEST TAXONOMY: PASS (${behavioralTests.length} behavioral, ${sourceContractTests.length} source-contract targets)`);
