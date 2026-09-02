# RuneForge Alpha Flagship Card Art

This directory is the only release-approved namespace for the first Alpha flagship card-art batches.

Authoritative roster: `src/game/flagship-art.ts`.

Rules:

- one master WebP per manifest `assetPath`;
- portrait 4:5 composition, target master 1536×1920 or higher;
- keep critical subjects inside the central 70% crop-safe area;
- illustration only: never bake card frame, mana, stats, rules text or RuneForge UI into the image;
- preserve enough quiet/dark edge value for existing CardView overlays;
- Champion masters may be reused for their evolved forms during Alpha;
- do not add untracked bulk art outside the 30-card Flagship roster before Alpha RC.

Image assets are integrated only after CI plus browser-artifact inspection confirms Collection/Codex/gameplay readability.
