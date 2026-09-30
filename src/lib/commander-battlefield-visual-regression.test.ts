import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

const client=read("src/app/commander/CommanderClient.tsx");
const battlefield=read("src/app/commander/CommanderBattlefield4P.tsx");
const phaserRuntime=read("src/app/commander/CommanderPhaserRuntime.tsx");
const packageJson=read("package.json");
const packageLock=read("package-lock.json");

assert.match(client,/CommanderBattlefield4P/,"Commander client must mount the cinematic 4P battlefield");
assert.match(client,/combat=\{combat\}/,"cinematic battlefield must consume the authoritative projected combat state");
assert.match(battlefield,/data-commander-battlefield="cinematic-v1"/,"battlefield must expose a stable visual certification marker");
assert.match(battlefield,/relativePosition\(runtime\.seat,viewer\)/,"four-seat layout must orient relative to the local viewer");
assert.match(battlefield,/CardView defId=\{object\.defId\} size="sm"/,"battlefield objects must reuse the certified card renderer");
assert.match(battlefield,/CardView defId=\{runtime\.general\.defId\}/,"General zone must reuse the certified card renderer");
assert.match(battlefield,/runeforge-card-back\.svg/,"opponent hidden hands and deck piles must use the certified card back");
assert.match(battlefield,/combat\.combat\.attackers\.map/,"battlefield must render authoritative attack routes");
assert.match(battlefield,/markerEnd="url\(#commander-arrow\)"/,"attack routes must retain directional arrows");
assert.match(battlefield,/data-commander-attack-fx="authoritative"/,"attack FX must be visibly marked as authoritative-state driven");
assert.match(battlefield,/type CombatMotion="attacking"\|"blocking"\|null/,"battlefield must model visual combat motion without changing gameplay state");
assert.match(battlefield,/combatMotionTransform/,"declared combatants must move toward the center using a presentation-only transform");
assert.match(battlefield,/data-commander-combat-motion/,"moving combatants must expose a stable visual motion marker");
assert.match(battlefield,/declaredAttackerIds=\{assignedAttackerIds\}/,"physical attacker movement must derive from authoritative declared attackers");
assert.match(battlefield,/declaredBlockerIds=\{assignedBlockerIds\}/,"physical blocker movement must derive from authoritative declared blockers");
assert.match(battlefield,/blockerByAttacker/,"attack FX must correlate blockers with authoritative attacker ids");
assert.match(battlefield,/data-commander-attack-blocked/,"blocked attacks must expose a distinct impact state");
assert.match(battlefield,/data-commander-block-route/,"blocker interception must retain a visible route to the collision point");
assert.match(battlefield,/deriveAuthoritativeResolutionFx/,"resolution FX must be derived from consecutive authoritative projections");
assert.match(battlefield,/combat\.revision<=previous\.revision/,"resolution FX must ignore stale or duplicate revisions");
assert.match(battlefield,/seatLife\(before\)-seatLife\(seat\)/,"Nexus damage FX must come from observed authoritative life deltas");
assert.match(battlefield,/afterHealth<beforeHealth/,"battlefield damage FX must come from observed authoritative health deltas");
assert.match(battlefield,/barrier===true&&after\.object\.combat\?\.barrier===false/,"Barrier break FX must require an authoritative true-to-false transition");
assert.match(battlefield,/graveyard\.some\(card=>card\.instanceId===id\)/,"graveyard departure FX must require exact physical instance identity");
assert.match(battlefield,/owner\.general\.zone!=="battlefield"/,"General departure FX must require the projected General to leave the battlefield");
assert.match(battlefield,/previousCombatRef=useRef<CombatState\|null>/,"resolution FX must compare projected revisions locally without gameplay mutation");
assert.match(battlefield,/data-commander-nexus-damage/,"Nexus damage must expose a stable visual evidence marker");
assert.match(battlefield,/data-commander-damage-fx/,"battlefield damage must expose a stable visual evidence marker");
assert.match(battlefield,/data-commander-barrier-break="true"/,"Barrier break must expose a stable visual evidence marker");
assert.match(battlefield,/data-commander-departure-fx="authoritative"/,"destroyed/departed card FX must be marked as authoritative-state driven");
assert.match(battlefield,/data-commander-camera-controls="local"/,"battlefield must expose local-only camera controls");
assert.match(battlefield,/data-commander-camera-zoom=\{cameraZoom\}/,"camera zoom must remain local presentation state");
assert.match(battlefield,/focusCamera\(target:"table"\|"stack"\|"self"\)/,"camera focus must be constrained to table, stack or local seat");
assert.match(battlefield,/scrollIntoView\(\{behavior:"smooth",block:"nearest",inline:"center"\}\)/,"camera focus must be DOM framing only");
assert.match(battlefield,/\(\[80,90,100\] as const\)/,"camera must retain bounded zoom presets");
assert.match(battlefield,/data-commander-camera-surface="table"/,"camera surface must expose a stable certification marker");

assert.doesNotMatch(battlefield,/effectivePower|applyFourPlayerBattlefieldDamage|advanceFourPlayerCombatStep/,"presentation must not recalculate authoritative combat resolution");


assert.match(battlefield,/stroke-dashoffset/,"attack routes must retain animated directional flow");
assert.match(battlefield,/attributeName="cx"/,"attack FX must retain a projectile moving from controller to defender");
assert.match(battlefield,/attributeName="r"/,"defending seat must retain an impact pulse driven by an authoritative attacker");

assert.match(battlefield,/NEXUS DA STACK/,"battlefield must retain a central authoritative stack surface");
assert.match(battlefield,/combat\.stack/,"stack presentation must be derived from projected server state");
assert.match(battlefield,/data-commander-stack-cards="physical"/,"stack must retain a physical layered-card presentation");
assert.match(battlefield,/data-commander-stack-top/,"stack must expose its visual top object");
assert.match(battlefield,/CardView defId=\{item\.defId\} size="sm"/,"stack card objects must reuse the certified CardView renderer");
assert.match(battlefield,/NÃO ANULÁVEL/,"stack physical presentation must preserve uncounterable state");

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


assert.match(battlefield,/CommanderPhaserRuntime/,"Commander battlefield must mount the isolated Phaser presentation overlay");
assert.match(phaserRuntime,/void import\("phaser"\)/,"Phaser must load client-side behind the React boundary");
assert.match(phaserRuntime,/new Phaser\.Game/,"presentation overlay must instantiate a real Phaser.Game runtime");
assert.match(phaserRuntime,/projectAuthoritativeCombatDelta/,"Phaser runtime must consume the certified authoritative combat adapter");
assert.match(phaserRuntime,/viewerSeat:number/,"Phaser runtime must receive the local Commander viewer seat");
assert.match(phaserRuntime,/seatPoint\(route\.controllerSeat,viewerSeat\)/,"attacker FX must originate from its authoritative controller seat in local perspective");
assert.match(phaserRuntime,/seatPoint\(route\.defendingSeat,viewerSeat\)/,"attacker FX must target its authoritative defending seat in local perspective");
assert.match(phaserRuntime,/frame\.attackRoutes\.find\(entry=>entry\.unitId===route\.attackerId\)/,"blocker FX must bind to the exact authoritative attacker id");
assert.match(phaserRuntime,/collisionPoint\(attackerStart,defender\)/,"blocker FX must terminate at the authoritative attacker route collision point");
assert.match(battlefield,/viewerSeat=\{viewer\}/,"Commander battlefield must provide the viewer seat to the presentation-only Phaser overlay");

assert.match(phaserRuntime,/data-commander-phaser-runtime="presentation-only"/,"Phaser overlay must expose its presentation-only certification marker");
assert.match(phaserRuntime,/pointer-events-none/,"Phaser overlay must not intercept gameplay input");
assert.match(packageJson,/"phaser": "4\.2\.1"/,"runtime must pin certified Phaser 4.2.1");
assert.match(packageLock,/"node_modules\/phaser"/,"runtime dependency must remain locked");
assert.doesNotMatch(phaserRuntime,/fetch\(|combatCommand|onDeclareAttacker|onDeclareBlocker/,"Phaser runtime must not own network or gameplay commands");
assert.match(phaserRuntime,/React battlefield remains active/,"Phaser runtime failure must preserve the React battlefield fallback");
assert.doesNotMatch(battlefield,/fetch\(/,"cinematic battlefield must remain a pure projection layer with no network authority");
assert.doesNotMatch(battlefield,/combatCommand|mutate\(/,"cinematic battlefield must not create a second command authority");

console.log("COMMANDER 4P CINEMATIC BATTLEFIELD SOURCE CONTRACT: PASS — relative four-seat table, certified CardView surfaces, hidden-hand projection, stack core and attack routes");
