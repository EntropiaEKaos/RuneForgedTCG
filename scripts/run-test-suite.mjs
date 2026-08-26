import { spawnSync } from "node:child_process";
import { behavioralTests, sourceContractTests } from "./test-suites.mjs";

const suite = process.argv[2];
const tests = suite === "behavior" ? behavioralTests : suite === "source-contracts" ? sourceContractTests : null;
if (!tests) {
  console.error("Usage: node scripts/run-test-suite.mjs <behavior|source-contracts>");
  process.exit(2);
}

let passed = 0;
for (const file of tests) {
  // Use Node's executable directly so the suite behaves the same on Windows,
  // Linux and macOS. Spawning tsx.cmd relies on Windows shell semantics and
  // can fail before the first test body is executed.
  const result = spawnSync(process.execPath, ["--import", "tsx", file], {
    stdio: "inherit",
    env: process.env,
  });
  if (result.error) {
    console.error(`${suite.toUpperCase()} SUITE: runner failed before executing ${file}`);
    console.error(result.error);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`${suite.toUpperCase()} SUITE: FAIL at ${file}`);
    process.exit(result.status ?? 1);
  }
  passed += 1;
}
const evidenceLabel = suite === "behavior" ? "behavioral targets" : "static source-audit targets";
console.log(`${suite.toUpperCase()} SUITE: PASS (${passed}/${tests.length} ${evidenceLabel})`);
