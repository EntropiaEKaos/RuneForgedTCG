CREATE TABLE IF NOT EXISTS "admin_fx_presets" (
  "id" serial PRIMARY KEY NOT NULL,
  "key" text NOT NULL,
  "name" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "renderer" text DEFAULT 'motion' NOT NULL,
  "intensity" text DEFAULT 'standard' NOT NULL,
  "duration_ms" integer DEFAULT 320 NOT NULL,
  "particle_budget" integer DEFAULT 0 NOT NULL,
  "screen_shake" text,
  "target_flash_ms" integer,
  "sound_cue" text,
  "enabled" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "admin_fx_presets_key_unique" UNIQUE("key"),
  CONSTRAINT "admin_fx_presets_renderer_check" CHECK ("renderer" IN ('motion','timeline','gpu')),
  CONSTRAINT "admin_fx_presets_intensity_check" CHECK ("intensity" IN ('subtle','standard','cinematic')),
  CONSTRAINT "admin_fx_presets_screen_shake_check" CHECK ("screen_shake" IS NULL OR "screen_shake" IN ('light','medium')),
  CONSTRAINT "admin_fx_presets_duration_check" CHECK ("duration_ms" BETWEEN 80 AND 5000),
  CONSTRAINT "admin_fx_presets_particle_budget_check" CHECK ("particle_budget" BETWEEN 0 AND 128),
  CONSTRAINT "admin_fx_presets_target_flash_check" CHECK ("target_flash_ms" IS NULL OR "target_flash_ms" BETWEEN 0 AND 2000)
);

CREATE INDEX IF NOT EXISTS "admin_fx_presets_enabled_idx" ON "admin_fx_presets" ("enabled");
