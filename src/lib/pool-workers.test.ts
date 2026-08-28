import assert from "node:assert/strict";
import { runPooledWorkers } from "./pool-workers";

let active = 0;
let peak = 0;
const permits: Array<() => void> = [];
const acquire = async () => {
  while (active >= 4) await new Promise<void>((resolve) => permits.push(resolve));
  active += 1;
  peak = Math.max(peak, active);
};
const release = () => { active -= 1; permits.shift()?.(); };

async function main() {
  const rows = await runPooledWorkers(30, async (index) => {
    await acquire();
    try { await new Promise((resolve) => setTimeout(resolve, 1)); return index; }
    finally { release(); }
  });

  assert.equal(rows.length, 30);
  assert.equal(new Set(rows).size, 30);
  assert.ok(peak <= 4, `fake pool exceeded its max: ${peak}`);
  assert.equal(active, 0);
  console.log("POOL WORKERS: PASS");
}

void main();
