import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

const client=read("src/app/commander/CommanderClient.tsx");
const battlefield=read("src/app/commander/CommanderBattlefield4P.tsx");

assert.match(client,/CommanderBattlefield4P/,"Commander client must mount the cinematic 4P battlefield");
assert.match(client,/combat=\{combat\}/,"cinematic battlefield must consume the authoritative projected combat state");
assert.match(battlefield,/data-commander-battlefield="cinematic-v1"/,"battlefield must expose a stable visual certification marker");
assert.match(battlefield,/relativePosition\(runtime\.seat,viewer\)/,"four-seat layout must orient relative to the local viewer");
assert.match(battlefield,/CardView defId=\{object\.defId\} size="sm"/,"battlefield objects must reuse the certified card renderer");
assert.match(battlefield,/CardView defId=\{runtime\.general\.defId\}/,"General zone must reuse the certified card renderer");
assert.match(battlefield,/runeforge-card-back\.svg/,"opponent hidden hands and deck piles must use the certified card back");
assert.match(battlefield,/combat\.combat\.attackers\.map/,"battlefield must render authoritative attack routes");
assert.match(battlefield,/markerEnd="url\(#commander-arrow\)"/,"attack routes must retain directional arrows");
assert.match(battlefield,/NEXUS DA STACK/,"battlefield must retain a central authoritative stack surface");
assert.match(battlefield,/combat\.stack/,"stack presentation must be derived from projected server state");
assert.match(battlefield,/runtime\.graveyard\.length/,"public graveyard counts must remain visible");
assert.match(battlefield,/runtime\.handCount/,"opponent hidden-hand presentation must use public counts only");
assert.match(battlefield,/function VisibleHand/,"local viewer must receive a real visible-hand presentation");
assert.match(battlefield,/runtime\.hand\?/,"visible hand must be driven only by the viewer-private projected hand");
assert.match(battlefield,/overflow-x-auto/,"four-seat arena must remain navigable on narrow viewports");
assert.match(battlefield,/selectedAttackerId/,"cinematic battlefield must support local attacker selection");
assert.match(battlefield,/selectedBlockerId/,"cinematic battlefield must support local blocker selection");
assert.match(battlefield,/onDeclareAttacker/,"cinematic battlefield must delegate attack commitment to its parent authority");
assert.match(battlefield,/onDeclareBlocker/,"cinematic battlefield must delegate block commitment to its parent authority");
assert.match(battlefield,/data-commander-nexus-target/,"opponent Nexus surfaces must become explicit attack targets");
assert.match(client,/onDeclareAttacker=\{\(unitId,defendingSeat\)=>combatCommand\("declare_attacker"/,"Commander client must keep authoritative attack command ownership");
assert.match(client,/onDeclareBlocker=\{\(unitId,attackerId\)=>combatCommand\("declare_blocker"/,"Commander client must keep authoritative block command ownership");


assert.doesNotMatch(battlefield,/fetch\(/,"cinematic battlefield must remain a pure projection layer with no network authority");
assert.doesNotMatch(battlefield,/combatCommand|mutate\(/,"cinematic battlefield must not create a second command authority");

console.log("COMMANDER 4P CINEMATIC BATTLEFIELD SOURCE CONTRACT: PASS — relative four-seat table, certified CardView surfaces, hidden-hand projection, stack core and attack routes");
