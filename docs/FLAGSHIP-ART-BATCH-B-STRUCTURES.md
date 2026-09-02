# Flagship Art Batch B — Structures

Batch B adds one dedicated 4:5 master illustration for each Alpha Structure card, preserving the Alpha Visual Feature Freeze.

## Cards

- Emberhold — Bastião da Forja Rubra (`rfalpha_ember_structure_forge_bastion`)
- Tidecall — Farol das Marés Silenciosas (`rfalpha_tide_structure_silent_beacon`)
- Ironwood — Círculo das Raízes de Ferro (`rfalpha_wood_structure_root_circle`)
- Voidborn — Obelisco da Sombra Oca (`rfalpha_void_structure_hollow_obelisk`)
- Florestia — Toca da Matilha Ancestral (`rfalpha_forest_structure_ancestral_den`)
- Tempestade — Torre do Primeiro Trovão (`rfalpha_storm_structure_first_thunder`)

## Contract

Each master is 1536×1920 WebP, region-specific, centered for CardView crop safety and readable as a permanent battlefield landmark rather than a spell or character portrait. Runtime priority remains Admin/editorial art first, then built-in flagship master, then normal regional fallback.

The masters are committed under `public/art/cards/flagship/<region>/` so production deploys do not depend on runtime generation. The deterministic generator remains versioned as reproducible source.

The `VER ARTE` viewer in Codex and Collection is the player-facing inspection surface for these masters.
