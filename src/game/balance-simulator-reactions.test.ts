import assert from "node:assert/strict";
import { aiChooseReaction } from "./ai";
import { getCard } from "./cards";
import {
  canCastReaction,
  createCustomGame,
  makeUnit,
  type CardAction,
} from "./engine";
import type { DeckInput, GameState } from "./types";
import {
  runBalanceSimulationWithTelemetry,
  runStackAwareBalanceSimulation,
  runStackAwareBalanceSimulationWithTelemetry,
} from "../lib/balance-simulator";

const baseDeck: DeckInput = {
  id: "starter-trap-policy-probe",
  name: "Starter Trap Policy Probe",
  cards: Array(40).fill("ember_whelp"),
};

function reactionState(): GameState {
  const state = createCustomGame("Starter Trap Policy", baseDeck, baseDeck, {
    seed: 606060,
    skipMulligan: true,
    playerGoesFirst: false,
    playerStartingHand: 0,
    aiStartingHand: 0,
    playerStartingMana: 10,
    aiStartingMana: 10,
  });
  state.phase = "main";
  state.activePlayer = "ai";
  state.players.player.hand = [];
  state.players.ai.hand = [];
  state.players.player.spellMana = 3;
  state.players.ai.spellMana = 3;
  return state;
}

function pendingUnit(state: GameState): CardAction {
  state.players.ai.hand = [{ instanceId: "pending-unit", defId: "ember_whelp" }];
  return {
    kind: "unit",
    player: "ai",
    instanceId: "pending-unit",
    defId: "ember_whelp",
  };
}

function putTrap(state: GameState, defId: string): void {
  state.players.player.hand = [{ instanceId: "trap-card", defId }];
}

function expectTrapReaction(
  defId: string,
  configure: (state: GameState) => CardAction,
  expectedTarget?: (state: GameState, pending: CardAction) => string | undefined,
): void {
  const state = reactionState();
  putTrap(state, defId);
  const pending = configure(state);
  const reaction = aiChooseReaction(state, pending, "player");
  assert.ok(reaction, `${defId} must produce a legal AI reaction`);
  assert.equal(reaction.defId, defId, `${defId} must be the selected reaction card`);
  if (expectedTarget) {
    assert.equal(
      reaction.targetInstanceId,
      expectedTarget(state, pending),
      `${defId} must select the certified reaction target`,
    );
  }
}

expectTrapReaction("rfalpha_ember_trap_ash_snare", pendingUnit);

expectTrapReaction("rfalpha_void_trap_early_eclipse", pendingUnit);

expectTrapReaction(
  "rfalpha_forest_trap_pack_ambush",
  (state) => {
    state.players.player.bench = [makeUnit(state, "forest_cub", "player")];
    return pendingUnit(state);
  },
);

expectTrapReaction(
  "rfalpha_wood_trap_emergency_bark",
  (state) => {
    state.players.player.bench = [makeUnit(state, "wood_cub", "player")];
    return pendingUnit(state);
  },
  (state) => state.players.player.bench[0]?.instanceId,
);

expectTrapReaction(
  "rfalpha_storm_trap_crosswind",
  (state) => {
    state.players.ai.bench = [makeUnit(state, "ember_whelp", "ai")];
    return pendingUnit(state);
  },
  (state) => state.players.ai.bench[0]?.instanceId,
);

expectTrapReaction(
  "rfalpha_tide_trap_countercurrent",
  (state) => {
    state.players.player.bench = [makeUnit(state, "wood_cub", "player")];
    state.players.ai.hand = [{ instanceId: "pending-spell", defId: "ember_bolt" }];
    return {
      kind: "spell",
      player: "ai",
      instanceId: "pending-spell",
      defId: "ember_bolt",
      targetInstanceId: state.players.player.bench[0]!.instanceId,
    };
  },
  (_state, pending) => pending.instanceId,
);

{
  const state = reactionState();
  putTrap(state, "rfalpha_tide_trap_countercurrent");
  assert.equal(getCard("rfalpha_tide_trap_countercurrent").speed, "Burst");
  assert.equal(
    canCastReaction(state, "player", "trap-card", "spell"),
    true,
    "Tide counter Trap must be legally castable against a pending Spell",
  );
}

const trapDeck: DeckInput = {
  id: "stack-aware-trap-probe",
  name: "Stack-aware Trap Probe",
  cards: Array(40).fill("rfalpha_ember_trap_ash_snare"),
};
const unitDeck: DeckInput = {
  id: "stack-aware-unit-probe",
  name: "Stack-aware Unit Probe",
  cards: Array(40).fill("ember_whelp"),
};
const overrides = {
  [trapDeck.id]: trapDeck,
  [unitDeck.id]: unitDeck,
};

const historical = runBalanceSimulationWithTelemetry(
  trapDeck.id,
  unitDeck.id,
  8,
  424242,
  overrides,
);
assert.equal(
  historical.telemetry.decks[trapDeck.id]!.cards["rfalpha_ember_trap_ash_snare"]!.played,
  0,
  "historical balance mode must remain reaction-free for backwards-compatible baselines",
);

const stackPlain = runStackAwareBalanceSimulation(
  trapDeck.id,
  unitDeck.id,
  8,
  424242,
  overrides,
);
const stackTelemetry = runStackAwareBalanceSimulationWithTelemetry(
  trapDeck.id,
  unitDeck.id,
  8,
  424242,
  overrides,
);
assert.deepEqual(
  stackTelemetry.summary,
  stackPlain,
  "stack-aware telemetry must remain read-only and preserve deterministic outcomes",
);
assert.ok(
  stackTelemetry.telemetry.decks[trapDeck.id]!.cards["rfalpha_ember_trap_ash_snare"]!.played > 0,
  "stack-aware balance mode must resolve real Trap reactions",
);

console.log(
  "BALANCE SIMULATOR REACTIONS: PASS — 6 starter Traps are AI-usable · Tide counter timing legal · historical mode preserved · stack-aware telemetry non-interfering",
);
