import assert from "node:assert/strict";
import { createCustomGame } from "@/game/engine";
import { RANKED_PRECONS, resolveRankedPrecon } from "@/game/ranked-decks";
import { toPvpParticipantGameState } from "@/lib/pvp-public-state";

const hostDeck = resolveRankedPrecon(RANKED_PRECONS[0].id);
const guestDeck = resolveRankedPrecon(RANKED_PRECONS[1].id);
const state = createCustomGame("Host", hostDeck, guestDeck, {
  seed: 297177,
  skipMulligan: true,
  playerGoesFirst: true,
  playerStartingHand: 4,
  aiStartingHand: 4,
});
const original = structuredClone(state);

const hostView = toPvpParticipantGameState(state, false);
assert.deepEqual(hostView.players.player.hand, original.players.player.hand, "host keeps only its own hand visible");
assert.equal(hostView.players.ai.hand.length, original.players.ai.hand.length);
assert.ok(hostView.players.ai.hand.every((card) => "hidden" in (card as unknown as Record<string, unknown>)), "host cannot inspect guest hand");
for (const pid of ["player", "ai"] as const) {
  assert.ok(hostView.players[pid].deck.every((card) => card === "__hidden__"), `${pid} future deck order is hidden`);
}
assert.equal(hostView.seed, 0);
assert.equal(hostView.rngState, 0);
assert.equal(hostView.idCounter, 0);

const guestView = toPvpParticipantGameState(state, true);
assert.deepEqual(guestView.players.player.hand, original.players.ai.hand, "guest is re-oriented and keeps only its own hand visible");
assert.equal(guestView.players.ai.hand.length, original.players.player.hand.length);
assert.ok(guestView.players.ai.hand.every((card) => "hidden" in (card as unknown as Record<string, unknown>)), "guest cannot inspect host hand");
assert.equal(guestView.activePlayer, original.activePlayer === "player" ? "ai" : "player");
assert.equal(guestView.attackToken, original.attackToken === "player" ? "ai" : "player");

assert.deepEqual(state, original, "public projection never mutates authoritative state");
console.log("PVP PUBLIC STATE 2.97 BEHAVIOR: PASS (orientation + hidden hands/decks/RNG + no server-state mutation)");
