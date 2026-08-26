import fs from "node:fs";
import packageMetadata from "../package.json" with { type: "json" };

const failures = [];
const [major, minor] = process.versions.node.split(".").map(Number);
if (!Number.isFinite(major) || major < 22 || major >= 25) failures.push(`Node ${process.versions.node} is outside certified range >=22 <25`);
if (major === 22 && minor < 0) failures.push("Node 22 runtime is invalid");

if (!fs.existsSync("package-lock.json")) {
  console.error("FAIL package-lock.json is missing; run npm run lock:refresh on a registry-connected machine and commit it before production deploy");
  process.exit(1);
} else {
  try {
    const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
    if (Number(lock.lockfileVersion) !== 3) failures.push(`package-lock.json lockfileVersion must be 3 (found ${lock.lockfileVersion ?? "missing"})`);
    const root = lock.packages?.[""] || {};
    if (root.version && root.version !== packageMetadata.version) failures.push(`lock root version ${root.version} does not match package ${packageMetadata.version}`);
    for (const [name, version] of Object.entries(packageMetadata.dependencies || {})) {
      if (root.dependencies?.[name] !== version) failures.push(`lock root dependency ${name} does not match exact package pin ${version}`);
    }
  } catch (error) {
    failures.push(`package-lock.json is invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

for (const [name, version] of Object.entries(packageMetadata.dependencies || {})) {
  if (typeof version !== "string" || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) failures.push(`dependency ${name} must remain exact-pinned (found ${version})`);
}

try {
  const { default: sharp } = await import("sharp");
  if (!sharp.versions?.vips) failures.push("sharp/libvips runtime is unavailable");
  if (!sharp.format?.webp?.output?.buffer) failures.push("sharp WebP encoder is unavailable");
  if (!sharp.format?.heif?.output?.buffer || !sharp.format?.heif?.output?.alias?.includes("avif")) failures.push("sharp AVIF encoder is unavailable");
} catch (error) {
  failures.push(`sharp runtime cannot be loaded: ${error instanceof Error ? error.message : String(error)}`);
}

if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exit(1);
}
console.log(`RELEASE RUNTIME GATE: PASS — Node ${process.versions.node}, lockfile v3, ${Object.keys(packageMetadata.dependencies || {}).length} exact runtime pins`);
