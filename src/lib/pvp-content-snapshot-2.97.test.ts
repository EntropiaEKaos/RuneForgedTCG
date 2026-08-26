import assert from "node:assert/strict";
import { createCustomGame } from "@/game/engine";
import { resolveRankedPrecon, RANKED_PRECONS } from "@/game/ranked-decks";
import { snapshotReplayBundle } from "@/game/replay-content-snapshot";
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
assert.equal(pass.ok, true);
if (!pass.ok) throw new Error(pass.error);
assert.notEqual(pass.next, state);
assert.equal(pass.next.activePlayer, "ai");

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

console.log("PVP CONTENT SNAPSHOT 2.97 BEHAVIOR: PASS (immutable content + authorization + tamper rejection)");
