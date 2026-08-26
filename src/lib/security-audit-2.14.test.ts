import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
function read(rel: string) { return fs.readFileSync(path.join(root, rel), "utf8"); }
function assertIncludes(rel: string, needle: string) {
  const source = read(rel);
  if (!source.includes(needle)) throw new Error(`${rel} missing: ${needle}`);
}

assertIncludes("src/app/api/admin/stats/route.ts", 'adminRoleAllowed(actor.role, "qa")');
assertIncludes("src/app/api/admin/studio/analytics/route.ts", 'adminRoleAllowed(actor.role,"qa")');
assertIncludes("src/app/api/admin/studio/rule-cards/route.ts", 'adminRoleAllowed(actor.role, ["designer", "qa"])');
assertIncludes("src/app/api/admin/studio/qa/route.ts", 'adminRoleAllowed(actor.role,"qa")');
assertIncludes("src/app/api/admin/studio/card-tests/route.ts", 'adminRoleAllowed(actor.role,"designer")');
assertIncludes("src/app/api/admin/studio/versions/route.ts", 'adminRoleAllowed(actor.role,"designer")');

const genericPatch = read("src/app/api/admin/studio/[resource]/[id]/route.ts");
if (!genericPatch.includes("const allowedByResource")) throw new Error("Generic Studio PATCH must use an explicit per-resource allowlist");
if (!genericPatch.includes('if (!allowed) return Response.json({ ok: false, error: "Unsupported resource"')) throw new Error("Unknown resource must be rejected before mutation");
if (!genericPatch.includes('delete clean.enabled')) throw new Error("Generic PATCH must not activate content");

console.log("SECURITY AUDIT 2.14: PASS");
