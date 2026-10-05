import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const client=fs.readFileSync(path.join(root,"src/app/commander/CommanderClient.tsx"),"utf8");

assert.match(client,/data-commander-reaction-window=/,"Commander must expose a contextual reaction presentation state");
assert.match(client,/Sua janela/,"Commander must tell the local viewer when reaction authority belongs to them");
assert.match(client,/Aguardando \$\{priorityHolderName\}/,"Commander must identify the remote priority holder compactly");
assert.match(client,/PRIORIDADE ABERTA/,"Commander must surface the authoritative reaction window");
assert.match(client,/Stack aberta — aguardando a janela autoritativa chegar até você/,"non-holder clients must not imply local reaction authority");
assert.match(client,/prioritySeconds<=7/,"Commander must mark the final priority seconds as urgent presentation");
assert.match(client,/Pilha de respostas/,"Commander reaction window must expose the response stack");
assert.match(client,/Resolve primeiro/,"Commander reaction stack must identify the LIFO top frame");
assert.match(client,/Passar reação/,"Commander must distinguish reaction pass copy from ordinary priority pass");\nassert.match(client,/item\.controllerSeat\+1/,"Commander reaction frames must identify P1/P2/P3/P4 ownership");
assert.match(client,/disabled={busy\|\|!viewerHasPriority}/,"presentation changes must preserve server-authoritative priority gating");

const priorityBlock=client.indexOf("const prioritySeconds=");
const stackItems=client.indexOf("const stackItems=");
const reactionWindow=client.indexOf("const reactionWindowOpen=");
assert.ok(priorityBlock>=0&&stackItems>priorityBlock&&reactionWindow>stackItems,"stack projection must be derived before reaction presentation reads it");

console.log("COMMANDER REACTION UX SOURCE CONTRACT: PASS");
