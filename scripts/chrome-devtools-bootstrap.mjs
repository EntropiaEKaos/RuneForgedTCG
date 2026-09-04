import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const CHROME_REMOTE_DEBUGGING_FLAG = "--remote-debugging-port=0";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function stderrTail(stderr) {
  const trimmed = String(stderr || "").trim();
  return trimmed ? trimmed.slice(-4_000) : "<no Chrome stderr>";
}

function processSummary(chrome, getStderr) {
  return `exitCode=${chrome.exitCode ?? "null"} signal=${chrome.signalCode ?? "null"} stderr=${stderrTail(getStderr())}`;
}

export async function waitForChromeDevToolsPort({
  profileDir,
  chrome,
  getStderr = () => "",
  timeoutMs = 30_000,
}) {
  const activePortPath = join(profileDir, "DevToolsActivePort");
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    if (chrome.exitCode != null || chrome.signalCode != null) {
      throw new Error(`Chrome exited before DevToolsActivePort was ready: ${processSummary(chrome, getStderr)}`);
    }

    try {
      const [portLine] = (await readFile(activePortPath, "utf8")).trim().split(/\r?\n/);
      const port = Number(portLine);
      if (Number.isInteger(port) && port > 0 && port <= 65_535) return port;
      lastError = new Error(`invalid DevToolsActivePort value: ${JSON.stringify(portLine)}`);
    } catch (error) {
      lastError = error;
    }

    await sleep(100);
  }

  throw new Error(
    `Chrome DevToolsActivePort did not become ready within ${timeoutMs}ms${lastError instanceof Error ? `: ${lastError.message}` : ""}; ${processSummary(chrome, getStderr)}`,
  );
}
