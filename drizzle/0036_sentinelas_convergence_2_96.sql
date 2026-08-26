-- RuneForge 2.96 — Sentinelas & Convergência.
-- Adds 33 code-authored cards to the inaugural Vanilla collection.

UPDATE admin_collections
SET description = 'Coleção inaugural do RuneForge. Reúne o conjunto fundador, a expansão Vanilla e a onda Sentinelas & Convergência 2.96.',
    metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{cardCount}', '429'::jsonb, true),
    updated_at = NOW()
WHERE key = 'vanilla';

WITH vanilla AS (SELECT id FROM admin_collections WHERE key = 'vanilla'),
card_ids(def_id) AS (VALUES
    ('rf296_sent_ilyra'),
    ('rf296_sent_selene'),
    ('rf296_sent_doran'),
    ('rf296_sent_morvane'),
    ('rf296_sent_rhaika'),
    ('rf296_sent_elyon'),
    ('rf296_sent_kaelis'),
    ('rf296_sent_nymara'),
    ('rf296_sent_orun'),
    ('rf296_sent_veyra'),
    ('rf296_sent_malakar'),
    ('rf296_sent_liora'),
    ('rf296_steam_bastion'),
    ('rf296_molten_canopy'),
    ('rf296_ashveil_reclaimer'),
    ('rf296_emberfang_huntress'),
    ('rf296_thunderforge_hammer'),
    ('rf296_tidal_rootkeeper'),
    ('rf296_drowned_oracle'),
    ('rf296_moonwater_call'),
    ('rf296_monsoon_lance'),
    ('rf296_twilight_seed'),
    ('rf296_ancestral_harness'),
    ('rf296_stormwood_colossus'),
    ('rf296_shadowpack_howl'),
    ('rf296_eclipse_reaver'),
    ('rf296_thunderhowl_alpha'),
    ('rf296_creation_engine'),
    ('rf296_worldfire_pact'),
    ('rf296_blackstorm_avatar'),
    ('rf296_abyssal_worldroot'),
    ('rf296_great_monsoon_hunt'),
    ('rf296_dreadroot_covenant')
)
INSERT INTO card_catalog_meta(def_id, collection_id, tags, class_keys, race_keys, release_state, notes, updated_at)
SELECT card_ids.def_id, vanilla.id, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, 'published', 'Assigned to Vanilla by Sentinelas & Convergência 2.96.', NOW()
FROM card_ids CROSS JOIN vanilla
ON CONFLICT (def_id) DO UPDATE SET
  collection_id = EXCLUDED.collection_id,
  release_state = 'published',
  notes = EXCLUDED.notes,
  updated_at = NOW();

INSERT INTO runeforge_schema_meta(version) VALUES ('2.96') ON CONFLICT(version) DO NOTHING;
