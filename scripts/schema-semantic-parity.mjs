import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const freshFiles = [
  "database/baseline-2.31.sql",
  "drizzle/0017_security_matrix_integrity.sql",
  "drizzle/0018_ownership_integrity.sql",
  "drizzle/0025_production_certification.sql",
  "drizzle/0026_production_gameplay_2_56.sql",
  "drizzle/0027_gameplay_visual_2_65.sql",
  "drizzle/0028_total_control_plane.sql",
  "drizzle/0029_multiregion_identity.sql",
  "drizzle/0030_bugfix_integrity.sql",
  "drizzle/0031_certification_2_90.sql",
  "drizzle/0032_mvp_2_91.sql",
  "drizzle/0033_vanilla_collection_2_92.sql",
  "drizzle/0034_growth_commerce_2_93.sql",
  "drizzle/0035_release_hardening_2_94.sql",
  "drizzle/0036_sentinelas_convergence_2_96.sql",
  "drizzle/0037_schema_replay_hotfix_2_96_1.sql",
  "drizzle/0038_engineering_integrity_2_96_2.sql",
  "drizzle/0039_ranked_certification_2_97.sql",
  "drizzle/0040_pvp_content_snapshot_2_97.sql",
  "drizzle/0041_pvp_reaction_priority.sql",
  "drizzle/0042_site_portal_cms.sql",
];
const sql = freshFiles.map((f) => fs.readFileSync(path.join(root, f), "utf8")).join("\n").replace(/--.*$/gm, "");
const failures = [];

function normalizeCols(raw) { return raw.split(",").map((x) => x.trim().replace(/["`]/g, "")).join(","); }
const dbFks = new Set();
for (const statement of sql.split(";")) {
  const table = statement.match(/ALTER\s+TABLE\s+["`]?([\w]+)/i)?.[1];
  const fk = statement.match(/FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+["`]?([\w]+)["`]?\s*\(([^)]+)\)/i);
  if (table && fk) dbFks.add(`${table}(${normalizeCols(fk[1])})->${fk[2]}(${normalizeCols(fk[3])})`);
}
for (const m of sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?([\w]+)["`]?\s*\(([\s\S]*?)\);/gi)) {
  const table = m[1];
  for (const line of m[2].split(/\r?\n/)) {
    const inline = line.match(/^[\s"`]*([A-Za-z_][\w]*)["`]?\s+[^,]*?REFERENCES\s+["`]?([\w]+)["`]?\s*\(([\w"`]+)\)/i);
    if (inline) dbFks.add(`${table}(${inline[1]})->${inline[2]}(${inline[3].replace(/["`]/g, "")})`);
    const tableLevel = line.trim().match(/^(?:CONSTRAINT\s+[A-Za-z0-9_]+\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+["`]?([\w]+)["`]?\s*\(([^)]+)\)/i);
    if (tableLevel) dbFks.add(`${table}(${normalizeCols(tableLevel[1])})->${tableLevel[2]}(${normalizeCols(tableLevel[3])})`);
  }
}

const schemaDir = path.join(root, "src/db/schema");
const schemaSources = [];
const schemaEntries = [];

function tableBlock(source, variable) {
  const rx = new RegExp(`export\\s+const\\s+${variable}\\s*=\\s*pgTable\\("[^"]+"\\s*,\\s*\\{`);
  const m = source.match(rx); if (!m || m.index == null) return "";
  let i = m.index + m[0].length, depth = 1, quote = null, esc = false;
  for (; i < source.length; i++) {
    const c = source[i];
    if (quote) { if (esc) esc=false; else if (c==="\\") esc=true; else if (c===quote) quote=null; continue; }
    if (c==='"'||c==="'"||c==='`') { quote=c; continue; }
    if (c==='{') depth++; else if (c==='}' && --depth===0) return source.slice(m.index, i+1);
  }
  return "";
}

for (const name of fs.readdirSync(schemaDir).filter((n) => n.endsWith(".ts"))) {
  const source = fs.readFileSync(path.join(schemaDir, name), "utf8");
  schemaSources.push(source);
  for (const m of source.matchAll(/export\s+const\s+(\w+)\s*=\s*pgTable\("([^"]+)"\s*,\s*\{/g)) {
    const variable = m[1], table = m[2];
    const block = tableBlock(source, variable);
    const fields = new Map();
    for (const fm of block.matchAll(/^\s*(\w+)\s*:\s*\w+\("([^"]+)"\)/gm)) fields.set(fm[1], fm[2]);
    schemaEntries.push({ name, source, variable, table, block, fields });
  }
}
const byVariable = new Map(schemaEntries.map((entry) => [entry.variable, entry]));

let drizzleFkCount = 0;
for (const entry of schemaEntries) {
  for (const line of entry.block.split(/\r?\n/)) {
    const m = line.match(/^\s*(\w+)\s*:\s*\w+\("([^"]+)"\)[^,\n]*?\.references\(\(\)\s*=>\s*(\w+)\.(\w+)/);
    if (!m) continue;
    const [, prop, sourceCol, targetVar, targetProp] = m;
    const target = byVariable.get(targetVar);
    if (!target) { failures.push(`${entry.table}.${sourceCol}: unknown referenced table variable ${targetVar}`); continue; }
    const targetCol = target.fields.get(targetProp);
    if (!targetCol) { failures.push(`${entry.table}.${sourceCol}: unknown referenced column ${targetVar}.${targetProp}`); continue; }
    const key = `${entry.table}(${sourceCol})->${target.table}(${targetCol})`;
    drizzleFkCount++;
    if (!dbFks.has(key)) failures.push(`fresh DB missing Drizzle FK ${key}`);
  }
}

const dbConstraintNames = new Set([...sql.matchAll(/CONSTRAINT\s+["`]?([A-Za-z0-9_]+)/gi)].map((m) => m[1]));
const dbIndexNames = new Set([...sql.matchAll(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?([A-Za-z0-9_]+)/gi)].map((m) => m[1]));
let drizzleChecks=0, drizzleNamedIndexes=0;
for (const source of schemaSources) {
  for (const m of source.matchAll(/check\("([^"]+)"/g)) { drizzleChecks++; if (!dbConstraintNames.has(m[1]) && !sql.includes(m[1])) failures.push(`fresh DB missing Drizzle CHECK ${m[1]}`); }
  for (const m of source.matchAll(/(?:uniqueIndex|index)\("([^"]+)"/g)) { drizzleNamedIndexes++; if (!dbIndexNames.has(m[1])) failures.push(`fresh DB missing Drizzle index ${m[1]}`); }
}

if (failures.length) {
  console.error("SCHEMA STATIC SEMANTIC PARITY: FAIL");
  for (const f of failures) console.error(`- ${f}`);
  process.exit(1);
}
console.log(`SCHEMA STATIC SEMANTIC PARITY: PASS (${drizzleFkCount} Drizzle FKs, ${drizzleChecks} named checks, ${drizzleNamedIndexes} named indexes backed by fresh SQL; PostgreSQL integration remains authoritative)`);
