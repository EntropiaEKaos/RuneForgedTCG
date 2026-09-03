import assert from "node:assert/strict";
import { createCustomGame } from "@/game/engine";
import { putInGraveyard } from "@/game/graveyard";
import { RANKED_PRECONS, resolveRankedPrecon } from "@/game/ranked-decks";
import { toPvpParticipantGameState, toPvpParticipantReactionState } from "@/lib/pvp-public-state";
import type { PvpReactionPriorityState } from "@/lib/pvp-reaction-priority";

const hostDeck = resolveRankedPrecon(RANKED_PRECONS[0].id);
const guestDeck = resolveRankedPrecon(RANKED_PRECONS[1].id);
const state = createCustomGame("Host", hostDeck, guestDeck, {
  seed: 297177,
  skipMulligan: true,
  playerGoesFirst: true,
  playerStartingHand: 4,
  aiStartingHand: 4,
});
putInGraveyard(state, "player", hostDeck.cards[0]!, "discard", "host-graveyard-source");
putInGraveyard(state, "ai", guestDeck.cards[0]!, "mill", "guest-graveyard-source");
const original = structuredClone(state);

const hostView = toPvpParticipantGameState(state, false);
assert.deepEqual(hostView.players.player.hand, original.players.player.hand, "host keeps only its own hand visible");
assert.equal(hostView.players.ai.hand.length, original.players.ai.hand.length);
assert.ok(hostView.players.ai.hand.every((card) => "hidden" in (card as unknown as Record<string, unknown>)), "host cannot inspect guest hand");
for (const pid of ["player", "ai"] as const) {
  assert.ok(hostView.players[pid].deck.every((card) => card === "__hidden__"), `${pid} future deck order is hidden`);
  assert.ok(hostView.players[pid].graveyard?.every((entry) => entry.owner === pid), `${pid} public graveyard ownership is stable for host view`);
}
assert.equal(hostView.players.player.graveyard?.[0]?.reason, "discard");
assert.equal(hostView.players.ai.graveyard?.[0]?.reason, "mill");
assert.equal(hostView.seed, 0);
assert.equal(hostView.rngState, 0);
assert.equal(hostView.idCounter, 0);
assert.equal(hostView.graveyardSequence, 0, "host cannot inspect the authoritative graveyard id sequence");

const guestView = toPvpParticipantGameState(state, true);
assert.deepEqual(guestView.players.player.hand, original.players.ai.hand, "guest is re-oriented and keeps only its own hand visible");
assert.equal(guestView.players.ai.hand.length, original.players.player.hand.length);
assert.ok(guestView.players.ai.hand.every((card) => "hidden" in (card as unknown as Record<string, unknown>)), "guest cannot inspect host hand");
assert.equal(guestView.activePlayer, original.activePlayer === "player" ? "ai" : "player");
assert.equal(guestView.attackToken, original.attackToken === "player" ? "ai" : "player");
assert.equal(guestView.players.player.graveyard?.[0]?.defId, original.players.ai.graveyard?.[0]?.defId, "guest sees its own authoritative graveyard in the local player seat");
assert.equal(guestView.players.player.graveyard?.[0]?.owner, "player", "guest graveyard owner is re-oriented to local player");
assert.equal(guestView.players.ai.graveyard?.[0]?.owner, "ai", "host graveyard owner is re-oriented to local opponent");
assert.equal(guestView.graveyardSequence, 0, "guest cannot inspect the authoritative graveyard id sequence");

const reaction: PvpReactionPriorityState = {
  protocolVersion: 1,
  pendingAction: { kind: "spell", player: "ai", instanceId: "guest-pending", defId: "ember_bolt", targetInstanceId: "host-target" },
  actor: "ai",
  responder: "player",
  openedAt: 1_000,
  deadlineAt: 11_000,
};
const hostReaction = toPvpParticipantReactionState(reaction, false);
assert.equal(hostReaction?.actor, "ai");
assert.equal(hostReaction?.responder, "player");
assert.equal(hostReaction?.pendingAction.player, "ai");
assert.equal(hostReaction?.pendingAction.instanceId, "guest-pending");

const guestReaction = toPvpParticipantReactionState(reaction, true);
assert.equal(guestReaction?.actor, "player", "guest sees its canonical ai seat re-oriented to local player");
assert.equal(guestReaction?.responder, "ai", "host responder is re-oriented to guest opponent");
assert.equal(guestReaction?.pendingAction.player, "player");
assert.equal(guestReaction?.pendingAction.instanceId, "guest-pending", "stable stack instance id is preserved across orientation");
assert.equal(guestReaction?.pendingAction.targetInstanceId, "host-target", "stable target instance id is preserved across orientation");
assert.deepEqual(reaction, {
  protocolVersion: 1,
  pendingAction: { kind: "spell", player: "ai", instanceId: "guest-pending", defId: "ember_bolt", targetInstanceId: "host-target" },
  actor: "ai",
  responder: "player",
  openedAt: 1_000,
  deadlineAt: 11_000,
}, "reaction projection never mutates authoritative priority state");

assert.deepEqual(state, original, "public projection never mutates authoritative state");
console.log("PVP PUBLIC STATE 2.97 BEHAVIOR: PASS (orientation + public graveyards + hidden hands/decks/RNG/zone counters + reaction priority projection + no server-state mutation)");
