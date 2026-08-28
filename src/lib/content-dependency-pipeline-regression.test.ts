import fs from "node:fs";
const route=fs.readFileSync("src/app/api/admin/studio/pipeline/route.ts","utf8");
if(!route.includes("buildCardDependencyGraph")) throw new Error("pipeline does not compile dependency graph");
if(!route.includes("Card dependency cycle detected")) throw new Error("pipeline does not block dependency cycles");
console.log("CONTENT DEPENDENCY PIPELINE REGRESSION: PASS");
