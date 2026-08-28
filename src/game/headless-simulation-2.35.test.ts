import assert from "node:assert/strict";
import { DECKS } from "./decks";
import { simulateMatch } from "./reducer";

const rounds: number[] = [];
for (let index = 0; index < DECKS.length; index++) {
  const player = DECKS[index];
  const opponent = DECKS[(index + 1) % DECKS.length];
  const result = simulateMatch(player.name, player, opponent, index % 2 === 0, 700);
  assert.equal(result.final.phase, "gameover", `${player.id} vs ${opponent.id} did not finish`);
  assert.ok(result.final.winner, `${player.id} vs ${opponent.id} has no winner`);
  assert.ok(result.final.round >= 3 && result.final.round <= 40, `${player.id} vs ${opponent.id} ended at abnormal round ${result.final.round}`);
  assert.ok(result.aiMoves > 0, `${player.id} vs ${opponent.id} never played a card`);
  rounds.push(result.final.round);
}

const average = rounds.reduce((sum, round) => sum + round, 0) / rounds.length;
assert.ok(average >= 5 && average <= 20, `average match length ${average.toFixed(1)} is outside the pacing envelope`);
console.log(`HEADLESS SIMULATION 2.35: PASS (${average.toFixed(1)} average rounds)`);
