import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");

const engine = read("src/game/engine.ts") + read("src/game/engine/actions.ts") + read("src/game/engine/effects.ts");
const pvp = read("src/app/api/pvp/[code]/route.ts");
const pipeline = read("src/app/api/admin/studio/pipeline/route.ts");
const studioPatch = read("src/app/api/admin/studio/[resource]/[id]/route.ts");
const studioImport = read("src/app/api/admin/studio/import/route.ts");
const bulk = read("src/app/api/admin/studio/bulk/route.ts");
const cards = read("src/app/api/admin/cards/[id]/route.ts");
const token = read("src/app/api/matches/token/route.ts");
const modesAttempt = read("src/app/api/modes/attempt/route.ts");

assert.match(engine, /const validatedBlocks: Record<string, string> = \{\};/, "combat must validate block assignments before triggers");
assert.match(engine, /attackerIds\.has\(atkId\)/, "onBlock cannot be triggered by a fabricated attacker id");
assert.match(pvp, /hostDeckSnapshot \? snapshotDeck/, "PvP join must use the immutable host deck snapshot");
assert.match(pvp, /activeElsewhere/, "a player cannot join a second active PvP room");
assert.match(pipeline, /Content changed during publish/, "publish must reject stale concurrent edits");
assert.match(pipeline, /matchTokens/, "card archive must consider active PvE attempts");
assert.match(pipeline, /pvpRooms/, "card archive must consider active PvP rooms");
assert.match(studioPatch, /Content state changes must go through/, "generic studio PATCH cannot publish/archive directly");
assert.match(studioImport, /Imported content is always staged as draft\/inactive/, "imports cannot publish content directly");
assert.match(bulk, /Bulk publish\/archive is disabled/, "bulk tools cannot bypass the pipeline");
assert.match(cards, /cannot be hard-deleted/, "historically referenced cards must remain archived");
assert.match(token, /eq\(matchTokens\.deckId, playerSnapshot\.id\)/, "match tokens must not reuse a token for a different deck");
assert.match(modesAttempt, /eq\(modeAttempts\.playerDeckId, playerDeck\.id\)/, "mode attempts must not reuse a token for a different deck");

console.log("deep audit regression checks: OK");
