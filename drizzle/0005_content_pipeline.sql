CREATE TABLE IF NOT EXISTS admin_content_versions (
  id SERIAL PRIMARY KEY,
  resource TEXT NOT NULL,
  resource_id INTEGER NOT NULL,
  version INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  change_note TEXT NOT NULL DEFAULT '',
  author TEXT NOT NULL DEFAULT 'admin',
  engine_version TEXT,
  ruleset_version TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS admin_content_versions_lookup_idx ON admin_content_versions(resource, resource_id, version DESC);
CREATE UNIQUE INDEX IF NOT EXISTS admin_content_versions_unique_version ON admin_content_versions(resource, resource_id, version);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id SERIAL PRIMARY KEY,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  resource_id INTEGER,
  actor TEXT NOT NULL DEFAULT 'admin',
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS admin_audit_logs_created_idx ON admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_logs_resource_idx ON admin_audit_logs(resource, resource_id);

CREATE TABLE IF NOT EXISTS admin_qa_runs (
  id SERIAL PRIMARY KEY,
  resource TEXT NOT NULL,
  resource_id INTEGER,
  passed BOOLEAN NOT NULL DEFAULT FALSE,
  checks JSONB NOT NULL DEFAULT '[]'::jsonb,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS admin_qa_runs_resource_idx ON admin_qa_runs(resource, resource_id, created_at DESC);
