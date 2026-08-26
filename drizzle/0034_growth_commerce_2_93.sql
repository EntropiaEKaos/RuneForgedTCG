-- RuneForge 2.93 — Growth, formats, sandbox and real-money commerce.

CREATE TABLE IF NOT EXISTS payment_gateway_settings (
  id serial PRIMARY KEY,
  provider text NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT false,
  environment text NOT NULL DEFAULT 'sandbox',
  public_key text NOT NULL DEFAULT '',
  access_token_encrypted text,
  webhook_secret_encrypted text,
  statement_descriptor text NOT NULL DEFAULT 'RUNEFORGE',
  revision integer NOT NULL DEFAULT 1,
  updated_by text NOT NULL DEFAULT 'admin',
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT payment_gateway_settings_revision_positive CHECK (revision > 0),
  CONSTRAINT payment_gateway_settings_environment_check CHECK (environment IN ('sandbox','production'))
);

CREATE TABLE IF NOT EXISTS payment_orders (
  id serial PRIMARY KEY,
  player_id integer NOT NULL REFERENCES players(id),
  provider text NOT NULL DEFAULT 'mercadopago',
  provider_environment text NOT NULL DEFAULT 'sandbox',
  external_reference text NOT NULL UNIQUE,
  product_key text NOT NULL,
  product_name text NOT NULL,
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'BRL',
  status text NOT NULL DEFAULT 'created',
  idempotency_key text NOT NULL UNIQUE,
  provider_preference_id text,
  provider_payment_id text,
  grants jsonb NOT NULL DEFAULT '{}'::jsonb,
  provider_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  approved_at timestamp,
  fulfilled_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT payment_orders_amount_positive CHECK (amount_cents > 0),
  CONSTRAINT payment_orders_environment_check CHECK (provider_environment IN ('sandbox','production'))
);
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS provider_environment text NOT NULL DEFAULT 'sandbox';
DO $$ BEGIN
  ALTER TABLE payment_orders ADD CONSTRAINT payment_orders_environment_check CHECK (provider_environment IN ('sandbox','production'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS payment_orders_player_created_idx ON payment_orders(player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payment_orders_status_idx ON payment_orders(status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS payment_orders_provider_payment_unique ON payment_orders(provider, provider_payment_id) WHERE provider_payment_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS collection_reward_claims (
  id serial PRIMARY KEY,
  player_id integer NOT NULL REFERENCES players(id),
  collection_key text NOT NULL,
  milestone integer NOT NULL,
  grants jsonb NOT NULL DEFAULT '{}'::jsonb,
  claimed_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT collection_reward_claims_unique UNIQUE(player_id, collection_key, milestone),
  CONSTRAINT collection_reward_claims_milestone_bounds CHECK (milestone > 0 AND milestone <= 100)
);
CREATE INDEX IF NOT EXISTS collection_reward_claims_player_idx ON collection_reward_claims(player_id, collection_key);

CREATE TABLE IF NOT EXISTS admin_sandbox_sessions (
  id serial PRIMARY KEY,
  token_hash text NOT NULL UNIQUE,
  actor_id text NOT NULL,
  card jsonb NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamp NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_sandbox_sessions_expires_idx ON admin_sandbox_sessions(expires_at);

CREATE TABLE IF NOT EXISTS telemetry_events (
  id serial PRIMARY KEY,
  player_id integer REFERENCES players(id),
  session_id text,
  event_name text NOT NULL,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS telemetry_events_name_created_idx ON telemetry_events(event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS telemetry_events_player_created_idx ON telemetry_events(player_id, created_at DESC) WHERE player_id IS NOT NULL;

ALTER TABLE custom_decks ADD COLUMN IF NOT EXISTS format_id text NOT NULL DEFAULT 'eternal';
ALTER TABLE shared_decks ADD COLUMN IF NOT EXISTS format_id text NOT NULL DEFAULT 'eternal';
CREATE INDEX IF NOT EXISTS custom_decks_format_idx ON custom_decks(format_id);
CREATE INDEX IF NOT EXISTS shared_decks_format_idx ON shared_decks(format_id);

INSERT INTO runeforge_schema_meta(version) VALUES ('2.93') ON CONFLICT(version) DO NOTHING;
