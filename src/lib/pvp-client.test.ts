import assert from "node:assert/strict";
import { deliverPvpAction } from "./pvp-client";

async function run() {
  Object.defineProperty(globalThis, "window", { value: globalThis, configurable: true });
  const bodies: Array<{ actionId: string }> = [];
  let calls = 0;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    calls += 1;
    bodies.push(JSON.parse(String(init?.body)) as { actionId: string });
    if (calls === 1) return new Response(JSON.stringify({ error: "temporary" }), { status: 503 });
    return new Response(JSON.stringify({ ok: true, room: { version: 8 }, duplicate: false }), { status: 200 });
  }) as typeof fetch;
  let retries = 0;
  const result = await deliverPvpAction({ code: "ABC123", playerName: "P", version: 7, actionId: "stable-action", gameAction: { type: "pass", player: "player" }, onRetry: () => { retries += 1; } });
  assert.equal(result.ok, true);
  assert.equal(retries, 1);
  assert.equal(calls, 2);
  assert.deepEqual(bodies.map((body) => body.actionId), ["stable-action", "stable-action"]);

  calls = 0;
  globalThis.fetch = (async () => { calls += 1; return new Response(JSON.stringify({ error: "stale" }), { status: 409 }); }) as typeof fetch;
  const conflict = await deliverPvpAction({ code: "ABC123", playerName: "P", version: 7, actionId: "conflict-action", gameAction: { type: "pass", player: "player" } });
  assert.equal(conflict.status, 409);
  assert.equal(calls, 1);
  console.log("PVP CLIENT 2.40: PASS");
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
