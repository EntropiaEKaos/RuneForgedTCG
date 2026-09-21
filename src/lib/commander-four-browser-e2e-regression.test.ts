import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

const script=read("scripts/commander-4p-browser-cert.ts");
const pkg=read("package.json");
const ci=read(".github/workflows/ci.yml");

assert.match(script,/\[0,1,2,3\]\.map/,"Commander browser cert must launch four clients");
assert.match(script,/independentBrowserProfiles:4/,"Commander browser evidence must record four independent profiles");
assert.match(script,/independentStablePlayerSessions:4/,"Commander browser evidence must record four distinct sessions");
assert.match(script,/opponentHandIdentityRedaction:true/,"Commander browser cert must prove hidden-hand isolation");
assert.match(script,/circularPriorityViaUi:true/,"Commander browser cert must prove circular priority through UI actions");
assert.match(script,/Passar prioridade/,"Commander browser cert must exercise the visible priority control");
assert.match(script,/62-commander-4p-lobby\.png/,"Commander browser cert must retain lobby evidence");
assert.match(script,/commander-4p-browser-manifest\.json/,"Commander browser cert must emit a machine-readable manifest");

assert.match(pkg,/"test:e2e:commander-4p": "tsx scripts\/commander-4p-browser-cert\.ts"/);
assert.match(ci,/npm run test:e2e:commander-4p/,"main CI browser gate must execute Commander four-browser certification");

console.log("COMMANDER FOUR-BROWSER E2E SOURCE CONTRACT: PASS");
