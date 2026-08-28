import { spawnSync } from "node:child_process";

if (process.env.RANKED_RELEASE_CERTIFIED !== "true") {
  console.log("RANKED RELEASE GUARD: PASS (fail-closed; RANKED_RELEASE_CERTIFIED is not true)");
  process.exit(0);
}
const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/balance-audit-2.97.ts", "100", "8", "--enforce"], { stdio: "inherit", env: process.env });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
