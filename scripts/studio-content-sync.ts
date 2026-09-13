import assert from "node:assert/strict";
import { pool } from "@/db";
import { syncStudioBaseline } from "@/lib/studio-baseline-sync";

async function main() {
  try {
    const first = await syncStudioBaseline();
    const second = await syncStudioBaseline();
    assert.deepEqual(
      second.inserted,
      { keywords: 0, effects: 0, races: 0, classes: 0, collections: 0, cardMeta: 0 },
      "Studio baseline sync must be idempotent on an already-synchronized database",
    );
    console.log("STUDIO BASELINE SYNC: PASS", JSON.stringify({ first, second }));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
