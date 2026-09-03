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

The deterministic source lives in `scripts/generate-flagship-structure-art.mjs`. `next.config.ts` executes that generator before Next resolves the public tree, so local development and production builds materialize the same six WebPs under `public/art/cards/flagship/<region>/` without storing generated binaries in Git.

The `VER ARTE` viewer in Codex and Collection is the player-facing inspection surface for these masters. Browser certification must prove each WebP is served, each Structure uses its own master instead of the regional fallback, and the large-art viewer opens without crop or overflow.
