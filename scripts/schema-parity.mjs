import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const drizzleDir = path.join(root, "drizzle");
const historicalFiles = fs.readdirSync(drizzleDir).filter((name) => /^\d{4}_.+\.sql$/.test(name) && !name.startsWith("0031_") && !name.startsWith("0032_")).sort();
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
const readMany = (files) => files.map((file) => fs.readFileSync(path.join(root, file), "utf8")).join("\n");
const historical = readMany(historicalFiles.map((file) => `drizzle/${file}`));
const fresh = readMany(freshFiles);
const stripComments = (source) => source.replace(/--.*$/gm, "");

function indexNames(source) {
  const names = new Set();
  const pattern = /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?([A-Za-z0-9_]+)/gi;
  for (const match of stripComments(source).matchAll(pattern)) names.add(match[1]);
  return names;
}
function foreignKeys(source) {
  const keys = new Set();
  for (const statement of stripComments(source).split(";")) {
    if (!/FOREIGN\s+KEY/i.test(statement)) continue;
    const table = statement.match(/ALTER\s+TABLE\s+["`]?([\w]+)/i)?.[1];
    const fk = statement.match(/FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+["`]?([\w]+)["`]?\s*\(([^)]+)\)/i);
    if (!table || !fk) continue;
    const cols = fk[1].split(",").map((value) => value.trim().replace(/["`]/g, "")).join(",");
    const refs = fk[3].split(",").map((value) => value.trim().replace(/["`]/g, "")).join(",");
    keys.add(`${table}(${cols})->${fk[2]}(${refs})`);
  }
  return keys;
}
function missing(expected, actual) { return [...expected].filter((value) => !actual.has(value)).sort(); }

function economyIdempotencyPredicate(source) {
  const clean = stripComments(source).replace(/\s+/g, " ");
  const matches = [...clean.matchAll(/CREATE\s+UNIQUE\s+INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?economy_reward_idempotency_idx[\s\S]*?WHERE\s+([^;]+);/gi)];
  return matches.at(-1)?.[1]?.toLowerCase() || "";
}

const oldIndexes = indexNames(historical), freshIndexes = indexNames(fresh);
const oldFks = foreignKeys(historical), freshFks = foreignKeys(fresh);
const missingIndexes = missing(oldIndexes, freshIndexes);
const missingFks = missing(oldFks, freshFks);
const economyPredicate = economyIdempotencyPredicate(fresh);
const economyPredicateOk = economyPredicate.includes("reason in ('match_reward', 'mode_reward')")
  || economyPredicate.includes('reason in (\'match_reward\', \'mode_reward\')');
if (missingIndexes.length || missingFks.length || !economyPredicateOk) {
  console.error("SCHEMA STATIC PARITY: FAIL");
  for (const value of missingIndexes) console.error(`missing index: ${value}`);
  for (const value of missingFks) console.error(`missing FK: ${value}`);
  if (!economyPredicateOk) console.error(`economy idempotency predicate is too broad: ${economyPredicate || "missing"}`);
  process.exit(1);
}
console.log(`SCHEMA STATIC PARITY: PASS (${oldIndexes.size} historical indexes, ${oldFks.size} historical FK contracts; runtime verification still required)`);
