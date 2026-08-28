-- RuneForge 2.97: freeze the complete card-definition closure for active PvP rooms.
-- This prevents a deploy/content publish from changing gameplay or replay semantics
-- halfway through an already-running match.
ALTER TABLE pvp_rooms ADD COLUMN IF NOT EXISTS content_snapshot jsonb;
ALTER TABLE pvp_rooms ADD COLUMN IF NOT EXISTS content_hash text;
