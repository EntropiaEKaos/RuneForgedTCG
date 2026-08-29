import assert from "node:assert/strict";
import { BRAWLS } from "./game-modes";
import { validateControlDefinition } from "./control-plane";

function validate(rules: Record<string, unknown>) {
  return validateControlDefinition({
    domain: "brawls",
    key: "brawl-authority-test",
    name: "Brawl Authority Test",
    payload: {
      id: "brawl-authority-test",
      name: "Brawl Authority Test",
      description: "Behavioral validation fixture",
      emoji: "⚡",
      rules,
    },
  });
}

for (const brawl of BRAWLS) {
  const report = validateControlDefinition({
    domain: "brawls",
    key: brawl.id,
    name: brawl.name,
    description: brawl.description,
    payload: { ...brawl },
  });
  assert.equal(report.passed, true, `${brawl.id} must satisfy the authoritative Brawl contract: ${report.errors.join(" | ")}`);
}

assert.equal(validate({ startingMana: 0, startingHand: 0, startingNexus: 1 }).passed, true);
assert.equal(validate({ startingMana: 10, startingHand: 10, startingNexus: 100 }).passed, true);

for (const unsupported of ["spellsOnly", "unitsOnly", "doubleMana"]) {
  const report = validate({ startingMana: 5, [unsupported]: true });
  assert.equal(report.passed, false, `${unsupported} must not be publishable while the runtime does not enforce it`);
  assert.match(report.errors.join(" | "), /não suportada\(s\) pelo runtime/);
}

for (const rules of [
  { startingMana: -1 },
  { startingMana: 11 },
  { startingMana: 1.5 },
  { startingHand: -1 },
  { startingHand: 11 },
  { startingHand: 4.5 },
  { startingNexus: 0 },
  { startingNexus: 101 },
  { startingNexus: 20.5 },
]) {
  assert.equal(validate(rules).passed, false, `unsafe Brawl rules must fail closed: ${JSON.stringify(rules)}`);
}

const wrongId = validateControlDefinition({
  domain: "brawls",
  key: "brawl-authority-test",
  name: "Brawl Authority Test",
  payload: { id: "different-id", name: "Brawl Authority Test", rules: { startingMana: 5 } },
});
assert.equal(wrongId.passed, false, "Brawl payload id must be bound to its administrative key");

console.log("BRAWL RULE AUTHORITY: PASS");
