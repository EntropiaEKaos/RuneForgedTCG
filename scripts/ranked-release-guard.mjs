import { spawnSync } from "node:child_process";

if (process.env.RANKED_RELEASE_CERTIFIED !== "true") {
  console.log("RANKED RELEASE GUARD: PASS (fail-closed; RANKED_RELEASE_CERTIFIED is not true)");
  process.exit(0);
}

const commands = [
  ["--import", "tsx", "src/lib/ranked-launch-2.97.test.ts"],
  ["--import", "tsx", "src/lib/pvp-ranked-certification.test.ts"],
  ["--import", "tsx", "src/lib/pvp-content-snapshot-2.97.test.ts"],
  ["--import", "tsx", "src/lib/pvp-public-state-2.97.test.ts"],
  ["--import", "tsx", "scripts/balance-audit-2.97.ts", "100", "8", "--write", "BALANCE_AUDIT_2.97.json", "--enforce"],
];

for (const args of commands) {
  const result = spawnSync(process.execPath, args, { stdio: "inherit", env: process.env });
  if (result.error) throw result.error;
  if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1);
}

console.log("RANKED RELEASE GUARD: PASS (contracts + immutable pool balance evidence)");
