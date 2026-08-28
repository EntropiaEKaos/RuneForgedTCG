CREATE TABLE IF NOT EXISTS admin_users (
 id serial PRIMARY KEY, username text NOT NULL UNIQUE, password_salt text NOT NULL, password_hash text NOT NULL,
 role text NOT NULL DEFAULT 'designer', enabled boolean NOT NULL DEFAULT true, mfa_secret text,
 created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_users_enabled_idx ON admin_users(enabled, role);
