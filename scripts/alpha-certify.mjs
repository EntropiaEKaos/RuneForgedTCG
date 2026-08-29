import { spawn, spawnSync } from "node:child_process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const baseUrl = process.env.E2E_BASE_URL?.replace(/\/$/, "") || "http://127.0.0.1:3000";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", env: process.env, ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForHealth(server) {
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    if (server.exitCode != null) throw new Error(`RuneForge server exited before becoming healthy (code ${server.exitCode}).`);
    try {
      const response = await fetch(`${baseUrl}/api/health`, { cache: "no-store" });
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await delay(1_000);
  }
  throw new Error("RuneForge did not become healthy. Run `npm run alpha:setup` first and verify the local PostgreSQL container.");
}

async function main() {
  console.log("ALPHA CERTIFICATION — static/behavioral/build gates");
  run(npm, ["run", "alpha:verify"]);

  console.log(`\nALPHA CERTIFICATION — starting production build at ${baseUrl}`);
  const server = spawn(npm, ["start"], {
    stdio: "inherit",
    env: { ...process.env, E2E_BASE_URL: baseUrl },
  });

  const stop = () => {
    if (server.exitCode == null) server.kill("SIGTERM");
  };
  process.once("SIGINT", () => { stop(); process.exit(130); });
  process.once("SIGTERM", () => { stop(); process.exit(143); });

  try {
    await waitForHealth(server);
    console.log("ALPHA CERTIFICATION — server healthy; running real player journey");
    run(npm, ["run", "test:e2e:alpha-journey"], { env: { ...process.env, E2E_BASE_URL: baseUrl } });
    console.log("\nALPHA CERTIFICATION: PASS — build + complete persisted player journey");
  } finally {
    stop();
  }
}

main().catch((error) => {
  console.error(`ALPHA CERTIFICATION: FAIL — ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
