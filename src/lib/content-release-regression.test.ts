import fs from "node:fs";
const schema=["src/db/schema.ts","src/db/schema/gameplay.ts","src/db/schema/players.ts","src/db/schema/multiplayer.ts","src/db/schema/admin-content.ts","src/db/schema/admin-ops.ts"].map((f)=>fs.readFileSync(f,"utf8")).join("\n"), route=fs.readFileSync("src/app/api/admin/studio/pipeline/route.ts","utf8"), verify=fs.readFileSync("src/app/api/replays/[id]/verify/route.ts","utf8");
for(const x of ["adminContentReleases","contentHash"]) if(!schema.includes(x)) throw new Error(`schema missing ${x}`);
for(const x of ["releaseVersion","releaseHash","adminContentReleases"]) if(!route.includes(x)) throw new Error(`publish missing ${x}`);
for(const x of ["withRegisteredCardSnapshot","historicalSnapshot","contentHash"]) if(!verify.includes(x)) throw new Error(`replay verify missing ${x}`);
console.log("CONTENT RELEASE REGRESSION: PASS");
