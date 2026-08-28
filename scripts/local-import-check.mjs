import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const roots = [path.join(root, "src"), path.join(root, "scripts")];
const files = [];
const extensions = ["", ".ts", ".tsx", ".js", ".mjs", ".cjs"];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(?:ts|tsx|js|mjs|cjs)$/.test(entry.name)) files.push(full);
  }
}
for (const directory of roots) if (fs.existsSync(directory)) walk(directory);

function resolves(base) {
  for (const extension of extensions) if (fs.existsSync(`${base}${extension}`) && fs.statSync(`${base}${extension}`).isFile()) return true;
  for (const name of ["index.ts", "index.tsx", "index.js", "index.mjs", "index.cjs"]) {
    const candidate = path.join(base, name);
    if (fs.existsSync(candidate)) return true;
  }
  return false;
}

const importPattern = /(?:from\s+|import\s*\(\s*|require\s*\(\s*)["']([^"']+)["']/g;
const missing = [];
for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1];
    let base = null;
    if (specifier.startsWith("@/")) base = path.join(root, "src", specifier.slice(2));
    else if (specifier.startsWith(".")) base = path.resolve(path.dirname(file), specifier);
    if (base && !resolves(base)) missing.push(`${path.relative(root, file)} -> ${specifier}`);
  }
}

if (missing.length) {
  console.error(`LOCAL IMPORT CHECK: FAIL (${missing.length} unresolved local imports)`);
  for (const item of missing) console.error(`  ${item}`);
  process.exit(1);
}
console.log(`LOCAL IMPORT CHECK: PASS (${files.length} source/script files)`);
