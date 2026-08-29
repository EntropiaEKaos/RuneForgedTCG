import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const routeSource = fs.readFileSync(path.join(root, "src/app/api/admin/control/brawl-contract/route.ts"), "utf8");
const uiSource = fs.readFileSync(path.join(root, "src/app/admin/studio/brawl-contract/BrawlContractInspector.tsx"), "utf8");
const chromeSource = fs.readFileSync(path.join(root, "src/app/admin/studio/StudioChrome.tsx"), "utf8");

assert.match(routeSource, /validateControlDefinition/);
assert.match(routeSource, /BRAWL_RULE_CONTRACT/);
assert.match(routeSource, /BRAWL_UNSUPPORTED_LEGACY_RULES/);
assert.match(routeSource, /adminRoleAllowed\(actor\.role, "designer"\)/);
assert.match(uiSource, /\/api\/admin\/control\/brawl-contract/);
assert.match(uiSource, /AUTHORITATIVE PREFLIGHT/);
assert.match(uiSource, /Esta tela não publica nem altera conteúdo/);
assert.doesNotMatch(uiSource, /method:\s*["'](?:PUT|PATCH|DELETE)["']/);
assert.match(chromeSource, /\/admin\/studio\/brawl-contract/);

console.log("BRAWL CONTRACT ASSISTANT SOURCE CONTRACT: PASS");
