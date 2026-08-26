import assert from "node:assert/strict";
import { Pool } from "pg";
import { DECKS } from "../src/game/decks";

const baseUrl = process.env.E2E_BASE_URL?.replace(/\/$/, "");
if (!baseUrl) throw new Error("E2E_BASE_URL is required (example: http://127.0.0.1:3000)");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for MVP E2E economy setup");

class BrowserClient {
  private cookie = "";
  async request(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    if (this.cookie) headers.set("cookie", this.cookie);
    const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
    const cookieHeaders = (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.()
      ?? (response.headers.get("set-cookie") ? [response.headers.get("set-cookie")!] : []);
    if (cookieHeaders.length) this.cookie = cookieHeaders.map((value) => value.split(";", 1)[0]).join("; ");
    const body = await response.json().catch(() => ({}));
    return { response, body };
  }
}

const register = async (client: BrowserClient, name: string) => {
  const before = await client.request("/api/player");
  assert.equal(before.response.status, 401, "GET /api/player must not create an account");
  const result = await client.request("/api/player", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ displayName: name }),
  });
  assert.equal(result.response.status, 201, JSON.stringify(result.body));
  assert.equal(result.body.ok, true);
  assert.match(String(result.body.recoveryCode || ""), /^[A-Za-z0-9_-]{24,}$/);
  const current = await client.request("/api/player");
  assert.equal(current.response.status, 200, JSON.stringify(current.body));
  assert.equal(current.body.player.name, name);
  return result.body as { player: { id: number; name: string }; recoveryCode: string };
};

const recover = async (recoveryCode: string, expectedPlayerId: number) => {
  const client = new BrowserClient();
  const result = await client.request("/api/player", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ recoveryCode }),
  });
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.recovered, true);
  assert.equal(result.body.player.id, expectedPlayerId);
  const current = await client.request("/api/player");
  assert.equal(current.response.status, 200, JSON.stringify(current.body));
  assert.equal(current.body.player.id, expectedPlayerId);
  return client;
};

const queue = (client: BrowserClient, mode: "casual" | "ranked") => client.request("/api/matchmaking", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ deckId: DECKS[0].id, mode, waitSeconds: 1 }),
});

async function verifyRepeatableEconomy(client: BrowserClient, playerId: number) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const operationPrefix = `e2e:${playerId}:${Date.now()}`;
  try {
    await pool.query("update players set gold=100000, dust=100000 where id=$1", [playerId]);

    const packs = await client.request("/api/packs");
    assert.equal(packs.response.status, 200, JSON.stringify(packs.body));
    const pack = packs.body.packs?.[0];
    assert.ok(pack?.id, "at least one pack must be available");
    for (let i = 0; i < 2; i++) {
      const bought = await client.request("/api/packs", {
        method: "POST",
        headers: { "content-type": "application/json", "x-operation-id": `${operationPrefix}:pack-buy:${i}` },
        body: JSON.stringify({ action: "buy", packId: pack.id }),
      });
      assert.equal(bought.response.status, 200, `repeat pack purchase ${i + 1}: ${JSON.stringify(bought.body)}`);
      assert.equal(bought.body.ok, true);
      assert.equal(bought.body.duplicate, false, "distinct economy operations must execute independently");
    }
    for (let i = 0; i < 2; i++) {
      const opened = await client.request("/api/packs", {
        method: "POST",
        headers: { "content-type": "application/json", "x-operation-id": `${operationPrefix}:pack-open:${i}` },
        body: JSON.stringify({ action: "open", packId: pack.id }),
      });
      assert.equal(opened.response.status, 200, `repeat pack opening ${i + 1}: ${JSON.stringify(opened.body)}`);
      assert.equal(opened.body.ok, true);
      assert.equal(opened.body.duplicate, false);
      assert.ok(Array.isArray(opened.body.cards), "pack opening must return its cards");
    }
    const packsAfterOpen = await client.request("/api/packs");
    assert.equal(packsAfterOpen.response.status, 200, JSON.stringify(packsAfterOpen.body));
    assert.equal(packsAfterOpen.body.packs?.find((item: { id: string }) => item.id === pack.id)?.owned ?? 0, 0, "opening the final pack must remove its ownership row cleanly");

    const collection = await client.request("/api/collection");
    assert.equal(collection.response.status, 200, JSON.stringify(collection.body));
    const card = collection.body.collection?.find((item: { collectible?: boolean; owned?: number }) => item.collectible !== false && Number(item.owned || 0) === 0);
    assert.ok(card?.defId, "need an unowned collectible card for craft/disenchant E2E");
    assert.ok(Number(collection.body.duplicateCap) >= 2, "MVP economy E2E requires duplicateCap >= 2");

    for (let i = 0; i < 2; i++) {
      const crafted = await client.request("/api/collection", {
        method: "POST",
        headers: { "content-type": "application/json", "x-operation-id": `${operationPrefix}:craft:${i}` },
        body: JSON.stringify({ action: "craft", defId: card.defId, amount: 1 }),
      });
      assert.equal(crafted.response.status, 200, `repeat craft ${i + 1}: ${JSON.stringify(crafted.body)}`);
      assert.equal(crafted.body.ok, true);
      assert.equal(crafted.body.duplicate, false);
    }
    for (let i = 0; i < 2; i++) {
      const disenchanted = await client.request("/api/collection", {
        method: "POST",
        headers: { "content-type": "application/json", "x-operation-id": `${operationPrefix}:disenchant:${i}` },
        body: JSON.stringify({ action: "disenchant", defId: card.defId, amount: 1 }),
      });
      assert.equal(disenchanted.response.status, 200, `repeat disenchant ${i + 1}: ${JSON.stringify(disenchanted.body)}`);
      assert.equal(disenchanted.body.ok, true);
      assert.equal(disenchanted.body.duplicate, false);
    }
  } finally {
    await pool.end();
  }
}

async function main() {
  const oversizedClient = new BrowserClient();
  const oversized = await oversizedClient.request("/api/player", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ displayName: "x".repeat(20_000) }),
  });
  assert.equal(oversized.response.status, 413, `oversized public account body must be rejected: ${JSON.stringify(oversized.body)}`);
  const oversizedSession = await oversizedClient.request("/api/player");
  assert.equal(oversizedSession.response.status, 401, "oversized account payload must not create a player session");

  const runId = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
  const originalHost = new BrowserClient();
  const guest = new BrowserClient();
  const hostIdentity = await register(originalHost, `E2E Host ${runId}`);
  await register(guest, `E2E Guest ${runId}`);

  const host = await recover(hostIdentity.recoveryCode, hostIdentity.player.id);
  const revoked = await originalHost.request("/api/player");
  assert.equal(revoked.response.status, 401, `pre-recovery host session must be revoked: ${JSON.stringify(revoked.body)}`);

  await verifyRepeatableEconomy(host, hostIdentity.player.id);

  const ranked = await queue(host, "ranked");
  assert.equal(ranked.response.status, 423, `Ranked must be fail-closed in the MVP: ${JSON.stringify(ranked.body)}`);
  assert.equal(ranked.body.code, "RANKED_DISABLED");

  const waiting = await queue(host, "casual");
  assert.equal(waiting.body.status, "queued", JSON.stringify(waiting.body));
  const matchedGuest = await queue(guest, "casual");
  assert.equal(matchedGuest.body.status, "matched", JSON.stringify(matchedGuest.body));
  const roomCode = String(matchedGuest.body.opponent?.roomCode || "");
  assert.match(roomCode, /^[A-Z2-9]{6}$/);

  const resumedHost = await queue(host, "casual");
  assert.equal(resumedHost.body.status, "matched", JSON.stringify(resumedHost.body));
  assert.equal(resumedHost.body.opponent.roomCode, roomCode);
  assert.equal(resumedHost.body.resumed, true);

  const hostRoom = await host.request(`/api/pvp/${roomCode}`);
  const guestRoom = await guest.request(`/api/pvp/${roomCode}`);
  assert.equal(hostRoom.response.status, 200, JSON.stringify(hostRoom.body));
  assert.equal(guestRoom.response.status, 200, JSON.stringify(guestRoom.body));
  assert.equal(hostRoom.body.room.code, roomCode);
  assert.equal(guestRoom.body.room.code, roomCode);
  const viewerSides = [hostRoom.body.room.viewerSide, guestRoom.body.room.viewerSide].sort();
  assert.deepEqual(viewerSides, ["guest", "host"], "the two authenticated participants must receive opposite room orientations");
  for (const room of [hostRoom.body.room, guestRoom.body.room]) {
    assert.equal("seed" in room, false, "seed must not leak from the public room DTO");
    assert.equal("rng" in room, false, "RNG state must not leak from the public room DTO");
  }
  console.log(`E2E MVP: PASS — bounded public account body, recovery session rotation, final-pack deletion, repeat economy operation IDs, Ranked fail-closed, casual PvP DTO isolation (${roomCode})`);
}

void main();
