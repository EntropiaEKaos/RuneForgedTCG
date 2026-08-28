import { DECKS } from "../src/game/decks";
import { summarizeBalance } from "../src/game/balance-health";
import { runBalanceSimulation } from "../src/lib/balance-simulator";

const games = Math.max(20, Number(process.argv[2]) || 200);
const rows = [];

for (let left = 0; left < DECKS.length; left += 1) {
  for (let right = left + 1; right < DECKS.length; right += 1) {
    const row = runBalanceSimulation(
      DECKS[left].id,
      DECKS[right].id,
      games,
      287_000 + left * 101 + right,
    );
    rows.push(row);
    console.log(`${row.deckA}\t${row.deckB}\t${row.winRateA}\t${row.winRateB}\t${row.firstPlayerWinRate}\t${row.avgRounds}`);
  }
}

console.log(JSON.stringify({ gamesPerMatchup: games, matchups: rows.length, health: summarizeBalance(rows) }, null, 2));
