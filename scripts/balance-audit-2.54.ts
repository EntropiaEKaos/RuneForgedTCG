import { DECKS } from "../src/game/decks";
import { runBalanceSimulation } from "../src/lib/balance-simulator";

const games = Math.max(2, Math.min(200, Number(process.env.BALANCE_GAMES_PER_PAIR) || 12));
const summaries = [];
for (let a = 0; a < DECKS.length; a += 1) {
  for (let b = a + 1; b < DECKS.length; b += 1) {
    summaries.push(runBalanceSimulation(DECKS[a].id, DECKS[b].id, games, 254_000 + a * 101 + b));
  }
}
console.log(JSON.stringify({ version: "2.54", gamesPerPair: games, matchups: summaries }, null, 2));
