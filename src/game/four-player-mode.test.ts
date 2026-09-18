import assert from "node:assert/strict";
import {
  createFourPlayerMode,
  declareFourPlayerAttack,
  drawForActiveSeat,
  eliminateFourPlayerSeat,
  endFourPlayerTurn,
  generalCastCost,
  moveGeneralToStack,
  passFourPlayerPriority,
  projectFourPlayerState,
  pushFourPlayerStackItem,
  returnGeneralToZone,
} from "./four-player-mode";

const participants = [0, 1, 2, 3].map((seat) => ({
  seat: seat as 0 | 1 | 2 | 3,
  playerId: seat + 100,
  playerName: `P${seat + 1}`,
  deck: Array.from({ length: 80 }, (_, index) => `s${seat}-card-${index}`),
  generalDefId: `general-${seat}`,
}));

let state = createFourPlayerMode({ participants, startingLife: 30, startHand: 5, seed: 12345 });
assert.equal(state.seats[0].hand.length, 5);
assert.equal(state.seats[0].deck.length, 75);
assert.equal(state.activeSeat, 0);
assert.equal(state.prioritySeat, 0);

const skipped = drawForActiveSeat(state);
assert.equal(skipped.seats[0].hand.length, 5, "P1 must skip the first normal draw");
state = endFourPlayerTurn(skipped);
assert.equal(state.activeSeat, 1);
state = drawForActiveSeat(state);
assert.equal(state.seats[1].hand.length, 6, "P2-P4 draw normally");

state = { ...state, activeSeat: 0, prioritySeat: 0, turnNumber: 1 };
state = pushFourPlayerStackItem(state, 0, { id: "spell-1", sourceDefId: "spell", ownerSeat: 0, controllerSeat: 0, kind: "card" });
assert.equal(state.prioritySeat, 1);
let pass = passFourPlayerPriority(state, 1); state = pass.state; assert.equal(pass.resolved, null);
pass = passFourPlayerPriority(state, 2); state = pass.state; assert.equal(pass.resolved, null);
pass = passFourPlayerPriority(state, 3); state = pass.state; assert.equal(pass.resolved, null);
pass = passFourPlayerPriority(state, 0); state = pass.state;
assert.equal(pass.resolved?.id, "spell-1", "four consecutive living-seat passes resolve stack top");
assert.equal(state.stack.length, 0);

state = declareFourPlayerAttack(state, 0, [
  { attackerId: "a", controllerSeat: 0, defenderSeat: 1 },
  { attackerId: "b", controllerSeat: 0, defenderSeat: 3 },
]);
assert.deepEqual(state.combat.map((entry) => entry.defenderSeat), [1, 3], "one combat can split attackers across defenders");

assert.equal(generalCastCost(state, 0, 5), 5);
state = moveGeneralToStack(state, 0);
state = returnGeneralToZone(state, 0);
assert.equal(generalCastCost(state, 0, 5), 7, "General recast tax must be +2 per previous zone cast");

state = {
  ...state,
  objects: [
    { id: "owned-by-p2", defId: "x", ownerSeat: 1, controllerSeat: 1, zone: "battlefield" },
    { id: "borrowed-by-p2", defId: "y", ownerSeat: 2, controllerSeat: 1, zone: "battlefield" },
  ],
};
state = eliminateFourPlayerSeat(state, 1);
assert.equal(state.seats[1].eliminated, true);
assert.equal(state.objects.some((object) => object.id === "owned-by-p2"), false, "objects owned by eliminated seats leave the game");
assert.equal(state.objects.find((object) => object.id === "borrowed-by-p2")?.controllerSeat, 2, "borrowed objects return to their living owner");
assert.notEqual(state.activeSeat, 1);
assert.notEqual(state.prioritySeat, 1);

const projection = projectFourPlayerState(state, 0);
const own = projection.seats.find((seat) => seat.seat === 0)!;
const opponent = projection.seats.find((seat) => seat.seat === 2)!;
assert.ok(Array.isArray(own.hand), "viewer receives own hand");
assert.equal(opponent.hand, undefined, "opponent hand identities must never be projected");
assert.equal(typeof opponent.handCount, "number");
assert.equal(typeof opponent.deckCount, "number");

state = eliminateFourPlayerSeat(state, 2);
state = eliminateFourPlayerSeat(state, 3);
assert.equal(state.phase, "gameover");
assert.equal(state.winnerSeat, 0);

console.log("FOUR PLAYER GENERAL MODE CORE: PASS");
