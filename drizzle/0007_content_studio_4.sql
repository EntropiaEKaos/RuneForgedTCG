CREATE TABLE IF NOT EXISTS "admin_approval_requests" (
  "id" serial PRIMARY KEY NOT NULL,
  "resource" text NOT NULL,
  "resource_id" integer NOT NULL,
  "stage" text DEFAULT 'content' NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "requested_by" text DEFAULT 'admin' NOT NULL,
  "decided_by" text,
  "note" text DEFAULT '' NOT NULL,
  "decision_note" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "decided_at" timestamp
);
CREATE INDEX IF NOT EXISTS "approval_resource_idx" ON "admin_approval_requests" ("resource", "resource_id");
CREATE INDEX IF NOT EXISTS "approval_status_idx" ON "admin_approval_requests" ("status", "stage");

CREATE TABLE IF NOT EXISTS "admin_simulation_runs" (
  "id" serial PRIMARY KEY NOT NULL,
  "mode" text DEFAULT 'ai-vs-ai' NOT NULL,
  "deck_a" text NOT NULL,
  "deck_b" text NOT NULL,
  "requested_games" integer NOT NULL,
  "completed_games" integer DEFAULT 0 NOT NULL,
  "wins_a" integer DEFAULT 0 NOT NULL,
  "wins_b" integer DEFAULT 0 NOT NULL,
  "draws" integer DEFAULT 0 NOT NULL,
  "avg_rounds" integer DEFAULT 0 NOT NULL,
  "seed" integer NOT NULL,
  "engine_version" text NOT NULL,
  "ruleset_version" text NOT NULL,
  "details" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
