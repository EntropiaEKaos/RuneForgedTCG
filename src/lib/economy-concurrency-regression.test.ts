import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const collection = fs.readFileSync(path.join(root, "src/app/api/collection/route.ts"), "utf8");
const packs = fs.readFileSync(path.join(root, "src/app/api/packs/route.ts"), "utf8");
const daily = fs.readFileSync(path.join(root, "src/app/api/dailies/claim/route.ts"), "utf8");
const login = fs.readFileSync(path.join(root, "src/app/api/login-reward/route.ts"), "utf8");
const playerUpdate = fs.readFileSync(path.join(root, "src/app/api/player/update/route.ts"), "utf8");
const draft = fs.readFileSync(path.join(root, "src/app/api/draft/route.ts"), "utf8");
const schema = ["schema.ts","schema/gameplay.ts","schema/players.ts","schema/multiplayer.ts","schema/admin-content.ts","schema/admin-ops.ts"].map((f) => fs.readFileSync(path.join(root, "src/db", f), "utf8")).join("\n");
const friends = fs.readFileSync(path.join(root, "src/app/api/friends/route.ts"), "utf8");

if (!collection.includes("currentCount + amount > duplicateCap")) throw new Error("Craft must enforce the configured collection cap atomically.");
if (!packs.includes("FOR UPDATE")) throw new Error("Pack purchases/openings must lock the player row.");
if (!daily.includes("FOR UPDATE")) throw new Error("Daily reward claims must lock the player row.");
if (!login.includes("FOR UPDATE")) throw new Error("Login rewards must lock the player row.");
if (!playerUpdate.includes("FOR UPDATE")) throw new Error("Match reward settlement must lock the player row.");
if (!schema.includes('unique().on(t.playerId, t.questId)')) throw new Error("Daily quests require a player/quest uniqueness constraint.");
if (!draft.includes("draftSessions")) throw new Error("Draft state must be persisted, not kept only in process memory.");
if (!friends.includes(".for(\"update\")")) throw new Error("Friend requests must serialize competing relationship creation.");
console.log("economy concurrency regression: OK");
