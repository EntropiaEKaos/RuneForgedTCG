import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const client=fs.readFileSync(path.join(root,"src/app/commander/CommanderClient.tsx"),"utf8");

assert.match(client,/data-commander-priority-state=/,"Commander must expose an explicit priority presentation state");
assert.match(client,/Sua prioridade/,"Commander must tell the local viewer when authority belongs to them");
assert.match(client,/Prioridade ·/,"Commander must identify the remote priority holder");
assert.match(client,/Janela de reação aberta/,"Commander must surface the authoritative reaction window");
assert.match(client,/Stack aberta — aguardando a janela autoritativa chegar até você/,"non-holder clients must not imply local reaction authority");
assert.match(client,/prioritySeconds<=7/,"Commander must mark the final priority seconds as urgent presentation");
assert.match(client,/data-commander-stack-focus=/,"Commander stack must expose focus state");
assert.match(client,/Stack 4P · sua resposta/,"Commander must focus the stack when the viewer owns priority");
assert.match(client,/Passar reação/,"Commander must distinguish reaction pass copy from ordinary priority pass");
assert.match(client,/disabled={busy\|\|!viewerHasPriority}/,"presentation changes must preserve server-authoritative priority gating");

const priorityBlock=client.indexOf("const prioritySeconds=");
const stackItems=client.indexOf("const stackItems=");
const reactionWindow=client.indexOf("const reactionWindowOpen=");
assert.ok(priorityBlock>=0&&stackItems>priorityBlock&&reactionWindow>stackItems,"stack projection must be derived before reaction presentation reads it");

console.log("COMMANDER REACTION UX SOURCE CONTRACT: PASS");
