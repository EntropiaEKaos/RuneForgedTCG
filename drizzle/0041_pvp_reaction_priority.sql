ALTER TABLE pvp_rooms
ADD COLUMN IF NOT EXISTS reaction_state jsonb;

COMMENT ON COLUMN pvp_rooms.reaction_state IS
'Persisted authoritative PvP reaction-priority window; game_state remains pre-action until the window resolves.';
