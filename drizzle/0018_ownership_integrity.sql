-- Audit 2.16: ownership/data-integrity hardening.
-- NOT VALID preserves existing legacy/orphaned rows while enforcing all new writes.
-- Historical cleanup/validation can be performed separately after an orphan audit.

ALTER TABLE matches ADD CONSTRAINT fk_matches_player FOREIGN KEY (player_id) REFERENCES players(id) NOT VALID;
ALTER TABLE matches ADD CONSTRAINT fk_matches_opponent_player FOREIGN KEY (opponent_player_id) REFERENCES players(id) NOT VALID;
ALTER TABLE match_tokens ADD CONSTRAINT fk_match_tokens_player FOREIGN KEY (player_id) REFERENCES players(id) NOT VALID;
ALTER TABLE mode_attempts ADD CONSTRAINT fk_mode_attempts_player FOREIGN KEY (player_id) REFERENCES players(id) NOT VALID;
ALTER TABLE custom_decks ADD CONSTRAINT fk_custom_decks_owner FOREIGN KEY (owner_player_id) REFERENCES players(id) NOT VALID;
ALTER TABLE replays ADD CONSTRAINT fk_replays_player FOREIGN KEY (player_id) REFERENCES players(id) NOT VALID;
ALTER TABLE replays ADD CONSTRAINT fk_replays_opponent_player FOREIGN KEY (opponent_player_id) REFERENCES players(id) NOT VALID;
ALTER TABLE player_cards ADD CONSTRAINT fk_player_cards_player FOREIGN KEY (player_id) REFERENCES players(id) NOT VALID;
ALTER TABLE economy_transactions ADD CONSTRAINT fk_economy_transactions_player FOREIGN KEY (player_id) REFERENCES players(id) NOT VALID;
ALTER TABLE shared_decks ADD CONSTRAINT fk_shared_decks_player FOREIGN KEY (player_id) REFERENCES players(id) NOT VALID;
ALTER TABLE shared_deck_votes ADD CONSTRAINT fk_shared_deck_votes_player FOREIGN KEY (player_id) REFERENCES players(id) NOT VALID;
ALTER TABLE shared_deck_votes ADD CONSTRAINT fk_shared_deck_votes_deck FOREIGN KEY (deck_id) REFERENCES shared_decks(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE mode_rewards ADD CONSTRAINT fk_mode_rewards_player FOREIGN KEY (player_id) REFERENCES players(id) NOT VALID;
ALTER TABLE player_achievements ADD CONSTRAINT fk_player_achievements_player FOREIGN KEY (player_id) REFERENCES players(id) NOT VALID;
ALTER TABLE player_dailies ADD CONSTRAINT fk_player_dailies_player FOREIGN KEY (player_id) REFERENCES players(id) NOT VALID;
ALTER TABLE draft_sessions ADD CONSTRAINT fk_draft_sessions_player FOREIGN KEY (player_id) REFERENCES players(id) NOT VALID;
ALTER TABLE pvp_rooms ADD CONSTRAINT fk_pvp_rooms_host_player FOREIGN KEY (host_player_id) REFERENCES players(id) NOT VALID;
ALTER TABLE pvp_rooms ADD CONSTRAINT fk_pvp_rooms_guest_player FOREIGN KEY (guest_player_id) REFERENCES players(id) NOT VALID;
ALTER TABLE friendships ADD CONSTRAINT fk_friendships_player FOREIGN KEY (player_id) REFERENCES players(id) NOT VALID;
ALTER TABLE friendships ADD CONSTRAINT fk_friendships_friend FOREIGN KEY (friend_id) REFERENCES players(id) NOT VALID;
ALTER TABLE ranked_matches ADD CONSTRAINT fk_ranked_matches_player FOREIGN KEY (player_id) REFERENCES players(id) NOT VALID;
ALTER TABLE ranked_matches ADD CONSTRAINT fk_ranked_matches_match FOREIGN KEY (match_id) REFERENCES matches(id) NOT VALID;
ALTER TABLE ranked_matches ADD CONSTRAINT fk_ranked_matches_season FOREIGN KEY (season_id) REFERENCES ranked_seasons(id) NOT VALID;
ALTER TABLE matchmaking_queue ADD CONSTRAINT fk_matchmaking_queue_player FOREIGN KEY (player_id) REFERENCES players(id) NOT VALID;
ALTER TABLE player_packs ADD CONSTRAINT fk_player_packs_player FOREIGN KEY (player_id) REFERENCES players(id) NOT VALID;
ALTER TABLE pack_openings ADD CONSTRAINT fk_pack_openings_player FOREIGN KEY (player_id) REFERENCES players(id) NOT VALID;
ALTER TABLE chat_messages ADD CONSTRAINT fk_chat_messages_player FOREIGN KEY (player_id) REFERENCES players(id) NOT VALID;

CREATE INDEX IF NOT EXISTS matches_player_id_idx ON matches(player_id);
CREATE INDEX IF NOT EXISTS replays_player_id_idx ON replays(player_id);
CREATE INDEX IF NOT EXISTS pvp_rooms_host_player_idx ON pvp_rooms(host_player_id);
CREATE INDEX IF NOT EXISTS pvp_rooms_guest_player_idx ON pvp_rooms(guest_player_id);
CREATE INDEX IF NOT EXISTS economy_transactions_player_idx ON economy_transactions(player_id, created_at);
