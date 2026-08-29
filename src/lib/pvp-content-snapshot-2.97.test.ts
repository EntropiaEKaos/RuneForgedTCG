import assert from "node:assert/strict";
import { createCustomGame } from "@/game/engine";
import { resolveRankedPrecon, RANKED_PRECONS } from "@/game/ranked-decks";
import { cardDefinitionsHash, snapshotReplayBundle, verifyReplayBundle } from "@/game/replay-content-snapshot";
import { applyAuthoritativePvpSnapshotAction } from "@/lib/pvp-authoritative-transition";

const host = resolveRankedPrecon(RANKED_PRECONS[0].id);
const guest = resolveRankedPrecon(RANKED_PRECONS[1].id);
const snapshot = snapshotReplayBundle(host, guest);
const state = createCustomGame("Host", host, guest, {
  skipMulligan: true,
  playerGoesFirst: true,
  seed: 297001,
});

const pass = applyAuthoritativePvpSnapshotAction({
  state,
  gameAction: { type: "pass", player: "player" },
  actor: "player",
  contentSnapshot: snapshot,
  contentHash: snapshot.contentHash,
});
if (!pass.ok) throw new Error(pass.error);
assert.equal(pass.ok, true);
assert.notEqual(pass.next, state);
assert.equal(pass.next.activePlayer, "ai");

// PostgreSQL JSONB preserves values but not object-key insertion order. Simulate
// that round-trip by recursively rebuilding every object in reverse key order.
// A semantic snapshot must retain the same digest and remain authoritative.
function reorderObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reorderObjectKeys);
  if (!value || typeof value !== "object") return value;
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([key, child]) => [key, reorderObjectKeys(child)] as const);
  return Object.fromEntries(entries);
}

const jsonbRoundTrip = reorderObjectKeys(structuredClone(snapshot)) as typeof snapshot;
assert.equal(cardDefinitionsHash(jsonbRoundTrip.cardDefs), snapshot.contentHash);
assert.equal(verifyReplayBundle(jsonbRoundTrip), true);

const persistedPass = applyAuthoritativePvpSnapshotAction({
  state,
  gameAction: { type: "pass", player: "player" },
  actor: "player",
  contentSnapshot: jsonbRoundTrip,
  contentHash: snapshot.contentHash,
});
if (!persistedPass.ok) throw new Error(persistedPass.error);
assert.equal(persistedPass.ok, true);
assert.equal(persistedPass.next.activePlayer, "ai");

const wrongActor = applyAuthoritativePvpSnapshotAction({
  state,
  gameAction: { type: "pass", player: "ai" },
  actor: "player",
  contentSnapshot: snapshot,
  contentHash: snapshot.contentHash,
});
assert.equal(wrongActor.ok, false);
if (wrongActor.ok) throw new Error("wrong actor unexpectedly accepted");
assert.equal(wrongActor.status, 403);

const wrongHash = applyAuthoritativePvpSnapshotAction({
  state,
  gameAction: { type: "pass", player: "player" },
  actor: "player",
  contentSnapshot: snapshot,
  contentHash: "tampered",
});
assert.equal(wrongHash.ok, false);
if (wrongHash.ok) throw new Error("wrong content hash unexpectedly accepted");
assert.equal(wrongHash.status, 409);
assert.equal(wrongHash.code, "MATCH_CONTENT_SNAPSHOT_INVALID");

const tampered = structuredClone(snapshot);
tampered.cardDefs[0] = { ...tampered.cardDefs[0], cost: tampered.cardDefs[0].cost + 1 };
const tamperedResult = applyAuthoritativePvpSnapshotAction({
  state,
  gameAction: { type: "pass", player: "player" },
  actor: "player",
  contentSnapshot: tampered,
  contentHash: snapshot.contentHash,
});
assert.equal(tamperedResult.ok, false);
if (tamperedResult.ok) throw new Error("tampered snapshot unexpectedly accepted");
assert.equal(tamperedResult.status, 409);

console.log("PVP CONTENT SNAPSHOT 2.97 BEHAVIOR: PASS (canonical JSONB hash + immutable content + authorization + tamper rejection)");
