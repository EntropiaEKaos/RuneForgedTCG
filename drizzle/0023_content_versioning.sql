ALTER TABLE replays ADD COLUMN IF NOT EXISTS content_hash text NOT NULL DEFAULT '';
ALTER TABLE matches ADD COLUMN IF NOT EXISTS content_hash text NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS admin_content_releases (
 id serial PRIMARY KEY, version integer NOT NULL, content_hash text NOT NULL UNIQUE,
 manifest jsonb NOT NULL DEFAULT '{}'::jsonb, actor text NOT NULL, active boolean NOT NULL DEFAULT false,
 created_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS admin_content_releases_one_active ON admin_content_releases(active) WHERE active=true;
