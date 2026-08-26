CREATE TABLE IF NOT EXISTS admin_card_lab_runs (
 id serial PRIMARY KEY, card_id integer, def_id text NOT NULL, iterations integer NOT NULL DEFAULT 12,
 passed integer NOT NULL DEFAULT 0, failed integer NOT NULL DEFAULT 0, report jsonb NOT NULL DEFAULT '{}'::jsonb,
 engine_version text NOT NULL, ruleset_version text NOT NULL, content_version text NOT NULL, created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_card_lab_runs_def_id_idx ON admin_card_lab_runs(def_id, created_at DESC);
