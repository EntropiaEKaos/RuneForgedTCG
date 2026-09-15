-- Identity/Auth 1.0: externally authenticated identities and admin-controlled provider vault.
-- Provider secrets are always encrypted by the application before persistence.

CREATE TABLE IF NOT EXISTS auth_provider_settings (
  provider text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  client_id text NOT NULL DEFAULT '',
  secret_encrypted text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  revision integer NOT NULL DEFAULT 1,
  updated_by text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT auth_provider_settings_provider_check CHECK (provider IN ('google','discord','email')),
  CONSTRAINT auth_provider_settings_revision_positive CHECK (revision > 0)
);

CREATE TABLE IF NOT EXISTS player_identities (
  id serial PRIMARY KEY,
  player_id integer NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_subject text NOT NULL,
  email text,
  email_verified boolean NOT NULL DEFAULT false,
  display_name text,
  avatar_url text,
  created_at timestamp NOT NULL DEFAULT now(),
  last_login_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT player_identities_provider_check CHECK (provider IN ('google','discord','email'))
);

CREATE UNIQUE INDEX IF NOT EXISTS player_identities_provider_subject_unique
  ON player_identities(provider, provider_subject);
CREATE INDEX IF NOT EXISTS player_identities_player_idx ON player_identities(player_id);

CREATE TABLE IF NOT EXISTS auth_login_tokens (
  id serial PRIMARY KEY,
  token_hash text NOT NULL UNIQUE,
  provider text NOT NULL DEFAULT 'email',
  subject text NOT NULL,
  expires_at timestamp NOT NULL,
  consumed_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT auth_login_tokens_provider_check CHECK (provider IN ('email'))
);
CREATE INDEX IF NOT EXISTS auth_login_tokens_subject_idx ON auth_login_tokens(provider, subject);
CREATE INDEX IF NOT EXISTS auth_login_tokens_expiry_idx ON auth_login_tokens(expires_at);
