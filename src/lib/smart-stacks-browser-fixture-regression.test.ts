import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.join(process.cwd(), "scripts", "alpha-smart-stacks-browser-cert.mjs"), "utf8");

assert.match(source, /data-hybrid-stacks="player"/);
assert.match(source, /data-stack-kind="unit"/);
assert.match(source, /dataStackCount|stackCount|dataset\.stackCount/);
assert.match(source, /Expandir pilha/);
assert.match(source, /Recolher pilha/);
assert.match(source, /let smartStackDefId = "tide_tidebarrier"/);
assert.match(source, /smartStackDefId = pair/);
assert.match(source, /if \(pair && playerFirst\)/);
assert.match(source, /assignDefensiveBlocks\(cdp, smartStackDefId\)/);
assert.match(source, /developmentOrder = \[smartStackDefId/);
assert.match(source, /new Set\(expandedStack\.ids\)\.size/);
assert.match(source, /smart-stack-01-compact\.png/);
assert.match(source, /smart-stack-02-expanded\.png/);
assert.match(source, /smart-stack-03-regrouped\.png/);

console.log("SMART STACK BROWSER FIXTURE SOURCE CONTRACT: PASS — compact, expand, instance identity and regroup evidence are mandatory");
