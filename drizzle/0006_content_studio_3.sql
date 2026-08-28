-- Runeforge Content Studio 3.0: card tests, live-ops experiments and analytics snapshots.
CREATE TABLE IF NOT EXISTS admin_card_tests (
  id SERIAL PRIMARY KEY,
  card_id INTEGER NOT NULL REFERENCES custom_cards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  scenario JSONB NOT NULL DEFAULT '{}'::jsonb,
  expected JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS admin_card_test_runs (
  id SERIAL PRIMARY KEY,
  test_id INTEGER REFERENCES admin_card_tests(id) ON DELETE SET NULL,
  card_id INTEGER NOT NULL REFERENCES custom_cards(id) ON DELETE CASCADE,
  passed BOOLEAN NOT NULL DEFAULT FALSE,
  actual JSONB NOT NULL DEFAULT '{}'::jsonb,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  engine_version TEXT NOT NULL,
  ruleset_version TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS admin_card_tests_card_idx ON admin_card_tests(card_id);
CREATE INDEX IF NOT EXISTS admin_card_test_runs_card_idx ON admin_card_test_runs(card_id);
CREATE INDEX IF NOT EXISTS admin_card_test_runs_created_idx ON admin_card_test_runs(created_at);
