import assert from "node:assert/strict";
import type { ReactionActivatedAbility } from "@/game/activated-ability-types";
import { getCard } from "@/game/cards";
import { createCustomGame } from "@/game/engine";
import type { GameAction } from "@/game/reducer";
import { snapshotReplayBundle } from "@/game/replay-content-snapshot";
import type { DeckInput, GameState } from "@/game/types";
import {
  applyAuthoritativePvpSnapshotAction,
  expireAuthoritativePvpSnapshotReaction,
} from "./pvp-authoritative-transition";
import {
  openPvpReactionPriority,
  pvpReactionPriorityExpired,
  resolvePvpReactionPass,
  resolvePvpReactionResponse,
} from "./pvp-reaction-priority";

const deck: DeckInput = {
  id: "pvp-reaction-priority-regression",
  name: "PvP reaction priority regression",
  cards: Array(20).fill("ember_whelp"),
};

const sourceDef = getCard("wood_ent");
const originalAbilities = sourceDef.reactionActivatedAbilities;

type CastAction = Extract<GameAction, { type: "cast" }>;

function baseState() {
  const state = createCustomGame("PvP reaction priority", deck, deck, {
    skipMulligan: true,
    playerGoesFirst: false,
    playerBench: ["wood_ent"],
    playerStartingHand: 0,
    aiStartingHand: 0,
    playerStartingMana: 10,
    aiStartingMana: 10,
    seed: 424242,
  });
  state.phase = "main";
  state.activePlayer = "ai";
  state.players.player.mana = 10;
  state.players.player.maxMana = 10;
  state.players.ai.mana = 10;
  state.players.ai.maxMana = 10;
  state.players.ai.hand = [{ instanceId: "pending-bolt", defId: "ember_bolt" }];
  return state;
}

const pendingCast: CastAction = {
  type: "cast",
  player: "ai",
  instanceId: "pending-bolt",
};

function targetedPendingCast(state: GameState): CastAction {
  const target = state.players.player.bench[0]?.instanceId;
  assert.ok(target, "PvP priority fixture requires a legal Ember Bolt target");
  return { ...pendingCast, target };
}

try {
  const negateAbility: ReactionActivatedAbility = {
    description: "Ward the PvP stack",
    respondsTo: ["spell"],
    effect: { kind: "negateSpell", amount: 0, target: "spellOnStack" },
    cost: { mana: 1 },
    maxUsesPerRound: 1,
  };
  sourceDef.reactionActivatedAbilities = [negateAbility];

  {
    const state = baseState();
    const action = targetedPendingCast(state);
    const before = JSON.stringify(state);
    const opened = openPvpReactionPriority(state, action, 1_000, 10_000);
    assert.ok(opened, "a legal opposing battlefield response opens persisted PvP priority");
    assert.equal(JSON.stringify(state), before, "opening priority never mutates the pre-action GameState");
    assert.equal(opened.actor, "ai");
    assert.equal(opened.responder, "player");
    assert.equal(opened.pendingAction.instanceId, "pending-bolt");
    assert.equal(opened.deadlineAt, 11_000);
    assert.equal(pvpReactionPriorityExpired(opened, 10_999), false);
    assert.equal(pvpReactionPriorityExpired(opened, 11_000), true);

    const premature = resolvePvpReactionPass(state, opened, "ai", { timeout: true, now: 10_999 });
    assert.equal(premature.ok, false, "server cannot auto-pass before the authoritative deadline");

    const passed = resolvePvpReactionPass(state, opened, "player");
    assert.equal(passed.ok, true, "priority holder may explicitly pass");
    assert.ok(passed.ok);
    assert.equal(passed.next.players.ai.hand.some((card) => card.instanceId === "pending-bolt"), false, "passed pending spell resolves and leaves hand");
  }

  {
    const state = baseState();
    const source = state.players.player.bench[0];
    const initialHealth = source.health;
    const opened = openPvpReactionPriority(state, targetedPendingCast(state), 2_000, 10_000);
    assert.ok(opened, "targeted spell opens priority for the reaction ability");

    const wrongActor = resolvePvpReactionResponse(state, opened, "ai", {
      type: "react",
      player: "ai",
      instanceId: source.instanceId,
      responseKind: "activatedAbility",
      abilityIndex: 0,
      target: "pending-bolt",
    });
    assert.equal(wrongActor.ok, false, "the action owner cannot steal the responder's priority");

    const reacted = resolvePvpReactionResponse(state, opened, "player", {
      type: "react",
      player: "player",
      instanceId: source.instanceId,
      responseKind: "activatedAbility",
      abilityIndex: 0,
      target: "pending-bolt",
    });
    assert.equal(reacted.ok, true, "exact battlefield response resolves through the certified stack engine");
    assert.ok(reacted.ok);
    assert.equal(reacted.next.players.player.mana, 9, "reaction ability cost is paid exactly once");
    assert.equal(reacted.next.players.player.bench[0].health, initialHealth, "negated pending damage never resolves");
    assert.equal(reacted.next.players.ai.hand.some((card) => card.instanceId === "pending-bolt"), false, "negated pending spell is consumed from hand");
  }

  {
    sourceDef.reactionActivatedAbilities = [];
    const state = baseState();
    state.players.player.hand = [{ instanceId: "deny-response", defId: "tide_deny" }];
    const opened = openPvpReactionPriority(state, targetedPendingCast(state), 3_000, 10_000);
    assert.ok(opened, "historical hand counter also opens the same persisted PvP priority contract");
    const reacted = resolvePvpReactionResponse(state, opened, "player", {
      type: "react",
      player: "player",
      instanceId: "deny-response",
      target: "pending-bolt",
    });
    assert.equal(reacted.ok, true, "hand reaction resolves through the same state machine");
    assert.ok(reacted.ok);
    assert.equal(reacted.next.players.player.hand.some((card) => card.instanceId === "deny-response"), false, "counter card is committed/consumed");
    assert.equal(reacted.next.players.ai.hand.some((card) => card.instanceId === "pending-bolt"), false, "countered pending spell is consumed");
  }

  {
    sourceDef.reactionActivatedAbilities = [];
    const state = baseState();
    state.players.player.hand = [];
    assert.equal(openPvpReactionPriority(state, targetedPendingCast(state), 4_000), null, "no response means no persisted window and normal PvP can resolve immediately");
  }

  {
    sourceDef.reactionActivatedAbilities = [negateAbility];
    const state = baseState();
    const opened = openPvpReactionPriority(state, targetedPendingCast(state), 5_000, 1_000);
    assert.ok(opened);
    const timedOut = resolvePvpReactionPass(state, opened, "ai", { timeout: true, now: 6_000 });
    assert.equal(timedOut.ok, true, "expired priority resolves authoritatively even if the responder disconnected");
    assert.ok(timedOut.ok);
    assert.equal(timedOut.next.players.ai.hand.some((card) => card.instanceId === "pending-bolt"), false);
  }

  {
    sourceDef.reactionActivatedAbilities = [negateAbility];
    const state = baseState();
    const action = targetedPendingCast(state);
    const snapshot = snapshotReplayBundle(deck, deck);
    const opened = applyAuthoritativePvpSnapshotAction({
      state,
      gameAction: action,
      actor: "ai",
      contentSnapshot: snapshot,
      contentHash: snapshot.contentHash,
      now: 7_000,
    });
    assert.equal(opened.ok, true, "snapshot-authoritative transition opens persistent priority");
    assert.ok(opened.ok);
    assert.equal(opened.stateChanged, false, "opening a network window does not resolve the pending action");
    assert.equal(opened.next, state, "authoritative pre-action state identity is preserved while priority is open");
    assert.ok(opened.reactionState);

    const blocked = applyAuthoritativePvpSnapshotAction({
      state,
      gameAction: { type: "pass", player: "ai" },
      actor: "ai",
      reactionState: opened.reactionState,
      contentSnapshot: snapshot,
      contentHash: snapshot.contentHash,
      now: 7_500,
    });
    assert.equal(blocked.ok, false, "action owner cannot act again while opponent owns priority");
    if (!blocked.ok) assert.equal(blocked.code, "PVP_REACTION_PRIORITY_HELD_BY_OPPONENT");

    const passed = applyAuthoritativePvpSnapshotAction({
      state,
      gameAction: { type: "resolve" },
      actor: "player",
      reactionState: opened.reactionState,
      contentSnapshot: snapshot,
      contentHash: snapshot.contentHash,
      now: 8_000,
    });
    assert.equal(passed.ok, true, "historical resolve opcode closes persisted PvP priority");
    assert.ok(passed.ok);
    assert.equal(passed.reactionState, null);
    assert.equal(passed.stateChanged, true);
    assert.equal(passed.next.players.ai.hand.some((card) => card.instanceId === "pending-bolt"), false);

    const timeoutState = baseState();
    const timeoutOpened = openPvpReactionPriority(timeoutState, targetedPendingCast(timeoutState), 9_000, 1_000);
    assert.ok(timeoutOpened);
    const expired = expireAuthoritativePvpSnapshotReaction({
      state: timeoutState,
      reactionState: timeoutOpened,
      contentSnapshot: snapshot,
      contentHash: snapshot.contentHash,
      now: 10_000,
    });
    assert.equal(expired.ok, true, "snapshot-authoritative timeout resolves without responder connectivity");
    assert.ok(expired.ok);
    assert.deepEqual(expired.authorized, { type: "resolve" }, "timeout is replayed through the historical resolve opcode");
    assert.equal(expired.next.players.ai.hand.some((card) => card.instanceId === "pending-bolt"), false);
  }

  console.log("PVP REACTION PRIORITY: PASS — immutable opening, responder authority, snapshot transition, timeout, hand and battlefield responses certified");
} finally {
  sourceDef.reactionActivatedAbilities = originalAbilities;
}
