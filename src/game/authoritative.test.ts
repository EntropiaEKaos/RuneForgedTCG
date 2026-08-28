import { createCustomGame } from "./engine";
import { replayAuthoritativeMatch } from "./authoritative";
import type { GameAction } from "./reducer";
import { actionLogHash, replayIntegrity, stateHash } from "@/lib/match-integrity";

const deck = { id: "test", name: "Test", cards: ["ember_whelp", "ember_whelp", "ember_whelp"] };

const state = createCustomGame("Tester", deck, deck, {
  playerGoesFirst: true,
  skipMulligan: true,
  playerStartingHand: 0,
  aiStartingHand: 0,
  playerStartingMana: 1,
  aiStartingMana: 1,
  playerNexus: 20,
  aiNexus: 1,
  playerBench: ["ember_whelp"],
  seed: 123456,
});

const attacker = state.players.player.bench[0].instanceId;
const result = replayAuthoritativeMatch({
  playerName: "Tester",
  playerDeck: deck,
  aiDeck: deck,
  playerGoesFirst: true,
  seed: 123456,
  actions: [{ type: "attack", player: "player", attackerIds: [attacker], challenges: {} }],
  customOptions: { skipMulligan: true, playerStartingHand: 0, aiStartingHand: 0, playerStartingMana: 1, aiStartingMana: 1, playerNexus: 20, aiNexus: 1, playerBench: ["ember_whelp"] },
});

if (result.state.winner !== "player") throw new Error("Authoritative replay did not reproduce the win");
if (result.state.players.player.nexusHealth !== 20) throw new Error("Unexpected player nexus mutation");
if (result.state.seed !== 123456) throw new Error("Seed was not preserved");

const again = replayAuthoritativeMatch({
  playerName: "Tester",
  playerDeck: deck,
  aiDeck: deck,
  playerGoesFirst: true,
  seed: 123456,
  actions: [{ type: "attack", player: "player", attackerIds: [attacker], challenges: {} }],
  customOptions: { skipMulligan: true, playerStartingHand: 0, aiStartingHand: 0, playerStartingMana: 1, aiStartingMana: 1, playerNexus: 20, aiNexus: 1, playerBench: ["ember_whelp"] },
});
if (JSON.stringify(result.state) !== JSON.stringify(again.state)) throw new Error("Replay is not deterministic");
if (result.events.length !== again.events.length) throw new Error("Event derivation is not deterministic");
const actions: GameAction[] = [{ type: "attack", player: "player", attackerIds: [attacker], challenges: {} }];
if (actionLogHash([...actions]) !== actionLogHash([...actions])) throw new Error("Action hash is not deterministic");
if (!stateHash(result.state) || !replayIntegrity([...actions], result.state)) throw new Error("Replay integrity hash missing");

console.log("Authoritative engine tests passed.");
