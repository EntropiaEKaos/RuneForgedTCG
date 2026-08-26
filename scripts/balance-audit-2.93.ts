import { DECKS } from "../src/game/decks";
import { summarizeBalance } from "../src/game/balance-health";
import { runBalanceSimulation } from "../src/lib/balance-simulator";

const games = Math.max(20, Math.min(1_000, Number(process.argv[2]) || 100));
const enforce = process.argv.includes("--enforce");
const rows = [];

for (let left = 0; left < DECKS.length; left += 1) {
  for (let right = left + 1; right < DECKS.length; right += 1) {
    rows.push(runBalanceSimulation(DECKS[left].id, DECKS[right].id, games, 293_000 + left * 101 + right));
  }
}

const health = summarizeBalance(rows);
console.log(JSON.stringify({ version: "2.93", gamesPerMatchup: games, matchups: rows.length, health }, null, 2));
if (enforce && health.releaseGate === "blocked") {
  console.error(`RANKED BALANCE GATE: BLOCKED (${health.criticalMatchups} critical matchups)`);
  process.exitCode = 1;
}
