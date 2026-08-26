CREATE TABLE IF NOT EXISTS admin_content_dependencies (
 id serial PRIMARY KEY, resource text NOT NULL, resource_id integer NOT NULL,
 content_version text NOT NULL DEFAULT '', graph jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_content_dependencies_resource_idx ON admin_content_dependencies(resource, resource_id, created_at DESC);
