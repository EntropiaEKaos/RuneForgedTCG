import fs from "node:fs";
import { buildVanillaContentAudit } from "../src/game/vanilla-content-audit";

const writeIndex = process.argv.indexOf("--write");
const writePath = writeIndex >= 0 ? process.argv[writeIndex + 1] : "";
const enforce = process.argv.includes("--enforce");

const report = buildVanillaContentAudit();
const json = JSON.stringify(report, null, 2);

console.log(json);
if (writePath) fs.writeFileSync(writePath, `${json}\n`);

if (enforce && report.gate !== "pass") {
  console.error(`VANILLA 1.0 CONTENT BASELINE: BLOCKED (${report.errors.length} errors)`);
  process.exitCode = 1;
} else if (enforce) {
  console.log(
    `VANILLA 1.0 CONTENT BASELINE: PASS — ${report.totalCards} cards, ${report.experimentalDecks} experimental decks, ${report.experimentalUniqueCards}/${report.experimentalWaveCards} intake coverage`,
  );
}
