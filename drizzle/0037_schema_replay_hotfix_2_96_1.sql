-- RuneForge 2.96.1 hotfix: replay provenance + fresh-bootstrap admin session index repair.
-- The replay ALTERs intentionally duplicate 0031 with IF NOT EXISTS so existing
-- 2.96 databases and partially-applied bootstrap attempts converge safely.
ALTER TABLE matches ADD COLUMN IF NOT EXISTS engine_rules jsonb;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS ai_rules jsonb;
ALTER TABLE replays ADD COLUMN IF NOT EXISTS engine_rules jsonb;
ALTER TABLE replays ADD COLUMN IF NOT EXISTS ai_rules jsonb;
ALTER TABLE replays ADD COLUMN IF NOT EXISTS canonical_deck_snapshot jsonb;
ALTER TABLE replays ADD COLUMN IF NOT EXISTS match_options_snapshot jsonb;

-- 0031 historically referenced `actor`; the canonical column is `actor_id`.
-- Recreate by name so databases that already have the correct 0016 index also
-- converge on one canonical definition.
DROP INDEX IF EXISTS admin_sessions_actor_idx;
CREATE INDEX admin_sessions_actor_idx ON admin_sessions(actor_id);

INSERT INTO runeforge_schema_meta(version) VALUES ('2.96.1') ON CONFLICT(version) DO NOTHING;
