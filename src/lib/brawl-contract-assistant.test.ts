import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
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

const root = process.cwd();
const routeSource = fs.readFileSync(path.join(root, "src/app/api/admin/control/brawl-contract/route.ts"), "utf8");
const uiSource = fs.readFileSync(path.join(root, "src/app/admin/studio/brawl-contract/BrawlContractInspector.tsx"), "utf8");
assert.match(routeSource, /validateControlDefinition/);
assert.match(routeSource, /BRAWL_RULE_CONTRACT/);
assert.match(routeSource, /BRAWL_UNSUPPORTED_LEGACY_RULES/);
assert.match(uiSource, /\/api\/admin\/control\/brawl-contract/);
assert.match(uiSource, /AUTHORITATIVE PREFLIGHT/);
assert.doesNotMatch(uiSource, /method:\s*["'](?:PUT|PATCH|DELETE)["']/);

console.log(`BRAWL CONTRACT ASSISTANT: PASS (${BRAWL_RULE_CONTRACT.length} supported rules, ${BRAWL_UNSUPPORTED_LEGACY_RULES.length} rejected legacy rules)`);
