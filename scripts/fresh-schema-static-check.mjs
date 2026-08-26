import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const files = [
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
];

const tables = new Map();
const failures = [];
const loadedSources = [];
const dbForeignKeys = new Set();
const clean = (s) => s.replace(/--.*$/gm, "");
function colsFor(table) {
  if (!tables.has(table)) tables.set(table, new Set());
  return tables.get(table);
}
function addCreateTables(source) {
  for (const m of source.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?([A-Za-z0-9_]+)["`]?\s*\(([\s\S]*?)\);/gi)) {
    const cols = colsFor(m[1]);
    for (const line of m[2].split(/\r?\n/)) {
      const mm = line.trim().replace(/,$/, "").match(/^["`]?([A-Za-z_][A-Za-z0-9_]*)["`]?\s+/);
      if (!mm || ["CONSTRAINT", "PRIMARY", "UNIQUE", "FOREIGN", "CHECK"].includes(mm[1].toUpperCase())) continue;
      cols.add(mm[1]);
    }
  }
}
function addAlterColumns(source) {
  for (const m of source.matchAll(/ALTER\s+TABLE\s+["`]?([A-Za-z0-9_]+)["`]?\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?([A-Za-z0-9_]+)["`]?/gi)) colsFor(m[1]).add(m[2]);
}
function validateIndexes(source, file) {
  for (const m of source.matchAll(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?([A-Za-z0-9_]+)["`]?\s+ON\s+["`]?([A-Za-z0-9_]+)["`]?\s*\(([^)]*)\)/gi)) {
    const [, index, table, list] = m;
    const cols = tables.get(table);
    if (!cols) { failures.push(`${file}: ${index} references missing table ${table}`); continue; }
    for (const raw of list.split(",")) {
      const normalized = raw.trim().replace(/["`]/g, "");
      const simple = normalized.match(/^([A-Za-z_][A-Za-z0-9_]*)(?:\s+(?:ASC|DESC))?$/i);
      if (simple && !cols.has(simple[1])) failures.push(`${file}: ${index} references missing ${table}.${simple[1]}`);
    }
  }
}

for (const file of files) {
  const source = clean(fs.readFileSync(path.join(root, file), "utf8"));
  loadedSources.push({ file, source });
  addCreateTables(source);
  addAlterColumns(source);
  validateIndexes(source, file);
}

function validateForeignKey(file, table, sourceColsRaw, target, targetColsRaw) {
  const sourceCols = sourceColsRaw.split(",").map((x) => x.trim().replace(/["`]/g, ""));
  const targetCols = targetColsRaw.split(",").map((x) => x.trim().replace(/["`]/g, ""));
  const key = `${table}(${sourceCols.join(",")})->${target}(${targetCols.join(",")})`;
  dbForeignKeys.add(key);
  const sourceSet = tables.get(table), targetSet = tables.get(target);
  if (!sourceSet) { failures.push(`${file}: FK references missing source table ${table}`); return; }
  if (!targetSet) { failures.push(`${file}: FK ${table} references missing target table ${target}`); return; }
  if (sourceCols.length !== targetCols.length) failures.push(`${file}: FK ${table}->${target} has mismatched column arity`);
  for (const col of sourceCols) if (!sourceSet.has(col)) failures.push(`${file}: FK references missing ${table}.${col}`);
  for (const col of targetCols) if (!targetSet.has(col)) failures.push(`${file}: FK references missing ${target}.${col}`);
}
for (const { file, source } of loadedSources) {
  for (const statement of source.split(";")) {
    const alter = statement.match(/ALTER\s+TABLE\s+["`]?([A-Za-z0-9_]+)["`]?/i);
    const fk = statement.match(/FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+["`]?([A-Za-z0-9_]+)["`]?\s*\(([^)]+)\)/i);
    if (alter && fk) validateForeignKey(file, alter[1], fk[1], fk[2], fk[3]);
  }
  for (const m of source.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?([A-Za-z0-9_]+)["`]?\s*\(([\s\S]*?)\);/gi)) {
    const table = m[1];
    for (const line of m[2].split(/\r?\n/)) {
      const trimmed = line.trim();
      const tableLevel = trimmed.match(/^(?:CONSTRAINT\s+[A-Za-z0-9_]+\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+["`]?([A-Za-z0-9_]+)["`]?\s*\(([^)]+)\)/i);
      if (tableLevel) { validateForeignKey(file, table, tableLevel[1], tableLevel[2], tableLevel[3]); continue; }
      if (/^(?:CONSTRAINT|PRIMARY|UNIQUE|CHECK|FOREIGN)\b/i.test(trimmed)) continue;
      const inline = line.match(/^[\s"`]*([A-Za-z_][A-Za-z0-9_]*)["`]?\s+[^,]*?REFERENCES\s+["`]?([A-Za-z0-9_]+)["`]?\s*\(([^)]+)\)/i);
      if (inline) validateForeignKey(file, table, inline[1], inline[2], inline[3]);
    }
  }
}

function findObjectEnd(source, start) {
  let depth = 1, quote = null, escape = false;
  for (let i = start; i < source.length; i++) {
    const c = source[i];
    if (quote) {
      if (escape) escape = false;
      else if (c === "\\") escape = true;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
    if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return i;
  }
  return -1;
}
function drizzleTables() {
  const out = new Map();
  const schemaDir = path.join(root, "src/db/schema");
  for (const name of fs.readdirSync(schemaDir).filter((n) => n.endsWith(".ts"))) {
    const source = fs.readFileSync(path.join(schemaDir, name), "utf8");
    const rx = /pgTable\("([^"]+)"\s*,\s*\{/g;
    let m;
    while ((m = rx.exec(source))) {
      const end = findObjectEnd(source, m.index + m[0].length);
      if (end < 0) { failures.push(`${name}: unclosed pgTable(${m[1]}) definition`); continue; }
      const body = source.slice(m.index + m[0].length, end);
      const cols = new Set();
      for (const cm of body.matchAll(/\b[A-Za-z_][A-Za-z0-9_]*\s*:\s*[A-Za-z_][A-Za-z0-9_]*\("([^"]+)"\)/g)) cols.add(cm[1]);
      out.set(m[1], cols);
      rx.lastIndex = end + 1;
    }
  }
  return out;
}

const drizzle = drizzleTables();
for (const [table, dbCols] of tables) {
  const ormCols = drizzle.get(table);
  if (!ormCols) { failures.push(`Drizzle schema missing table ${table}`); continue; }
  for (const col of dbCols) if (!ormCols.has(col)) failures.push(`Drizzle schema missing DB column ${table}.${col}`);
  for (const col of ormCols) if (!dbCols.has(col)) failures.push(`Fresh bootstrap missing Drizzle column ${table}.${col}`);
}
for (const table of drizzle.keys()) if (!tables.has(table)) failures.push(`Fresh bootstrap missing Drizzle table ${table}`);

if (failures.length) {
  console.error("FRESH SCHEMA STATIC CHECK: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
const dbColumnCount = [...tables.values()].reduce((n, cols) => n + cols.size, 0);
console.log(`FRESH SCHEMA STATIC CHECK: PASS (${tables.size} tables, ${dbColumnCount} columns, ${dbForeignKeys.size} SQL FKs structurally valid, ${files.length} bootstrap files, Drizzle column parity exact)`);
