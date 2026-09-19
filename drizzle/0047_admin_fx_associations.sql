CREATE TABLE IF NOT EXISTS "admin_fx_associations" (
  "id" serial PRIMARY KEY NOT NULL,
  "kind" text NOT NULL,
  "key" text NOT NULL,
  "source_preset_id" text DEFAULT '*' NOT NULL,
  "preset_id" text NOT NULL,
  "priority" integer DEFAULT 0 NOT NULL,
  "enabled" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "admin_fx_associations_kind_key_source_unique" UNIQUE("kind","key","source_preset_id"),
  CONSTRAINT "admin_fx_associations_kind_check" CHECK ("kind" in ('card','keyword','race','class','region','rarity','collection','cosmetic','frame')),
  CONSTRAINT "admin_fx_associations_source_preset_check" CHECK ("source_preset_id" in ('*','summon-default','attack-default','damage-default','heal-default','death-default','levelup-default','poison-default','barrier-default','barrierbreak-default','frost-default','stun-default')),
  CONSTRAINT "admin_fx_associations_preset_check" CHECK ("preset_id" in ('summon-default','attack-default','damage-default','heal-default','death-default','levelup-default','poison-default','barrier-default','barrierbreak-default','frost-default','stun-default')),
  CONSTRAINT "admin_fx_associations_priority_check" CHECK ("priority" between -1000 and 1000)
);
CREATE INDEX IF NOT EXISTS "admin_fx_associations_enabled_idx" ON "admin_fx_associations" USING btree ("enabled");
CREATE INDEX IF NOT EXISTS "admin_fx_associations_source_preset_idx" ON "admin_fx_associations" USING btree ("source_preset_id");
CREATE INDEX IF NOT EXISTS "admin_fx_associations_preset_idx" ON "admin_fx_associations" USING btree ("preset_id");
