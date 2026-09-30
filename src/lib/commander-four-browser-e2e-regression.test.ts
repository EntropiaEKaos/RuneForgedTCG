import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

const script=read("scripts/commander-4p-browser-cert.ts");
const pkg=read("package.json");
const ci=read(".github/workflows/ci.yml");
const cardAuthoring=read("src/game/card-authoring.ts");

assert.match(script,/\[0,1,2,3\]\.map/,"Commander browser cert must launch four clients");
assert.match(script,/independentBrowserProfiles:4/,"Commander browser evidence must record four independent profiles");
assert.match(script,/independentStablePlayerSessions:4/,"Commander browser evidence must record four distinct sessions");
assert.match(script,/opponentHandIdentityRedaction:true/,"Commander browser cert must prove hidden-hand isolation");
assert.match(script,/serialized\.includes\(JSON\.stringify\(id\)\)/,"Commander hidden-hand cert must compare exact serialized identities instead of prefix substrings");
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
assert.match(script,/TOPO · /,"Commander counter-chain cert must target the visible top stack object");
assert.match(script,/counterOfCounterViaUi:true/,"Commander browser manifest must certify counter-of-counter through visible UI");
assert.match(script,/threeObjectLifoStackViaUi:true/,"Commander browser manifest must certify a three-object LIFO stack");
assert.match(script,/counteredCounterLeftSourcePending:true/,"Commander browser manifest must prove the original source survives its counter being countered");
assert.match(script,/originalSourceResolvedAfterCounterChain:true/,"Commander browser manifest must prove the surviving source later resolves");
assert.match(script,/counterOfCounterHolders,\[3,0,1,2\]/,"Commander counter-of-counter priority must rotate P4 → P1 → P2 → P3");
assert.match(script,/sourceResolutionHolders,\[0,1,2,3\]/,"Commander surviving-source priority must rotate P1 → P2 → P3 → P4");
assert.match(script,/targetDeckCount-loadout\.reaction\.source\.amount/,"Commander counter-chain cert must prove the exact catalog mill amount");
assert.match(script,/validateAuthorableCardWithSemanticTypes/,"Commander legality fixtures must pass the Studio authoring validator");
assert.match(script,/customKeywords:\["counter_spell"\]/,"Commander legality cert must include an authored Spell-only counter fixture");
assert.match(script,/customKeywords:\["uncounterable"\]/,"Commander legality cert must include an authored uncounterable Spell fixture");
assert.match(script,/waitForDisabledButton/,"Commander legality cert must prove illegal reactions are visibly disabled");
assert.match(script,/sendForgedCommanderCombatCommand/,"Commander legality cert must exercise the server boundary with forged combat commands");
assert.match(script,/serverRejectedForgedFilteredCounter:true/,"Commander manifest must certify server rejection of a forged filtered counter");
assert.match(script,/serverRejectedForgedUncounterableCounter:true/,"Commander manifest must certify server rejection of a forged counter against uncounterable");
assert.match(script,/uncounterableSourceResolvedAfterRejectedCounter:true/,"Commander manifest must prove the protected source still resolves");
assert.match(script,/uncounterableHolders,\[1,2,3,0\]/,"Commander protected source priority must rotate P2 → P3 → P4 → P1");


assert.match(script,/67-commander-4p-reaction-window-p2\.png/,"Commander browser cert must retain reaction-window evidence");
assert.match(script,/68-commander-4p-counter-stack\.png/,"Commander browser cert must retain counter-stack evidence");
assert.match(script,/69-commander-4p-counter-settled\.png/,"Commander browser cert must retain settled-counter evidence");
assert.match(script,/70-commander-4p-counter-chain-three-stack\.png/,"Commander browser cert must retain three-object stack evidence");
assert.match(script,/71-commander-4p-counter-chain-source-survives\.png/,"Commander browser cert must retain surviving-source evidence");
assert.match(script,/72-commander-4p-counter-chain-source-resolved\.png/,"Commander browser cert must retain final source-resolution evidence");
assert.match(script,/73-commander-4p-counter-filter-disabled\.png/,"Commander browser cert must retain filtered-counter UI evidence");
assert.match(script,/74-commander-4p-uncounterable-deny-disabled\.png/,"Commander browser cert must retain uncounterable denial UI evidence");
assert.match(script,/75-commander-4p-uncounterable-source-resolved\.png/,"Commander browser cert must retain protected source resolution evidence");


assert.match(script,/62-commander-4p-lobby\.png/,"Commander browser cert must retain lobby evidence");
assert.match(script,/commander-4p-browser-manifest\.json/,"Commander browser cert must emit a machine-readable manifest");

assert.match(pkg,/"test:e2e:commander-4p": "tsx scripts\/commander-4p-browser-cert\.ts"/);
assert.match(cardAuthoring,/RESERVED_REACTION_RULE_KEYS/,"Studio authoring must separate reserved reaction rules from Mechanics custom keywords");
assert.match(cardAuthoring,/COUNTER_FILTER_RULE_KEYS/,"Studio authoring must validate counter filters as reserved engine rules");
assert.match(cardAuthoring,/counter_\* reaction rules are valid only on negateSpell Spell cards/,"Studio authoring must fail closed when counter filters are placed on non-counter cards");

assert.match(ci,/npm run test:e2e:commander-4p/,"main CI browser gate must execute Commander four-browser certification");

console.log("COMMANDER FOUR-BROWSER E2E SOURCE CONTRACT: PASS");
