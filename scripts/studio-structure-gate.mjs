import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const limits = new Map([
  ["src/app/admin/studio/cards/CardAuthoringStudio.tsx", 12000],
  ["src/app/admin/studio/cards/CardIdentityTab.tsx", 12000],
  ["src/app/admin/studio/cards/CardClassificationTab.tsx", 16000],
  ["src/app/admin/studio/cards/CardRulesTab.tsx", 20000],
  ["src/app/admin/studio/cards/CardReleaseTab.tsx", 10000],
]);

for (const [rel, maxBytes] of limits) {
  const full = path.join(root, rel);
  const stat = fs.statSync(full);
  if (stat.size > maxBytes) {
    throw new Error(`${rel} is ${stat.size} bytes; structural limit is ${maxBytes}`);
  }
}

const shell = fs.readFileSync(path.join(root, "src/app/admin/studio/cards/CardAuthoringStudio.tsx"), "utf8");
for (const forbidden of ["Sentinela (Planeswalker)", "Combat Profile", "Release Identity", "Regional identity"]) {
  if (shell.includes(forbidden)) throw new Error(`CardAuthoringStudio shell absorbed tab concern: ${forbidden}`);
}

console.log("CARD STUDIO STRUCTURE: PASS (shell and tab modules remain bounded)");
