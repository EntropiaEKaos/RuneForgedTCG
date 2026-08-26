CREATE TABLE IF NOT EXISTS "admin_sessions" (
  "id" serial PRIMARY KEY,
  "token_hash" text NOT NULL UNIQUE,
  "actor_id" text NOT NULL,
  "role_at_login" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "expires_at" timestamp NOT NULL,
  "last_seen_at" timestamp DEFAULT now() NOT NULL,
  "revoked_at" timestamp
);
CREATE INDEX IF NOT EXISTS "admin_sessions_expires_idx" ON "admin_sessions" ("expires_at");
CREATE INDEX IF NOT EXISTS "admin_sessions_actor_idx" ON "admin_sessions" ("actor_id");
