import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

const client=read("src/app/commander/CommanderClient.tsx");
const resync=read("src/lib/commander-client-resync.ts");

assert.match(client,/commanderMutationNeedsResync/);
assert.match(client,/commanderSnapshotMayReplace/,"late polling snapshots must not overwrite newer Commander revisions");
assert.match(client,/window\.addEventListener\("online"/,"network reconnect must refresh Commander authority");
assert.match(client,/window\.addEventListener\("focus"/,"window focus must refresh Commander authority");
assert.match(client,/document\.addEventListener\("visibilitychange"/,"tab resume must refresh Commander authority");
assert.match(client,/clearPendingCombatIntent/,"resync must clear stale spell\/ability intent");
assert.match(client,/loadRoom\(room\.code\)/,"mutation conflicts must fetch a fresh authoritative snapshot");
assert.match(client,/Estado Commander atualizado após conflito de revisão/,"stale commands must not be silently replayed");

assert.match(resync,/status === 409/,"only conflict responses trigger mutation resync");
assert.match(resync,/incomingRevision as number\) >= \(currentRevision as number/,"snapshot replacement must be revision-monotonic");

console.log("COMMANDER CLIENT RESYNC SOURCE CONTRACT: PASS");
