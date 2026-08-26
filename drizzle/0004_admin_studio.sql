CREATE TABLE IF NOT EXISTS admin_keywords (
  id serial PRIMARY KEY, key text NOT NULL UNIQUE, name text NOT NULL, description text NOT NULL DEFAULT '', icon text,
  engine_keyword text, behavior jsonb NOT NULL DEFAULT '{}'::jsonb, enabled boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS admin_effects (
  id serial PRIMARY KEY, key text NOT NULL UNIQUE, name text NOT NULL, description text NOT NULL DEFAULT '', kind text NOT NULL,
  schema jsonb NOT NULL DEFAULT '{}'::jsonb, enabled boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS admin_races (
  id serial PRIMARY KEY, key text NOT NULL UNIQUE, name text NOT NULL, description text NOT NULL DEFAULT '', icon text,
  region text, color text, enabled boolean NOT NULL DEFAULT true, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS admin_classes (
  id serial PRIMARY KEY, key text NOT NULL UNIQUE, name text NOT NULL, description text NOT NULL DEFAULT '', icon text,
  color text, enabled boolean NOT NULL DEFAULT true, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS admin_interactions (
  id serial PRIMARY KEY, name text NOT NULL, source_type text NOT NULL, source_key text NOT NULL,
  target_type text NOT NULL, target_key text NOT NULL, condition jsonb NOT NULL DEFAULT '{}'::jsonb,
  effect jsonb NOT NULL DEFAULT '{}'::jsonb, priority integer NOT NULL DEFAULT 0, enabled boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS admin_collections (
  id serial PRIMARY KEY, key text NOT NULL UNIQUE, name text NOT NULL, description text NOT NULL DEFAULT '', code text NOT NULL UNIQUE,
  symbol text, banner text, release_date timestamp, rotation_date timestamp, status text NOT NULL DEFAULT 'draft',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS card_catalog_meta (
  id serial PRIMARY KEY, def_id text NOT NULL UNIQUE, collection_id integer REFERENCES admin_collections(id) ON DELETE SET NULL,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb, class_keys jsonb NOT NULL DEFAULT '[]'::jsonb, race_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  release_state text NOT NULL DEFAULT 'draft', notes text, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS admin_events (
  id serial PRIMARY KEY, key text NOT NULL UNIQUE, name text NOT NULL, description text NOT NULL DEFAULT '', type text NOT NULL DEFAULT 'event',
  status text NOT NULL DEFAULT 'draft', starts_at timestamp, ends_at timestamp, rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  rewards jsonb NOT NULL DEFAULT '[]'::jsonb, metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS admin_promotions (
  id serial PRIMARY KEY, key text NOT NULL UNIQUE, name text NOT NULL, description text NOT NULL DEFAULT '', type text NOT NULL DEFAULT 'store',
  status text NOT NULL DEFAULT 'draft', starts_at timestamp, ends_at timestamp, conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  offers jsonb NOT NULL DEFAULT '[]'::jsonb, metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS card_catalog_meta_collection_idx ON card_catalog_meta(collection_id);
CREATE INDEX IF NOT EXISTS admin_events_status_idx ON admin_events(status);
CREATE INDEX IF NOT EXISTS admin_promotions_status_idx ON admin_promotions(status);
ALTER TABLE players ADD COLUMN IF NOT EXISTS bio text DEFAULT '';
ALTER TABLE players ADD COLUMN IF NOT EXISTS banner text DEFAULT 'default';
ALTER TABLE players ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE players ADD COLUMN IF NOT EXISTS badges jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE players ADD COLUMN IF NOT EXISTS moderator_note text;
