-- RuneForge 2.96.2 Engineering Integrity
-- One-time/expiring recovery credentials + idempotent economy action receipts.

ALTER TABLE players ADD COLUMN IF NOT EXISTS recovery_key_expires_at timestamp;
UPDATE players
SET recovery_key_expires_at = NOW() + interval '180 days'
WHERE recovery_key_hash IS NOT NULL AND recovery_key_expires_at IS NULL;

CREATE TABLE IF NOT EXISTS economy_action_receipts (
  id serial PRIMARY KEY,
  player_id integer NOT NULL,
  operation_id text NOT NULL,
  action text NOT NULL,
  response jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS economy_action_receipts_player_operation_idx
  ON economy_action_receipts(player_id, operation_id);
CREATE INDEX IF NOT EXISTS economy_action_receipts_created_idx
  ON economy_action_receipts(created_at);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_economy_action_receipts_player') THEN
    ALTER TABLE economy_action_receipts
      ADD CONSTRAINT fk_economy_action_receipts_player
      FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'economy_action_receipts_operation_id_length') THEN
    ALTER TABLE economy_action_receipts
      ADD CONSTRAINT economy_action_receipts_operation_id_length
      CHECK (char_length(operation_id) BETWEEN 16 AND 100) NOT VALID;
  END IF;
END $$;

ALTER TABLE economy_action_receipts VALIDATE CONSTRAINT fk_economy_action_receipts_player;
ALTER TABLE economy_action_receipts VALIDATE CONSTRAINT economy_action_receipts_operation_id_length;

INSERT INTO runeforge_schema_meta(version) VALUES ('2.96.2') ON CONFLICT(version) DO NOTHING;
