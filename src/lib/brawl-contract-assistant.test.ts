import assert from "node:assert/strict";
import { BRAWL_RULE_CONTRACT, BRAWL_UNSUPPORTED_LEGACY_RULES } from "./brawl-control-contract";
import { validateControlDefinition } from "./control-plane";

function validate(rules: Record<string, unknown>) {
  return validateControlDefinition({
    domain: "brawls",
    key: "contract-inspector-test",
    name: "Contract Inspector Test",
    description: "Brawl contract parity fixture",
    payload: {
      id: "contract-inspector-test",
      name: "Contract Inspector Test",
      description: "Brawl contract parity fixture",
      emoji: "⚡",
      rules,
    },
  });
}

assert.deepEqual(BRAWL_RULE_CONTRACT.map((field) => field.key), ["startingMana", "startingHand", "startingNexus"]);

for (const field of BRAWL_RULE_CONTRACT) {
  assert.equal(validate({ [field.key]: field.min }).passed, true, `${field.key} minimum must match backend validation`);
  assert.equal(validate({ [field.key]: field.max }).passed, true, `${field.key} maximum must match backend validation`);
  assert.equal(validate({ [field.key]: field.min - 1 }).passed, false, `${field.key} below minimum must fail closed`);
  assert.equal(validate({ [field.key]: field.max + 1 }).passed, false, `${field.key} above maximum must fail closed`);
  assert.equal(validate({ [field.key]: field.min + 0.5 }).passed, false, `${field.key} fractional value must fail closed`);
}

for (const legacyRule of BRAWL_UNSUPPORTED_LEGACY_RULES) {
  const report = validate({ startingMana: 5, [legacyRule]: true });
  assert.equal(report.passed, false, `${legacyRule} must remain rejected by the canonical validator`);
  assert.match(report.errors.join(" | "), /não suportada\(s\) pelo runtime/);
}

console.log(`BRAWL CONTRACT ASSISTANT: PASS (${BRAWL_RULE_CONTRACT.length} supported rules, ${BRAWL_UNSUPPORTED_LEGACY_RULES.length} rejected legacy rules)`);
