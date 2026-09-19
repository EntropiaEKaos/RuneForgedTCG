import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

const route=read("src/app/api/commander/[code]/route.ts");
const bridge=read("src/lib/commander-combat.ts");
const client=read("src/app/commander/CommanderClient.tsx");
const commanderSchema=read("src/db/schema/commander.ts");
const coreTypes=read("src/game/types.ts");

assert.match(route,/createCommanderCombatEnvelope/,"room start must create the recovered combat envelope");
assert.match(route,/commanderCombatPersistence/,"combat state must persist through the Commander bridge");
assert.match(route,/projectCommanderCombatState/,"GET must expose a per-seat projection instead of private engine state");
assert.match(route,/action==="combat-command"/,"Commander endpoint must expose versioned combat commands");
assert.match(route,/for\("update"\)/,"Commander room transitions must retain PostgreSQL row locks");
assert.match(route,/expectedRevision!==room\.version/,"room version must fail closed on stale commands");
assert.match(route,/isCommanderCombatEnvelope\(room\.gameState\)/,"combat commands must reject incompatible persisted state");

assert.match(bridge,/processAuthoritativeFourPlayerCommand/,"bridge must use recovered #209 authority pipeline");
assert.match(bridge,/projectFourPlayerStateForSeat/,"bridge must preserve hidden-information projection");
assert.match(bridge,/EXPOSED_COMMANDS/,"only an explicit command allowlist may cross the public bridge");
assert.match(bridge,/pass_priority/);
assert.match(bridge,/cast_general/);
assert.match(bridge,/play_card/);
assert.match(bridge,/declare_attacker/);
assert.match(bridge,/declare_blocker/);
assert.match(bridge,/destroyedObjects/,"combat casualties must settle into authoritative zones");
assert.match(bridge,/stageFourPlayerCardCast/,"play_card must derive authoritative card identity from zones");
assert.match(bridge,/acceptAuthoritativeFourPlayerCommand/,"play_card must still consume the canonical revision/idempotency protocol");
assert.match(bridge,/end_turn/);
assert.match(bridge,/concede/);

assert.match(client,/action:"combat-command"/,"Commander UI must use the versioned combat bridge");
assert.match(client,/expectedRevision:room\.combat\.revision/,"Commander UI must send authoritative expectedRevision");
assert.match(client,/crypto\.randomUUID\(\)/,"Commander UI commands need unique command ids");
assert.match(client,/combatCommand\("pass_priority"\)/);
assert.match(client,/combatCommand\("cast_general"\)/);
assert.match(client,/combatCommand\("play_card"/);
assert.match(client,/combatCommand\("declare_attacker"/);
assert.match(client,/combatCommand\("declare_blocker"/);
assert.match(client,/Atacar P/);
assert.match(client,/Bloquear/);
assert.match(client,/Jogar/);
assert.match(client,/combatCommand\("end_turn"\)/);
assert.match(client,/combatCommand\("concede"\)/);
assert.match(client,/Passar prioridade/);
assert.match(client,/Conjurar General/);
assert.match(client,/Encerrar turno/);
assert.match(client,/Conceder partida/);

assert.match(commanderSchema,/commander_rooms/);
assert.match(commanderSchema,/gameState: jsonb\("game_state"\)/);
assert.match(coreTypes,/export type PlayerId = "player" \| "ai"/,"1v1 PlayerId must remain binary and untouched");

console.log("COMMANDER 4P COMBAT POSTGRES BRIDGE SOURCE CONTRACT: PASS");
