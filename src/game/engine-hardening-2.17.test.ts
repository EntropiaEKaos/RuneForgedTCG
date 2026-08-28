import assert from "node:assert/strict";
import { createCustomGame, declareAttack } from "./engine";
import { DECKS } from "./decks";
import { validateGameActionSemantics, assertInstanceExists } from "./action-validator";
import { assertReplayActionAllowed, deriveReplayStage } from "./replay-protocol";
import type { GameAction } from "./reducer";

let checks = 0;
function check(value: unknown, message: string) { assert.ok(value, message); checks++; }
function rejects(fn: () => void, message: string) { assert.throws(fn, message); checks++; }

const pDeck = DECKS[0];
const aDeck = DECKS[1];
const state = createCustomGame("Tester", pDeck, aDeck, { seed: 217, playerGoesFirst: true, skipMulligan: true, playerBench: ["ember_whelp", "ember_whelp"], aiBench: ["tide_sprite", "tide_sprite"] });
state.players.player.hand.push({ instanceId: "test_spell", defId: "ember_bolt" });
state.players.player.hand.push({ instanceId: "test_unit", defId: "ember_whelp" });
const atk1 = state.players.player.bench[0].instanceId;
const atk2 = state.players.player.bench[1].instanceId;
const def1 = state.players.ai.bench[0].instanceId;
const def2 = state.players.ai.bench[1].instanceId;

check(deriveReplayStage(state).stage === "main", "skip-mulligan game starts in replay main stage");
check(validateGameActionSemantics(state, { type: "aiStep" }, "player").ok === false, "aiStep server-only");
check(validateGameActionSemantics(state, { type: "resolve" }, "player").ok === false, "resolve server-only");
check(validateGameActionSemantics(state, { type: "play", player: "ai", instanceId: "test_unit" }, "player").ok === false, "wrong actor rejected");
check(validateGameActionSemantics(state, { type: "play", player: "player", instanceId: "missing" }, "player").ok === false, "missing hand instance rejected");
check(validateGameActionSemantics(state, { type: "cast", player: "player", instanceId: "test_unit" }, "player").ok === false, "cast unit rejected");
check(validateGameActionSemantics(state, { type: "cast", player: "player", instanceId: "test_spell" }, "player").ok === false, "targeted spell without target rejected");
check(validateGameActionSemantics(state, { type: "cast", player: "player", instanceId: "test_spell", target: "missing" }, "player").ok === false, "missing spell target rejected");
check(validateGameActionSemantics(state, { type: "cast", player: "player", instanceId: "test_spell", target: def1 }, "player").ok === true, "existing unit target accepted");
check(validateGameActionSemantics(state, { type: "attack", player: "player", attackerIds: [] }, "player").ok === false, "empty attack rejected");
check(validateGameActionSemantics(state, { type: "attack", player: "player", attackerIds: [atk1, atk1] }, "player").ok === false, "duplicate attacker rejected");
check(validateGameActionSemantics(state, { type: "attack", player: "player", attackerIds: ["missing"] }, "player").ok === false, "missing attacker rejected");
check(validateGameActionSemantics(state, { type: "attack", player: "player", attackerIds: [atk1] }, "player").ok === true, "ready attacker accepted");
check(validateGameActionSemantics(state, { type: "attack", player: "player", attackerIds: [atk1], challenges: { [atk1]: def1 } }, "player").ok === false, "non-Challenger challenge rejected");
check(validateGameActionSemantics(state, { type: "attack", player: "player", attackerIds: [atk1], sentinelaTargets: { [atk1]: "missing" } }, "player").ok === false, "missing sentinela target rejected");
check(validateGameActionSemantics(state, { type: "sentinela", player: "player", sentinelaId: "missing", abilityIndex: 0 }, "player").ok === false, "missing sentinela activation rejected");
check(validateGameActionSemantics(state, { type: "mulligan", player: "player", cardIds: ["x", "x"] }, "player").ok === false, "duplicate mulligan rejected");
check(validateGameActionSemantics(state, { type: "mulligan", player: "player", cardIds: ["missing"] }, "player").ok === false, "foreign mulligan card rejected");
check(validateGameActionSemantics(state, { type: "skipMulligan", player: "player" }, "player").ok === true, "skip mulligan semantic shape accepted");
check(validateGameActionSemantics(state, { type: "pass", player: "player" }, "player").ok === true, "pass semantic shape accepted");

assertInstanceExists(state, atk1); checks++;
assertInstanceExists(state, def1, ["bench"]); checks++;
assertInstanceExists(state, "test_spell", ["hand"]); checks++;
rejects(() => assertInstanceExists(state, "totally_missing"), "global instance guard rejects unknown id");
rejects(() => assertInstanceExists(state, "test_spell", ["bench"]), "instance guard respects zones");

assertReplayActionAllowed(state, { type: "pass", player: "player" }, "player"); checks++;
assertReplayActionAllowed(state, { type: "attack", player: "player", attackerIds: [atk1] }, "player"); checks++;
rejects(() => assertReplayActionAllowed(state, { type: "block", blocks: {} }, "player"), "block rejected in main");
rejects(() => assertReplayActionAllowed(state, { type: "mulligan", player: "player", cardIds: [] }, "player"), "mulligan rejected in main");
rejects(() => assertReplayActionAllowed(state, { type: "skipMulligan", player: "player" }, "player"), "skip mulligan rejected in main");
rejects(() => assertReplayActionAllowed(state, { type: "react", player: "player", instanceId: "test_spell" }, "player"), "reaction rejected without reaction stage");
rejects(() => assertReplayActionAllowed(state, { type: "resolve" }, "player"), "resolve rejected without reaction stage");
rejects(() => assertReplayActionAllowed(state, { type: "aiStep" }, "player"), "client aiStep rejected in main");
assertReplayActionAllowed(state, { type: "resolve" }, "player", true); checks++;
assertReplayActionAllowed(state, { type: "react", player: "player", instanceId: "test_spell", target: def1 }, "player", true); checks++;
rejects(() => assertReplayActionAllowed(state, { type: "pass", player: "player" }, "player", true), "pass rejected during reaction");

const mulliganState = createCustomGame("Tester", pDeck, aDeck, { seed: 218, playerGoesFirst: true, skipMulligan: false });
check(deriveReplayStage(mulliganState).stage === "mulligan", "mulligan stage derived");
assertReplayActionAllowed(mulliganState, { type: "skipMulligan", player: "player" }, "player"); checks++;
assertReplayActionAllowed(mulliganState, { type: "mulligan", player: "player", cardIds: [] }, "player"); checks++;
rejects(() => assertReplayActionAllowed(mulliganState, { type: "pass", player: "player" }, "player"), "pass rejected before mulligan");
rejects(() => assertReplayActionAllowed(mulliganState, { type: "attack", player: "player", attackerIds: [] }, "player"), "attack rejected before mulligan");

const combat = declareAttack(state, "player", [atk1, atk2]);
check(combat.phase === "blocking", "attack enters blocking");
check(deriveReplayStage(combat).stage === "blocking", "blocking stage derived");
check(validateGameActionSemantics(combat, { type: "block", blocks: { [atk1]: def1 } }, "ai").ok === true, "valid block accepted");
check(validateGameActionSemantics(combat, { type: "block", blocks: { missing: def1 } }, "ai").ok === false, "fake attacker block rejected");
check(validateGameActionSemantics(combat, { type: "block", blocks: { [atk1]: "missing" } }, "ai").ok === false, "fake blocker rejected");
check(validateGameActionSemantics(combat, { type: "block", blocks: { [atk1]: def1, [atk2]: def1 } }, "ai").ok === false, "same blocker reused rejected");
assertReplayActionAllowed(combat, { type: "block", blocks: { [atk1]: def1 } }, "ai"); checks++;
rejects(() => assertReplayActionAllowed(combat, { type: "pass", player: "ai" }, "ai"), "pass rejected while blockers required");
rejects(() => assertReplayActionAllowed(combat, { type: "block", blocks: {} }, "player"), "attacker cannot submit blockers");

const exhausted = structuredClone(state);
exhausted.players.player.bench[0].hasAttackedThisTurn = true;
check(validateGameActionSemantics(exhausted, { type: "attack", player: "player", attackerIds: [exhausted.players.player.bench[0].instanceId] }, "player").ok === false, "already-attacked unit rejected");
const stunned = structuredClone(state);
stunned.players.player.bench[0].stunned = true;
check(validateGameActionSemantics(stunned, { type: "attack", player: "player", attackerIds: [stunned.players.player.bench[0].instanceId] }, "player").ok === false, "stunned attacker rejected");
const summoned = structuredClone(state);
summoned.players.player.bench[0].summonedThisTurn = true;
check(validateGameActionSemantics(summoned, { type: "attack", player: "player", attackerIds: [summoned.players.player.bench[0].instanceId] }, "player").ok === false, "summoning-sick attacker rejected");
const noToken = structuredClone(state);
noToken.attackToken = "ai";
check(validateGameActionSemantics(noToken, { type: "attack", player: "player", attackerIds: [atk1] }, "player").ok === false, "attack without token rejected");
const usedToken = structuredClone(state);
usedToken.hasAttackedThisTurn = true;
check(validateGameActionSemantics(usedToken, { type: "attack", player: "player", attackerIds: [atk1] }, "player").ok === false, "second attack declaration rejected");


const sentState = structuredClone(state);
sentState.players.player.sentinelas.push({ instanceId: "sen_test", defId: "sent_vulkar", owner: "player", loyalty: 4, activatedThisTurn: false });
check(validateGameActionSemantics(sentState, { type: "sentinela", player: "player", sentinelaId: "sen_test", abilityIndex: 0 }, "player").ok === false, "targeted sentinela ability requires target");
check(validateGameActionSemantics(sentState, { type: "sentinela", player: "player", sentinelaId: "sen_test", abilityIndex: 0, target: def1 }, "player").ok === true, "targeted sentinela ability accepts legal target");
check(validateGameActionSemantics(sentState, { type: "sentinela", player: "player", sentinelaId: "sen_test", abilityIndex: 0, target: "missing" }, "player").ok === false, "targeted sentinela ability rejects missing target");
check(validateGameActionSemantics(sentState, { type: "sentinela", player: "player", sentinelaId: "sen_test", abilityIndex: 1, target: def1 }, "player").ok === false, "untargeted sentinela ability rejects injected target");
const sentUsed = structuredClone(sentState); sentUsed.players.player.sentinelas[0].activatedThisTurn = true;
check(validateGameActionSemantics(sentUsed, { type: "sentinela", player: "player", sentinelaId: "sen_test", abilityIndex: 0, target: def1 }, "player").ok === false, "already activated sentinela rejected");
const sentLow = structuredClone(sentState); sentLow.players.player.sentinelas[0].loyalty = 1;
check(validateGameActionSemantics(sentLow, { type: "sentinela", player: "player", sentinelaId: "sen_test", abilityIndex: 1 }, "player").ok === false, "sentinela with insufficient loyalty rejected");
const sentWrongTurn = structuredClone(sentState); sentWrongTurn.activePlayer = "ai";
check(validateGameActionSemantics(sentWrongTurn, { type: "sentinela", player: "player", sentinelaId: "sen_test", abilityIndex: 0, target: def1 }, "player").ok === false, "sentinela activation outside owner turn rejected");

const gameover = structuredClone(state); gameover.phase = "gameover"; gameover.winner = "player";
check(deriveReplayStage(gameover).stage === "gameover", "gameover stage derived");
rejects(() => assertReplayActionAllowed(gameover, { type: "pass", player: "player" }, "player"), "actions after gameover rejected");

assert.ok(checks >= 50, `expected at least 50 hardening checks, got ${checks}`);
console.log(`ENGINE HARDENING 2.17: PASS (${checks} checks)`);
