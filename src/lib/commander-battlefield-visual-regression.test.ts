import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

const client=read("src/app/commander/CommanderClient.tsx");
const battlefield=read("src/app/commander/CommanderBattlefield4P.tsx");
const phaserRuntime=read("src/app/commander/CommanderPhaserRuntime.tsx");
const phaserCombatFx=read("src/game/presentation/phaser/BattlefieldCombatFx.ts");
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
assert.match(battlefield,/activeSeat:combat\.activeSeat/,"Commander battlefield must project the authoritative active seat into Phaser");
assert.match(battlefield,/prioritySeat:combat\.prioritySeat/,"Commander battlefield must project the authoritative priority seat into Phaser");
assert.match(battlefield,/phase:combat\.phase/,"Commander battlefield must project the authoritative phase into Phaser");
assert.match(battlefield,/turn:combat\.turn/,"Commander battlefield must project the authoritative turn into Phaser");
assert.match(phaserRuntime,/PRIORITY_EVENT="runeforged:commander:priority-fx"/,"Phaser priority FX must use an isolated presentation event");
assert.match(phaserRuntime,/previous\.prioritySeat!==current\.prioritySeat/,"priority FX must derive only from observed authoritative priority-seat changes");
assert.match(phaserRuntime,/previous\.turn!==current\.turn\|\|previous\.activeSeat!==current\.activeSeat/,"turn FX must derive only from observed authoritative turn changes");
assert.match(phaserRuntime,/playPriorityTransferFx\(this,seatPoint\(fx\.fromPrioritySeat,viewerSeat\),target\)/,"priority transfer must animate between authoritative seats");
assert.match(phaserRuntime,/playTurnAnchorFx\(this,seatPoint\(fx\.activeSeat,viewerSeat\),fx\.turn,fx\.phase\)/,"turn anchor must target the authoritative active seat");
assert.match(phaserCombatFx,/export function playPriorityTransferFx/,"shared Phaser FX must expose priority transfer presentation");
assert.match(phaserCombatFx,/export function playTurnAnchorFx/,"shared Phaser FX must expose turn-anchor presentation");
assert.doesNotMatch(phaserRuntime,/setTimeout\(|setInterval\(|combatCommand|passPriority|endTurn/,"Phaser priority presentation must not own timers or gameplay commands");

assert.match(battlefield,/stack=\{combat\.stack\}/,"Commander battlefield must project the authoritative stack into Phaser");
assert.match(phaserRuntime,/STACK_EVENT="runeforged:commander:stack-fx"/,"Phaser stack FX must use an isolated presentation event");
assert.match(phaserRuntime,/lastStackRevisionRef/,"stack FX must deduplicate authoritative revisions");
assert.match(phaserRuntime,/entered=stack\.filter\(item=>!previousIds\.has\(item\.id\)\)/,"stack entry FX must derive only from authoritative item-id additions");
assert.match(phaserRuntime,/departed=previous\.filter\(item=>!currentIds\.has\(item\.id\)\)/,"stack departure FX must derive only from authoritative item-id removals");
assert.match(phaserRuntime,/playStackEntryFx\(this,source,target,item\.speed,item\.uncounterable\)/,"stack entry FX must preserve projected speed and uncounterable state");
assert.match(phaserRuntime,/playStackDepartureFx\(this,/,"stack departure must use a neutral presentation primitive");
assert.match(phaserCombatFx,/export function playStackEntryFx/,"shared Phaser FX must expose stack-entry presentation");
assert.match(phaserCombatFx,/export function playStackDepartureFx/,"shared Phaser FX must expose neutral stack-departure presentation");
assert.doesNotMatch(phaserRuntime,/COUNTERED|ANULADO|RESOLVED|RESOLVIDO/,"Phaser stack departure must not infer why an item left the authoritative stack");

assert.match(battlefield,/objectSeats:Record<string,number>/,"authoritative resolution FX must retain the seat of damaged or barrier-broken objects");
assert.match(battlefield,/resolutionFx=\{resolutionFx\}/,"Commander battlefield must pass only its observed authoritative resolution delta to Phaser");
assert.match(phaserRuntime,/RESOLUTION_EVENT="runeforged:commander:resolution-fx"/,"Phaser runtime must isolate authoritative resolution events from combat command frames");
assert.match(phaserRuntime,/lastResolutionRevisionRef/,"Phaser resolution FX must deduplicate already-rendered revisions");
assert.match(phaserRuntime,/playDamageImpactFx\(this,seatPoint\(Number\(seat\),viewerSeat\),damage,"nexus"\)/,"Nexus damage FX must target the authoritative damaged seat");
assert.match(phaserRuntime,/playDamageImpactFx\(this,seatFxPoint\(seat,viewerSeat,index\),damage,"object"\)/,"object damage FX must use the authoritative object's seat");
assert.match(phaserRuntime,/playBarrierBreakFx\(this,seatFxPoint\(seat,viewerSeat,index\)\)/,"Barrier FX must use the authoritative object's seat");
assert.match(phaserRuntime,/playDepartureFx\(this,seatFxPoint\(departure\.seat,viewerSeat,index\),departure\.destination\)/,"departure FX must use the authoritative projected destination");
assert.match(phaserCombatFx,/export function playDamageImpactFx/,"shared Phaser FX must expose a damage impact primitive");
assert.match(phaserCombatFx,/export function playBarrierBreakFx/,"shared Phaser FX must expose a Barrier break primitive");
assert.match(phaserCombatFx,/export function playDepartureFx/,"shared Phaser FX must expose a departure primitive");
assert.doesNotMatch(phaserRuntime,/seatLife\(|battlefieldMap\(|deriveAuthoritativeResolutionFx|effectivePower|applyFourPlayerBattlefieldDamage|advanceFourPlayerCombatStep/,"Phaser runtime must render authoritative outcomes without recalculating combat");

assert.match(phaserRuntime,/playCombatLaneFx\(this,start,impact,"attackers"\)/,"attacker lanes must use the certified Phaser combat FX helper");
assert.match(phaserRuntime,/playCombatLaneFx\(this,start,impact,"blockers"\)/,"blocker lanes must use the certified Phaser combat FX helper");
assert.doesNotMatch(phaserRuntime,/const trail=this\.add\.line/,"Commander Phaser runtime must not duplicate combat lane rendering outside the shared helper");

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
