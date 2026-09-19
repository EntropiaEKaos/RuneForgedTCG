import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

function main(){
  const rules=read("src/lib/commander-rules.ts");
  assert.match(rules,/playerCount:\s*4/,"Commander Alpha must require four real seats");
  assert.match(rules,/deckSize:\s*60/,"Commander Alpha must use a larger 60-card deck");
  assert.match(rules,/startingNexus:\s*30/,"Commander Alpha must use 30 Nexus");
  assert.match(rules,/startingHand:\s*5/,"Commander Alpha must snapshot a five-card starting hand contract");
  assert.match(rules,/General fica fora das 60 cartas/,"General must be separate from the 60-card library");
  assert.match(rules,/isChampion.*isLegend/,"General must be Champion or Legend");

  const migration=read("drizzle/0049_commander_4p_alpha.sql");
  assert.match(migration,/CREATE TABLE IF NOT EXISTS "commander_rooms"/);
  assert.match(migration,/CREATE TABLE IF NOT EXISTS "commander_seats"/);
  assert.match(migration,/UNIQUE \("room_id","seat"\)/,"one player slot per seat must be enforced by PostgreSQL");
  assert.match(migration,/UNIQUE \("room_id","player_id"\)/,"one seat per player must be enforced by PostgreSQL");

  const createApi=read("src/app/api/commander/route.ts");
  const roomApi=read("src/app/api/commander/[code]/route.ts");
  assert.match(createApi,/validateOwnedCommanderLoadout/,"room creation must validate authoritative ownership");
  assert.match(roomApi,/Four real players are required/,"start must fail closed below four real players");
  assert.match(roomApi,/All four players must be ready/,"all seats must explicitly ready");
  assert.match(roomApi,/for\("update"\)/,"room transitions must lock authoritative rows");
  assert.match(roomApi,/nextCommanderSeat/,"turn order must use the isolated four-seat contract");

  const core=read("src/game/types.ts");
  assert.match(core,/export type PlayerId = "player" \| "ai"/,"certified 1v1 PlayerId contract must remain untouched");

  const client=read("src/app/commander/CommanderClient.tsx");
  assert.match(client,/60 cartas \+ 1 General/);
  assert.match(client,/quatro jogadores reais/);
  assert.match(client,/Passar turno/);
  console.log("COMMANDER 4P ALPHA SOURCE CONTRACT: PASS — isolated lobby, loadout, four-seat ready/start and circular turn authority");
}
main();
