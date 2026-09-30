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
assert.match(script,/waitForCommanderUiAuthority/,"Commander browser cert must wait atomically for revision plus visible priority authority");
assert.match(script,/data-commander-priority-state/,"Commander browser cert must bind its authority wait to the rendered priority state");
assert.match(script,/window\.dispatchEvent\(new Event\('focus'\)\)/,"Commander browser cert must exercise the production focus-resync path after deterministic fixture mutation");
assert.match(script,/tide_erosion/,"Commander browser cert must stage a real counterable Tidecall source spell");
assert.match(script,/tide_deny/,"Commander browser cert must stage a real Burst negateSpell response");
assert.match(script,/Janela de reação aberta/,"Commander browser cert must observe the visible authoritative reaction window");
assert.match(script,/Passar reação/,"Commander browser cert must drive the visible reaction-priority control");
assert.match(script,/burstNegateSpellViaUi:true/,"Commander browser manifest must certify the Burst counter through UI");
assert.match(script,/counterPreventedSourceResolution:true/,"Commander browser manifest must prove the counter prevented source resolution");
assert.match(script,/67-commander-4p-reaction-window-p2\.png/,"Commander browser cert must retain reaction-window evidence");
assert.match(script,/68-commander-4p-counter-stack\.png/,"Commander browser cert must retain counter-stack evidence");
assert.match(script,/69-commander-4p-counter-settled\.png/,"Commander browser cert must retain settled-counter evidence");
assert.match(script,/62-commander-4p-lobby\.png/,"Commander browser cert must retain lobby evidence");
assert.match(script,/commander-4p-browser-manifest\.json/,"Commander browser cert must emit a machine-readable manifest");

assert.match(pkg,/"test:e2e:commander-4p": "tsx scripts\/commander-4p-browser-cert\.ts"/);
assert.match(ci,/npm run test:e2e:commander-4p/,"main CI browser gate must execute Commander four-browser certification");

console.log("COMMANDER FOUR-BROWSER E2E SOURCE CONTRACT: PASS");
