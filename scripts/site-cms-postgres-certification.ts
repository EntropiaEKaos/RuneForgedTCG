import assert from "node:assert/strict";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const pool = new Pool({ connectionString: databaseUrl, max: 4, connectionTimeoutMillis: 5_000 });
const prefix = "__ci_portal_cms__";

async function expectPgError(label: string, expectedCode: string, fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code) : "";
    assert.equal(code, expectedCode, `${label}: expected PostgreSQL ${expectedCode}, received ${code || "unknown"}`);
    return;
  }
  assert.fail(`${label}: expected PostgreSQL error ${expectedCode}`);
}

async function main() {
  try {
    const constraints = await pool.query<{ conname: string }>(
      "select conname from pg_constraint where conname = any($1::text[])",
      [[
        "site_content_status_check",
        "site_content_version_positive",
        "site_content_versions_status_check",
        "site_content_versions_version_positive",
        "site_content_versions_content_id_fkey",
      ]],
    );
    const constraintNames = new Set(constraints.rows.map((row) => row.conname));
    for (const name of [
      "site_content_status_check",
      "site_content_version_positive",
      "site_content_versions_status_check",
      "site_content_versions_version_positive",
      "site_content_versions_content_id_fkey",
    ]) assert.ok(constraintNames.has(name), `missing CMS constraint ${name}`);

    const indexes = await pool.query<{ indexname: string }>(
      "select indexname from pg_indexes where schemaname='public' and indexname = any($1::text[])",
      [[
        "site_content_resource_slug_locale_uq",
        "site_content_resource_locale_status_idx",
        "site_content_versions_content_version_uq",
        "site_content_versions_content_created_idx",
      ]],
    );
    const indexNames = new Set(indexes.rows.map((row) => row.indexname));
    for (const name of [
      "site_content_resource_slug_locale_uq",
      "site_content_resource_locale_status_idx",
      "site_content_versions_content_version_uq",
      "site_content_versions_content_created_idx",
    ]) assert.ok(indexNames.has(name), `missing CMS index ${name}`);

    const lockKey = "runeforge:site:news:pt-BR:__ci_lock__";
    const a = await pool.connect();
    const b = await pool.connect();
    try {
      await a.query("begin");
      await b.query("begin");
      await a.query("select pg_advisory_xact_lock(hashtext($1))", [lockKey]);
      const blocked = await b.query<{ locked: boolean }>("select pg_try_advisory_xact_lock(hashtext($1)) locked", [lockKey]);
      assert.equal(blocked.rows[0]?.locked, false, "second transaction must not acquire a held CMS advisory lock");
      await a.query("commit");
      const acquired = await b.query<{ locked: boolean }>("select pg_try_advisory_xact_lock(hashtext($1)) locked", [lockKey]);
      assert.equal(acquired.rows[0]?.locked, true, "CMS advisory lock must become available after commit");
      await b.query("commit");
    } catch (error) {
      await a.query("rollback").catch(() => {});
      await b.query("rollback").catch(() => {});
      throw error;
    } finally {
      a.release();
      b.release();
    }

    await pool.query("delete from site_content where slug like $1", [`${prefix}%`]);

    const inserted = await pool.query<{ id: number }>(
      `insert into site_content(resource,slug,locale,status,payload,seo,version,updated_by)
       values('news',$1,'pt-BR','draft',$2::jsonb,$3::jsonb,1,'ci')
       returning id`,
      [`${prefix}base`, JSON.stringify({ title: "CMS runtime cert" }), JSON.stringify({ title: "SEO" })],
    );
    const contentId = inserted.rows[0]?.id;
    assert.ok(Number.isInteger(contentId) && contentId! > 0, "CMS content insert must return a positive id");

    await pool.query(
      `insert into site_content_versions(content_id,version,status,snapshot,actor,change_note)
       values($1,1,'draft',$2::jsonb,'ci','initial')`,
      [contentId, JSON.stringify({ payload: { title: "CMS runtime cert" }, seo: { title: "SEO" } })],
    );

    await expectPgError("duplicate resource/slug/locale", "23505", () => pool.query(
      `insert into site_content(resource,slug,locale,status,payload,seo,version,updated_by)
       values('news',$1,'pt-BR','draft','{}'::jsonb,'{}'::jsonb,1,'ci')`,
      [`${prefix}base`],
    ));

    await expectPgError("invalid current status", "23514", () => pool.query(
      `insert into site_content(resource,slug,locale,status,payload,seo,version,updated_by)
       values('news',$1,'pt-BR','invalid','{}'::jsonb,'{}'::jsonb,1,'ci')`,
      [`${prefix}bad_status`],
    ));

    await expectPgError("invalid current version", "23514", () => pool.query(
      `insert into site_content(resource,slug,locale,status,payload,seo,version,updated_by)
       values('news',$1,'pt-BR','draft','{}'::jsonb,'{}'::jsonb,0,'ci')`,
      [`${prefix}bad_version`],
    ));

    await expectPgError("invalid history status", "23514", () => pool.query(
      `insert into site_content_versions(content_id,version,status,snapshot,actor)
       values($1,2,'invalid','{}'::jsonb,'ci')`,
      [contentId],
    ));

    await pool.query("delete from site_content where id=$1", [contentId]);
    const historyAfterDelete = await pool.query<{ n: string }>(
      "select count(*)::text n from site_content_versions where content_id=$1",
      [contentId],
    );
    assert.equal(Number(historyAfterDelete.rows[0]?.n ?? -1), 0, "site content history must cascade on hard deletion");

    console.log("PORTAL CMS POSTGRES CERTIFICATION: PASS — 5 constraints · 4 indexes · advisory lock serialization · unique/check enforcement · history cascade");
  } finally {
    await pool.query("delete from site_content where slug like $1", [`${prefix}%`]).catch(() => {});
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
