import fs from "node:fs";
const s = fs.readFileSync("scripts/production-verify.ts", "utf8");
const required = [
  "players non-negative economy",
  "card ownership <= ${duplicateCap}",
  "no duplicate match rewards",
  "repeatable non-reward economy operations",
  "reward economy idempotency",
  "100 serialized DB mutations",
  "FOR UPDATE",
];
for (const x of required) if (!s.includes(x)) throw new Error(`missing production gate: ${x}`);
console.log("PRODUCTION GATE REGRESSION: PASS");
